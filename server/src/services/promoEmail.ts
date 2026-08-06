/**
 * Promo email template.
 *
 * Deliberately plain: one small artwork image, system fonts, a single link, no
 * tracking pixel and no link shortener. Image-heavy, script-heavy or
 * shortener-laden mail is exactly what filters downrank, and a promo that lands
 * in the inbox beats a prettier one that lands in spam.
 *
 * The site's brand font (ABCCamera) is a web font and will not load in most mail
 * clients, so the template uses a Helvetica stack and keeps the identity through
 * layout, capitals and the accent red instead.
 */

const RED = '#C8302B';
const INK = '#111111';
const MUTED = '#767676';

export type PromoEmailContent = {
  contactName: string | null;
  campaignTitle: string;
  bodyIntro: string | null;
  artworkUrl: string | null;
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

const greeting = (name: string | null) => (name ? `Hi ${name.split(' ')[0]},` : 'Hi,');

export function renderPromoHtml(c: PromoEmailContent): string {
  const font = "font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;";
  const intro = c.bodyIntro
    ? c.bodyIntro
        .split(/\n{2,}/)
        .map(p => `<p style="margin:0 0 16px;${font} font-size:15px; line-height:1.6; color:${INK};">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('')
    : '';

  const tracks = c.trackTitles.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        ${c.trackTitles
          .map(
            (t, i) => `<tr>
              <td style="${font} font-size:13px; color:${MUTED}; padding:3px 12px 3px 0; font-variant-numeric:tabular-nums;">${String(i + 1).padStart(2, '0')}</td>
              <td style="${font} font-size:14px; color:${INK}; padding:3px 0;">${escapeHtml(t)}</td>
            </tr>`
          )
          .join('')}
      </table>`
    : '';

  const artwork = c.artworkUrl
    ? `<img src="${escapeHtml(c.artworkUrl)}" width="200" height="200" alt="${escapeHtml(c.campaignTitle)}"
         style="display:block; width:200px; height:200px; border:0; margin:0 0 24px;">`
    : '';

  // DJs are meant to play promos out before release — the only ask is that the
  // files don't get uploaded. "Embargo" would say the opposite.
  const releaseLine = c.releaseDate
    ? `<p style="margin:0 0 24px;${font} font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:${RED};">
         Out ${escapeHtml(c.releaseDate)}
       </p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(c.campaignTitle)}</title>
</head>
<body style="margin:0; padding:0; background:#FAFAFA;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
    ${escapeHtml(c.campaignTitle)} — private promo${c.downloadEnabled ? ', stream and download' : ', streaming'} inside.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAFAFA;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
          <tr><td>

            <p style="margin:0 0 32px;${font} font-size:12px; letter-spacing:0.22em; text-transform:uppercase; color:${INK}; font-weight:bold;">
              Criminal Crisis
            </p>

            <p style="margin:0 0 16px;${font} font-size:15px; line-height:1.6; color:${INK};">${escapeHtml(greeting(c.contactName))}</p>

            <h1 style="margin:0 0 8px;${font} font-size:26px; line-height:1.15; text-transform:uppercase; color:${INK}; font-weight:bold;">
              ${escapeHtml(c.campaignTitle)}
            </h1>

            ${releaseLine}
            ${artwork}
            ${intro}
            ${tracks}

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
              <tr><td style="background:${INK};">
                <a href="${escapeHtml(c.promoUrl)}"
                   style="display:inline-block; padding:15px 32px;${font} font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#FAFAFA; text-decoration:none; font-weight:bold;">
                  ${c.downloadEnabled ? 'Listen &amp; download' : 'Listen'}
                </a>
              </td></tr>
            </table>

            <p style="margin:0 0 28px;${font} font-size:13px; line-height:1.6; color:${MUTED};">
              This link is personal to you, so please don't forward it.
              Feedback on any track is very welcome on the same page — it genuinely helps.
            </p>

            <div style="border-top:1px solid #E0E0E0; padding-top:16px;">
              <p style="margin:0 0 6px;${font} font-size:11px; line-height:1.6; color:${MUTED};">
                You're receiving this because you're on the Criminal Crisis promo list.
              </p>
              <p style="margin:0;${font} font-size:11px; line-height:1.6; color:${MUTED};">
                <a href="${escapeHtml(c.unsubscribeUrl)}" style="color:${MUTED}; text-decoration:underline;">Unsubscribe</a>
                &nbsp;·&nbsp; criminalcrisis.com
              </p>
            </div>

          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderPromoText(c: PromoEmailContent): string {
  const lines: string[] = [
    'CRIMINAL CRISIS',
    '',
    greeting(c.contactName),
    '',
    c.campaignTitle.toUpperCase(),
  ];

  if (c.releaseDate) lines.push(`Out ${c.releaseDate}`);
  lines.push('');

  if (c.bodyIntro) lines.push(c.bodyIntro.trim(), '');

  if (c.trackTitles.length) {
    c.trackTitles.forEach((t, i) => lines.push(`${String(i + 1).padStart(2, '0')}  ${t}`));
    lines.push('');
  }

  lines.push(
    c.downloadEnabled ? 'Listen and download:' : 'Listen:',
    c.promoUrl,
    '',
    "This link is personal to you, so please don't forward it.",
    'Feedback on any track is very welcome on the same page — it genuinely helps.',
    '',
    '—',
    "You're receiving this because you're on the Criminal Crisis promo list.",
    `Unsubscribe: ${c.unsubscribeUrl}`,
    'criminalcrisis.com'
  );

  return lines.join('\n');
}
