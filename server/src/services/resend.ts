/**
 * Resend transport for the promo pool.
 *
 * Deliverability notes — these are the reasons promos used to land in spam, so
 * please do not "simplify" them away:
 *
 *  - `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058). Since Feb 2024
 *    Gmail and Yahoo require one-click unsubscribe from bulk senders. Missing
 *    them is on its own enough to get filtered.
 *  - Every message ships a plain-text part alongside the HTML. HTML-only mail
 *    scores worse with every major spam filter.
 *  - `Reply-To` is a real, monitored mailbox. Unrouteable reply addresses hurt.
 *  - The From domain must have SPF, DKIM and DMARC configured in DNS. Without
 *    that none of the above matters.
 */

import { cleanAddress, addressProblem } from '../lib/email.js';

const RESEND_API = 'https://api.resend.com';

export type PromoEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
};

export type SendResult = {
  to: string;
  ok: boolean;
  messageId?: string;
  error?: string;
};

function apiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  return key;
}

/**
 * Gmail reads the sender address itself, and the first default here was
 * `promos@` — the promotional keyword was sitting in the From line of every
 * message while the template was being stripped back to fix exactly that.
 * A person's address, with a person's name in front of it, is worth more than
 * anything the HTML can do. Don't put promos/news/noreply/marketing back.
 *
 * No mailbox has to exist for the local part: the domain is DKIM-signed, so
 * Resend will send as any address on it, and replies go to `Reply-To`.
 */
export function fromAddress(): string {
  const email = process.env.PROMO_FROM_EMAIL || 'fran@criminalcrisis.com';
  const name = process.env.PROMO_FROM_NAME || 'Fran — Criminal Crisis';
  return `${name} <${email}>`;
}

export function replyToAddress(): string {
  return process.env.PROMO_REPLY_TO || process.env.CONTACT_EMAIL || 'info@criminalcrisis.com';
}

function toPayload(email: PromoEmail) {
  return {
    from: fromAddress(),
    to: [email.to],
    reply_to: replyToAddress(),
    subject: email.subject,
    html: email.html,
    text: email.text,
    headers: {
      'List-Unsubscribe': `<${email.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

/** One HTTP call to Resend. Batch of 1 is a normal batch. */
async function postBatch(
  payloads: unknown[]
): Promise<{ ok: true; items: any[] } | { ok: false; status: number; body: string }> {
  let res: Response;
  try {
    res = await fetch(`${RESEND_API}/emails/batch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payloads),
    });
  } catch (e: any) {
    return { ok: false, status: 0, body: `network: ${e.message}` };
  }

  const body = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: body.slice(0, 300) };

  try {
    const parsed: any = JSON.parse(body);
    return { ok: true, items: Array.isArray(parsed?.data) ? parsed.data : [] };
  } catch {
    return { ok: false, status: res.status, body: 'Unparseable response from Resend' };
  }
}

/**
 * Sends up to 100 emails in one call (Resend's batch limit).
 *
 * Results come back positionally: index N of the response is index N of the
 * request. Two things stop one bad recipient from sinking the rest:
 *
 *  1. Addresses are cleaned and checked before the call, and anything
 *     unsendable is failed on its own row and left out of the payload.
 *  2. If Resend still rejects the whole batch with a 4xx, every message is
 *     retried individually. That costs up to 100 calls, but only on a failure
 *     that would otherwise mark all 100 people failed for one broken address.
 *
 * Both exist because a single contact carrying an invisible U+2063 produced a
 * 422 that marked 97 valid recipients failed, none of whom were ever retried.
 */
export async function sendPromoBatch(emails: PromoEmail[]): Promise<SendResult[]> {
  if (emails.length === 0) return [];
  if (emails.length > 100) throw new Error('Resend batch limit is 100 emails per call');

  const results: SendResult[] = new Array(emails.length);
  const sendable: Array<{ index: number; payload: unknown; to: string }> = [];

  emails.forEach((email, index) => {
    const to = cleanAddress(email.to);
    const problem = addressProblem(to);
    if (problem) {
      results[index] = { to: email.to, ok: false, error: `Address ${problem}` };
    } else {
      sendable.push({ index, to, payload: toPayload({ ...email, to }) });
    }
  });

  if (sendable.length === 0) return results;

  const record = (slot: { index: number; to: string }, item: any, fallbackError: string) => {
    if (item?.id) results[slot.index] = { to: slot.to, ok: true, messageId: item.id };
    else results[slot.index] = { to: slot.to, ok: false, error: item?.error?.message || fallbackError };
  };

  const batch = await postBatch(sendable.map(s => s.payload));

  if (batch.ok) {
    sendable.forEach((slot, i) => record(slot, batch.items[i], 'No id returned by Resend'));
    return results;
  }

  // A 4xx is a validation complaint about the payload, so at least one message
  // in it is bad — but almost certainly not all of them. Find out which.
  const worthRetrying = batch.status >= 400 && batch.status < 500 && sendable.length > 1;
  if (!worthRetrying) {
    for (const slot of sendable) {
      results[slot.index] = { to: slot.to, ok: false, error: `${batch.status}: ${batch.body}` };
    }
    return results;
  }

  for (const slot of sendable) {
    const one = await postBatch([slot.payload]);
    if (one.ok) record(slot, one.items[0], 'No id returned by Resend');
    else results[slot.index] = { to: slot.to, ok: false, error: `${one.status}: ${one.body}` };
  }
  return results;
}

/** Single send, used for admin test emails. */
export async function sendPromoEmail(email: PromoEmail): Promise<SendResult> {
  const [result] = await sendPromoBatch([email]);
  return result;
}

// ---------------------------------------------------------------------------
// Domain setup helpers — used by the admin "email health" screen so the DNS
// records can be read straight out of the app instead of the Resend dashboard.
// ---------------------------------------------------------------------------

export async function createDomain(name: string) {
  const res = await fetch(`${RESEND_API}/domains`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function listDomains() {
  const res = await fetch(`${RESEND_API}/domains`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getDomain(id: string) {
  const res = await fetch(`${RESEND_API}/domains/${id}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function verifyDomain(id: string) {
  const res = await fetch(`${RESEND_API}/domains/${id}/verify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`);
  return res.json();
}
