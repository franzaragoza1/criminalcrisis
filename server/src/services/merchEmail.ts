/**
 * Pre-save confirmation email.
 *
 * This is transactional mail, so none of the promo template's restraint
 * applies (see promoEmail.ts): someone who just reserved a shirt expects a
 * receipt that looks like it came from a shop — logo, product photo, a summary
 * box. Gmail files that kind of mail under Primary/Updates when it is sent one
 * at a time, in response to an action, without List-Unsubscribe.
 *
 * Layout is tables with inline styles because that is what Outlook and Gmail
 * still render reliably. Images are absolute URLs on the public site; email
 * clients will not resolve relative paths.
 */

import { siteUrl } from './promoQueue.js';

const INK = '#111111';
const MUTED = '#767676';
const RULE = '#e6e6e6';
const PANEL = '#f6f6f6';
const ACCENT = '#C8302B';

const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;";

export type MerchConfirmation = {
  reservationId: number;
  name: string | null;
  productName: string;
  productImage: string;
  size: string;
  price: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Short, human-readable reference to quote back when replying. */
export const reservationRef = (id: number) => `CC-${String(id).padStart(4, '0')}`;

export const merchConfirmationSubject = (c: MerchConfirmation) =>
  `Reserva confirmada: ${c.productName} (talla ${c.size})`;

const STEPS = [
  ['Llegan las camisetas', 'Tu talla queda apartada hasta que tengamos el stock.'],
  ['Te escribimos', 'Te enviamos un email para confirmar la talla, el pago y la dirección de envío.'],
  ['Te la enviamos', 'En cuanto se complete el pago, sale hacia tu casa.'],
];

export function renderMerchConfirmationHtml(c: MerchConfirmation): string {
  const site = siteUrl();
  const greeting = c.name ? `Hola ${escapeHtml(c.name.split(/\s+/)[0])},` : 'Hola,';
  const ref = reservationRef(c.reservationId);

  const steps = STEPS.map(([title, body], i) => `
              <tr>
                <td width="34" valign="top" style="padding:0 0 16px;">
                  <div style="width:24px; height:24px; border-radius:12px; background:${INK}; color:#ffffff; ${FONT} font-size:12px; font-weight:700; line-height:24px; text-align:center;">${i + 1}</div>
                </td>
                <td valign="top" style="padding:2px 0 16px; ${FONT} font-size:14px; line-height:1.5; color:${INK};">
                  <strong>${title}</strong><br><span style="color:${MUTED};">${body}</span>
                </td>
              </tr>`).join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Reserva confirmada</title>
</head>
<body style="margin:0; padding:0; background:#ececec;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">Tu ${escapeHtml(c.productName)} en talla ${escapeHtml(c.size)} queda reservada. No se ha hecho ningún cargo.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ececec" style="background:#ececec;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:560px; background:#ffffff;">

          <tr><td height="5" bgcolor="${ACCENT}" style="background:${ACCENT}; font-size:0; line-height:0;">&nbsp;</td></tr>

          <tr>
            <td align="center" bgcolor="#ffffff" style="padding:36px 32px 28px; background:#ffffff;">
              <a href="${site}" style="text-decoration:none;">
                <img src="${site}/img/logos/logo_header.png" width="240" alt="Criminal Crisis" style="display:block; width:240px; max-width:100%; height:auto; border:0;">
              </a>
            </td>
          </tr>

          <tr><td style="padding:0 32px;"><div style="border-top:1px solid ${RULE}; font-size:0; line-height:0;">&nbsp;</div></td></tr>

          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 6px; ${FONT} font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:${ACCENT};">Pre-Save confirmado</p>
              <h1 style="margin:0 0 20px; ${FONT} font-size:26px; line-height:1.25; font-weight:800; color:${INK};">Tu camiseta está reservada</h1>
              <p style="margin:0 0 14px; ${FONT} font-size:15px; line-height:1.6; color:${INK};">${greeting}</p>
              <p style="margin:0 0 14px; ${FONT} font-size:15px; line-height:1.6; color:${INK};">Gracias por apoyar al sello. Hemos apartado tu talla y serás de los primeros en tenerla cuando llegue el stock.</p>
              <p style="margin:0; ${FONT} font-size:15px; line-height:1.6; color:${INK};"><strong>No se ha hecho ningún cargo.</strong> Te escribiremos para cerrar el pedido antes de cobrarte nada.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PANEL}" style="background:${PANEL};">
                <tr>
                  <td colspan="2" style="padding:14px 18px; border-bottom:1px solid ${RULE}; ${FONT} font-size:12px; color:${MUTED};">
                    Reserva <strong style="color:${INK};">${ref}</strong>
                  </td>
                </tr>
                <tr>
                  <td width="112" valign="top" style="padding:18px 0 18px 18px;">
                    <img src="${escapeHtml(c.productImage)}" width="94" alt="${escapeHtml(c.productName)}" style="display:block; width:94px; height:auto; border:0;">
                  </td>
                  <td valign="top" style="padding:18px 18px 18px 14px; ${FONT} font-size:14px; line-height:1.6; color:${INK};">
                    <strong style="font-size:16px;">${escapeHtml(c.productName)}</strong><br>
                    <span style="color:${MUTED};">Talla:</span> ${escapeHtml(c.size)}<br>
                    <span style="color:${MUTED};">Cantidad:</span> 1<br>
                    <span style="color:${MUTED};">Precio:</span> ${c.price} €
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:14px 18px; border-top:1px solid ${RULE}; ${FONT} font-size:14px; color:${INK};">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="${FONT} font-size:14px; color:${INK};">Pagado hoy</td>
                        <td align="right" style="${FONT} font-size:14px; font-weight:700; color:${INK};">0 €</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px 4px;">
              <p style="margin:0 0 18px; ${FONT} font-size:16px; font-weight:800; color:${INK};">Qué pasa ahora</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${steps}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:4px 32px 32px;">
              <p style="margin:0; ${FONT} font-size:14px; line-height:1.6; color:${MUTED};">¿Quieres cambiar de talla o anular la reserva? Responde a este email indicando tu número de reserva y lo cambiamos.</p>
            </td>
          </tr>

          <tr>
            <td align="center" bgcolor="${INK}" style="padding:28px 32px; background:${INK};">
              <p style="margin:0 0 6px; ${FONT} font-size:13px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#ffffff;">Criminal Crisis</p>
              <p style="margin:0 0 14px; ${FONT} font-size:12px; color:#a3a3a3;">Banging Boogie Bangers</p>
              <a href="${site}" style="${FONT} font-size:12px; color:#ffffff; text-decoration:underline;">criminalcrisis.com</a>
            </td>
          </tr>

        </table>
        <p style="margin:18px 0 0; ${FONT} font-size:11px; line-height:1.5; color:${MUTED}; text-align:center;">Recibes este email porque has hecho una reserva en criminalcrisis.com.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderMerchConfirmationText(c: MerchConfirmation): string {
  const site = siteUrl();
  return [
    'CRIMINAL CRISIS',
    '',
    'Pre-Save confirmado: tu camiseta está reservada',
    '',
    c.name ? `Hola ${c.name.split(/\s+/)[0]},` : 'Hola,',
    '',
    'Gracias por apoyar al sello. Hemos apartado tu talla y serás de los primeros en tenerla cuando llegue el stock.',
    'No se ha hecho ningún cargo. Te escribiremos para cerrar el pedido antes de cobrarte nada.',
    '',
    `Reserva ${reservationRef(c.reservationId)}`,
    `${c.productName}`,
    `Talla: ${c.size}`,
    'Cantidad: 1',
    `Precio: ${c.price} €`,
    'Pagado hoy: 0 €',
    '',
    'Qué pasa ahora',
    ...STEPS.map(([title, body], i) => `${i + 1}. ${title}. ${body}`),
    '',
    '¿Quieres cambiar de talla o anular la reserva? Responde a este email indicando tu número de reserva.',
    '',
    'Criminal Crisis',
    site,
  ].join('\n');
}
