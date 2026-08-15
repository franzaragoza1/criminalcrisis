/**
 * Promo email template.
 *
 * Written to reach Gmail's Primary tab, not to look good. The first version was
 * a proper HTML email — artwork, a black CTA button, uppercase headings, table
 * layout — and Gmail filed the entire first campaign under Promotions, where
 * 200 recipients produced zero opens.
 *
 * Every one of those is a promotional signal. So: no images, no buttons, no
 * tables, no uppercase, no letter-spacing, no preheader. A short note with one
 * underlined text link, which is what a person writing to another person
 * actually sends.
 *
 * `List-Unsubscribe` (set in the transport) is itself a bulk signal, but Gmail
 * requires it from bulk senders and its absence risks the spam folder outright.
 * Promotions is a worse tab; spam is a worse outcome. It stays.
 *
 * If you're tempted to make this prettier, check the Primary/Promotions split
 * first — that trade has already been lost once.
 */

const INK = '#111111';
const MUTED = '#767676';

export type PromoEmailContent = {
  campaignTitle: string;
  bodyIntro: string | null;
  releaseDate: string | null;
  trackTitles: string[];
  promoUrl: string;
  unsubscribeUrl: string;
  downloadEnabled: boolean;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderPromoHtml(c: PromoEmailContent): string {
  const font = "font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;";
  const p = `margin:0 0 14px;${font} font-size:15px; line-height:1.55; color:${INK};`;

  const intro = c.bodyIntro
    ? c.bodyIntro
        .split(/\n{2,}/)
        .map(t => `<p style="${p}">${escapeHtml(t).replace(/\n/g, '<br>')}</p>`)
        .join('')
    : '';

  // Plain numbered lines. A table here reads as newsletter layout.
  const tracks = c.trackTitles.length
    ? `<p style="${p}">${c.trackTitles.map((t, i) => `${i + 1}. ${escapeHtml(t)}`).join('<br>')}</p>`
    : '';

  const releaseLine = c.releaseDate
    ? `<p style="${p}">Out ${escapeHtml(c.releaseDate)}.</p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:16px;${font} font-size:15px; line-height:1.55; color:${INK}; background:#ffffff;">
  <div style="max-width:520px;">

    <p style="${p}">${escapeHtml(c.campaignTitle)} is finished, and I wanted you to have it before it's out.</p>

    ${releaseLine}
    ${intro}
    ${tracks}

    <p style="${p}"><a href="${escapeHtml(c.promoUrl)}" style="color:${INK};">${escapeHtml(c.promoUrl)}</a></p>

    <p style="${p}">
      That link is just for you, so please don't pass it on.${c.downloadEnabled ? " You can listen there or take the files." : ''}
      If you have a minute to say what you think, it genuinely helps.
    </p>

    <p style="${p}">Thanks,<br>Criminal Crisis</p>

    <p style="margin:26px 0 0;${font} font-size:12px; line-height:1.5; color:${MUTED};">
      You're getting this because you're on our promo list.
      <a href="${escapeHtml(c.unsubscribeUrl)}" style="color:${MUTED};">Unsubscribe</a>
    </p>

  </div>
</body>
</html>`;
}

export function renderPromoText(c: PromoEmailContent): string {
  const lines: string[] = [
    `${c.campaignTitle} is finished, and I wanted you to have it before it's out.`,
  ];

  if (c.releaseDate) lines.push(`Out ${c.releaseDate}.`);
  lines.push('');

  if (c.bodyIntro) lines.push(c.bodyIntro.trim(), '');

  if (c.trackTitles.length) {
    c.trackTitles.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    lines.push('');
  }

  lines.push(
    c.promoUrl,
    '',
    "That link is just for you, so please don't pass it on." +
      (c.downloadEnabled ? ' You can listen there or take the files.' : ''),
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
