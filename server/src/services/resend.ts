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

export function fromAddress(): string {
  const email = process.env.PROMO_FROM_EMAIL || 'promos@criminalcrisis.com';
  const name = process.env.PROMO_FROM_NAME || 'Criminal Crisis';
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

/**
 * Sends up to 100 emails in one call (Resend's batch limit).
 *
 * The batch endpoint returns results positionally, so index N of the response
 * corresponds to index N of the request. A whole-batch failure is mapped onto
 * every recipient so the caller can retry or mark them individually.
 */
export async function sendPromoBatch(emails: PromoEmail[]): Promise<SendResult[]> {
  if (emails.length === 0) return [];
  if (emails.length > 100) throw new Error('Resend batch limit is 100 emails per call');

  let res: Response;
  try {
    res = await fetch(`${RESEND_API}/emails/batch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emails.map(toPayload)),
    });
  } catch (e: any) {
    return emails.map(e2 => ({ to: e2.to, ok: false, error: `network: ${e.message}` }));
  }

  const bodyText = await res.text();

  if (!res.ok) {
    return emails.map(e => ({ to: e.to, ok: false, error: `${res.status}: ${bodyText.slice(0, 300)}` }));
  }

  let parsed: any;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return emails.map(e => ({ to: e.to, ok: false, error: 'Unparseable response from Resend' }));
  }

  const items: any[] = Array.isArray(parsed?.data) ? parsed.data : [];
  return emails.map((email, i) => {
    const item = items[i];
    if (item?.id) return { to: email.to, ok: true, messageId: item.id };
    return { to: email.to, ok: false, error: item?.error?.message || 'No id returned by Resend' };
  });
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
