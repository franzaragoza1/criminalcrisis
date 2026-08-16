/**
 * Promo email template.
 *
 * There are two ways to get this wrong and both have been tried.
 *
 * The first version was a proper HTML email — artwork, a black CTA button,
 * uppercase headings, table layout — and Gmail filed the entire first campaign
 * under Promotions, where 200 recipients produced zero opens. The second
 * version overcorrected into a wall of identical grey paragraphs that read as
 * something typed in a hurry, which is not what a label sending a pre-release
 * to a working DJ should look like.
 *
 * This one aims at the middle, and the split is deliberate:
 *
 *   Off limits, because these are what Gmail actually scores as promotional —
 *   images of any kind (artwork included), CTA buttons, <table> layout,
 *   multiple columns, background panels, uppercase + letter-spacing, hidden
 *   preheader text, more links than the two below.
 *
 *   Allowed, because none of it is a classification signal — type scale and
 *   weight, one accent colour, hairline rules, whitespace rhythm.
 *
 * So the design has to come from typography alone. That is the constraint, not
 * an oversight. Before adding anything from the first list, check the
 * Primary/Promotions split on a test send — that trade has been lost once.
 *
 * `List-Unsubscribe` (set in the transport) is itself a bulk signal, but Gmail
 * requires it from bulk senders and its absence risks the spam folder outright.
 * Promotions is a worse tab; spam is a worse outcome. It stays.
 */

const INK = '#111111';
const MUTED = '#767676';
const FAINT = '#a3a3a3';
const RULE = '#e6e6e6';
/** The site's accent. One use, on the one link that matters. */
const ACCENT = '#C8302B';

const FONT = "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;";
/** Body copy. Every prose paragraph shares this so the rhythm stays even. */
const BODY = `margin:0 0 15px;${FONT} font-size:15px; line-height:1.62; color:${INK};`;

export type PromoEmailContent = {
  campaignTitle: string;
  bodyIntro: string | null;
  releaseDate: string | null;
  trackTitles: string[];
  promoUrl: string;
  unsubscribeUrl: string;
  downloadEnabled: boolean;
  /** Second attempt at someone who never opened the link. */
  isReminder?: boolean;
};

/**
 * The one line that separates a reminder from the original.
 *
 * Deliberately an apology rather than a nudge: the recipient did nothing wrong
 * by ignoring the first one, and pretending otherwise is how promo mail earns
 * the spam button.
 */
const REMINDER_LINE = 'Sending this once more in case it got buried the first time.';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** The link's own label says what it does, so the prose doesn't have to. */
const linkLabel = (downloadEnabled: boolean) =>
  downloadEnabled ? 'Listen and download the files' : 'Listen to the promo';

export function renderPromoHtml(c: PromoEmailContent): string {
  const intro = c.bodyIntro
    ? c.bodyIntro
        .split(/\n{2,}/)
        .map(t => `<p style="${BODY}">${escapeHtml(t).replace(/\n/g, '<br>')}</p>`)
        .join('')
    : '';

  // Numbered lines with the index set back in grey, so the titles read as a
  // column without a table holding them there. A single-track release gets no
  // numbering — "01" on its own looks like a mistake.
  const tracks = c.trackTitles.length
    ? `<p style="margin:0 0 24px;${FONT} font-size:15px; line-height:1.9; color:${INK};">${
        c.trackTitles
          .map((t, i) =>
            c.trackTitles.length > 1
              ? `<span style="color:${FAINT};">${String(i + 1).padStart(2, '0')}</span>&nbsp;&nbsp;${escapeHtml(t)}`
              : escapeHtml(t)
          )
          .join('<br>')
      }</p>`
    : '';

  const releaseLine = c.releaseDate
    ? `<p style="margin:0 0 24px;${FONT} font-size:13px; line-height:1.5; color:${MUTED};">Out ${escapeHtml(c.releaseDate)}</p>`
    : '<div style="height:10px;"></div>';

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:28px 18px;${FONT} font-size:15px; line-height:1.62; color:${INK}; background:#ffffff;">
  <div style="max-width:520px;">

    <div style="width:34px; height:3px; background:${ACCENT}; font-size:0; line-height:0;">&nbsp;</div>
    <p style="margin:11px 0 26px;${FONT} font-size:12px; line-height:1.4; color:${MUTED};">Criminal Crisis</p>

    <p style="margin:0 0 5px;${FONT} font-size:21px; line-height:1.3; font-weight:600; color:${INK};">${escapeHtml(c.campaignTitle)}</p>
    ${releaseLine}

    ${c.isReminder ? `<p style="${BODY}">${REMINDER_LINE}</p>` : ''}
    ${intro}
    ${tracks}

    <p style="margin:0 0 24px;${FONT} font-size:16px; line-height:1.5;"><a href="${escapeHtml(c.promoUrl)}" style="color:${ACCENT}; font-weight:600;">${linkLabel(c.downloadEnabled)}</a></p>

    <p style="${BODY}">If you have a minute to say what you think, it genuinely helps.</p>

    <p style="${BODY}">Thanks,<br>Criminal Crisis</p>

    <div style="border-top:1px solid ${RULE}; margin:30px 0 13px; font-size:0; line-height:0;">&nbsp;</div>
    <p style="margin:0;${FONT} font-size:12px; line-height:1.5; color:${MUTED};">
      You're getting this because you're on our promo list.
      <a href="${escapeHtml(c.unsubscribeUrl)}" style="color:${MUTED};">Unsubscribe</a>
    </p>

  </div>
</body>
</html>`;
}

export function renderPromoText(c: PromoEmailContent): string {
  const lines: string[] = ['Criminal Crisis', '', c.campaignTitle];

  if (c.releaseDate) lines.push(`Out ${c.releaseDate}`);
  lines.push('');

  if (c.isReminder) lines.push(REMINDER_LINE, '');
  if (c.bodyIntro) lines.push(c.bodyIntro.trim(), '');

  if (c.trackTitles.length) {
    c.trackTitles.forEach((t, i) =>
      lines.push(c.trackTitles.length > 1 ? `${String(i + 1).padStart(2, '0')}  ${t}` : t)
    );
    lines.push('');
  }

  lines.push(
    `${linkLabel(c.downloadEnabled)}:`,
    c.promoUrl,
    '',
    'If you have a minute to say what you think, it genuinely helps.',
    '',
    'Thanks,',
    'Criminal Crisis',
    '',
    "You're getting this because you're on our promo list.",
    `Unsubscribe: ${c.unsubscribeUrl}`
  );

  return lines.join('\n');
}
