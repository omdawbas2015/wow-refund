/**
 * HTML body for the CUSTOMER_PROMO_COMPENSATION email.
 *
 * Pixel-mapped to the Chipotle "$X OFF EXCLUSIVELY FOR YOU" promo email
 * (reference image attached to the original campaign brief). Layout:
 *
 *   1. Header (white)            — Chipotle logo + "View in Browser"
 *   2. Hero (dark red gradient)  — bowl image (left) | "$VALUE OFF /
 *                                  EXCLUSIVELY / FOR YOU" stack |
 *                                  burrito image (right)
 *   3. Description               — "Use the Promo Code on your next order…"
 *   4. Channel icons             — Online Order / Pickup / Delivery (single
 *                                  strip image, matches reference exactly)
 *   5. Ticket coupon             — brown PROMO CODE stub + dashed white
 *                                  panel with the promo code
 *   6. Expires line              — small uppercase
 *   7. ORDER NOW CTA             — pill button (#6E1414)
 *   8. Crave more section        — menu list + EXPLORE MENU button
 *   9. Footer                    — small Chipotle logo + address +
 *                                  Instagram / Facebook / X / YouTube row
 *
 * All Chipotle imagery (logo, bowl, burrito, channel icons, social icons)
 * is hard-pinned to URLs cropped directly from the campaign reference and
 * uploaded to permanent storage. The HTML is 600px wide, table-based,
 * inline CSS, web-safe fonts (Helvetica Neue → Arial → sans-serif).
 *
 * Dynamic placeholders (replaced by dispatcher's {{var}} renderer):
 *   customerName, brandName, value, currency, promoCode, expiresAt,
 *   orderUrl, websiteUrl, brandAddress, brandCopyright.
 *
 * NOTE: written as a single-quoted concatenated string (NOT a template
 * literal) so the dispatcher's `{{placeholder}}` syntax never collides
 * with JS `${}` interpolation.
 */

// Chipotle reference assets — committed under apps/web/public/email and
// served from GitHub raw at a pinned commit SHA so the URLs are stable
// even when this branch is later merged or deleted.
const ASSET_BASE =
  'https://raw.githubusercontent.com/omdawbas2015/wow-refund/37efed7b01ccad8939d92d78d0de6287476816ad/apps/web/public/email';
const LOGO_HEADER = ASSET_BASE + '/header_logo.png';
const HERO_BOWL = ASSET_BASE + '/bowl.png';
const HERO_BURRITO = ASSET_BASE + '/burrito.png';
const CHANNEL_ICONS = ASSET_BASE + '/icons_row.png';
const LOGO_FOOTER = ASSET_BASE + '/footer_logo.png';
const SOCIAL_ICONS = ASSET_BASE + '/socials.png';

// Brand palette (per spec)
const RED = '#8B1E1E';
const RED_DARK = '#6E1414';

export const CUSTOMER_PROMO_COMPENSATION_HTML_EN =
  '<!doctype html>\n' +
  '<html lang="en">\n' +
  '<head>\n' +
  '<meta charset="utf-8" />\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1" />\n' +
  '<meta name="x-apple-disable-message-reformatting" />\n' +
  '<title>{{value}} {{currency}} OFF — exclusively for you from {{brandName}}</title>\n' +
  '</head>\n' +
  '<body style="margin:0;padding:0;background:#f5f5f5;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;color:#111111;-webkit-text-size-adjust:100%;">\n' +
  // preheader (hidden)
  '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">' +
  '{{value}} {{currency}} OFF — exclusively for you from {{brandName}}.' +
  '</div>\n' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;">\n' +
  '<tr><td align="center" style="padding:24px 12px;">\n' +
  '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-collapse:separate;">\n' +
  // ─── 1. HEADER ───────────────────────────────────────────────
  '<tr><td style="padding:20px 28px 16px 28px;background:#ffffff;">\n' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">\n' +
  '<tr>\n' +
  '<td align="left" style="vertical-align:middle;">' +
  '<img src="' +
  LOGO_HEADER +
  '" alt="{{brandName}}" height="44" style="display:block;height:44px;border:0;outline:none;text-decoration:none;" />' +
  '</td>\n' +
  '<td align="right" style="vertical-align:middle;font-size:11px;color:#666666;letter-spacing:.3px;">' +
  '<a href="{{orderUrl}}" style="color:#666666;text-decoration:none;">View in Browser</a>' +
  '</td>\n' +
  '</tr>\n' +
  '</table>\n' +
  '</td></tr>\n' +
  // ─── 2. HERO (red gradient + bowl + text stack + burrito) ────
  '<tr><td style="padding:0;background:' +
  RED_DARK +
  ';background-image:linear-gradient(135deg,' +
  RED_DARK +
  ' 0%,' +
  RED +
  ' 60%,' +
  RED_DARK +
  ' 100%);">\n' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">\n' +
  '<tr>\n' +
  // left bowl
  '<td valign="bottom" align="left" width="180" style="width:180px;padding:0;">' +
  '<img src="' +
  HERO_BOWL +
  '" alt="" width="180" height="220" style="display:block;width:180px;height:220px;object-fit:cover;border:0;outline:none;text-decoration:none;" />' +
  '</td>\n' +
  // center text stack — three white blocks, exactly like the reference
  '<td align="center" style="padding:48px 4px 40px 4px;color:#ffffff;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;text-align:center;">' +
  '<div style="background:#ffffff;color:' +
  RED_DARK +
  ';display:inline-block;padding:10px 22px;font-size:42px;line-height:1;font-weight:900;letter-spacing:1px;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;">' +
  '<span style="vertical-align:top;font-size:26px;font-weight:900;">$</span>{{value}} OFF' +
  '</div>\n' +
  '<div style="margin-top:10px;background:#ffffff;color:' +
  RED_DARK +
  ';display:inline-block;padding:8px 20px;font-size:30px;line-height:1;font-weight:900;letter-spacing:1px;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;">' +
  'EXCLUSIVELY' +
  '</div>\n' +
  '<div style="margin-top:8px;background:#ffffff;color:' +
  RED_DARK +
  ';display:inline-block;padding:8px 16px;font-size:22px;line-height:1;font-weight:900;letter-spacing:1px;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;">' +
  'FOR YOU' +
  '</div>' +
  '</td>\n' +
  // right burrito
  '<td valign="bottom" align="right" width="180" style="width:180px;padding:0;">' +
  '<img src="' +
  HERO_BURRITO +
  '" alt="" width="180" height="220" style="display:block;width:180px;height:220px;object-fit:cover;border:0;outline:none;text-decoration:none;" />' +
  '</td>\n' +
  '</tr>\n' +
  '</table>\n' +
  '</td></tr>\n' +
  // ─── 3. DESCRIPTION ──────────────────────────────────────────
  '<tr><td align="center" style="padding:36px 28px 8px 28px;color:#111111;font-size:15px;line-height:1.55;">' +
  'Use the <strong>Promo Code</strong> on your next order' +
  '<br/>' +
  'on <a href="{{websiteUrl}}" style="color:' +
  RED +
  ';text-decoration:none;font-weight:600;">chipotle.com</a> or in the <strong>{{brandName}}</strong> app.' +
  '</td></tr>\n' +
  // ─── 4. CHANNEL ICONS (single strip) ─────────────────────────
  '<tr><td align="center" style="padding:24px 28px 4px 28px;">\n' +
  '<img src="' +
  CHANNEL_ICONS +
  '" alt="Online Order | Pickup | Delivery" width="540" style="display:block;width:100%;max-width:540px;height:auto;border:0;outline:none;text-decoration:none;" />' +
  '</td></tr>\n' +
  // ─── 5. TICKET COUPON ────────────────────────────────────────
  '<tr><td align="center" style="padding:30px 28px 8px 28px;">\n' +
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;box-shadow:0 4px 14px rgba(0,0,0,0.08);">\n' +
  '<tr>\n' +
  // brown PROMO CODE stub (left)
  '<td style="background:' +
  RED_DARK +
  ';color:#ffffff;padding:24px 14px;font-size:11px;font-weight:700;letter-spacing:2px;line-height:1.15;text-align:center;width:84px;border-top-left-radius:8px;border-bottom-left-radius:8px;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;">' +
  'PROMO<br/>CODE' +
  '</td>\n' +
  // dashed white panel with the code (right)
  '<td style="background:#ffffff;border:2px dashed ' +
  RED +
  ';border-left:0;padding:24px 36px;font-size:32px;font-weight:900;letter-spacing:3px;color:' +
  RED_DARK +
  ';text-align:center;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;border-top-right-radius:8px;border-bottom-right-radius:8px;">' +
  '{{promoCode}}' +
  '</td>\n' +
  '</tr>\n' +
  '</table>\n' +
  '</td></tr>\n' +
  // ─── 6. EXPIRES ──────────────────────────────────────────────
  '<tr><td align="center" style="padding:14px 28px 4px 28px;font-size:11px;color:#666666;letter-spacing:2px;font-weight:600;">' +
  'EXPIRES {{expiresAt}}' +
  '</td></tr>\n' +
  // ─── 7. ORDER NOW CTA ────────────────────────────────────────
  '<tr><td align="center" style="padding:24px 28px 36px 28px;">\n' +
  '<a href="{{orderUrl}}" style="background:' +
  RED_DARK +
  ';color:#ffffff;text-decoration:none;display:inline-block;padding:16px 64px;border-radius:32px;font-size:13px;font-weight:700;letter-spacing:2px;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;">' +
  'ORDER NOW' +
  '</a>\n' +
  '</td></tr>\n' +
  // ─── 8. CRAVE MORE ───────────────────────────────────────────
  '<tr><td align="center" style="background:#ffffff;border-top:1px solid #ececec;padding:36px 28px 32px 28px;">\n' +
  '<div style="background:' +
  RED_DARK +
  ';color:#ffffff;width:36px;height:36px;line-height:36px;border-radius:18px;display:inline-block;font-size:18px;font-weight:700;margin-bottom:14px;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;">★</div>\n' +
  '<div style="font-size:15px;color:#111111;margin-bottom:14px;line-height:1.4;">Crave more? Get your favorites your way.</div>\n' +
  '<div style="font-size:12px;font-weight:700;color:#111111;letter-spacing:2px;line-height:2;">' +
  'BURRITOS &nbsp;|&nbsp; BOWLS &nbsp;|&nbsp; TACOS &nbsp;|&nbsp; SALADS<br/>' +
  'QUESADILLAS &nbsp;|&nbsp; KID\'S MENU &nbsp;|&nbsp; CATERING' +
  '</div>\n' +
  '<div style="margin-top:20px;">' +
  '<a href="{{websiteUrl}}" style="display:inline-block;border:2px solid ' +
  RED_DARK +
  ';color:' +
  RED_DARK +
  ';text-decoration:none;padding:12px 36px;border-radius:32px;font-size:12px;font-weight:700;letter-spacing:2px;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;">' +
  'EXPLORE MENU' +
  '</a>' +
  '</div>\n' +
  '</td></tr>\n' +
  // ─── 9. FOOTER ──────────────────────────────────────────────
  '<tr><td style="background:#f5f5f5;padding:24px 28px;">\n' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">\n' +
  '<tr>\n' +
  '<td style="vertical-align:top;width:60%;">' +
  '<img src="' +
  LOGO_FOOTER +
  '" alt="{{brandName}}" height="36" style="display:block;height:36px;border:0;" />' +
  '<div style="margin-top:12px;font-size:11px;color:#666666;line-height:1.6;">' +
  'This email was sent by {{brandName}}.<br/>' +
  '{{brandAddress}}<br/>' +
  '{{brandCopyright}}<br/>' +
  '<a href="{{orderUrl}}" style="color:#666666;text-decoration:underline;">Unsubscribe</a>' +
  '</div>' +
  '</td>\n' +
  '<td align="right" style="vertical-align:top;font-size:11px;color:#666666;letter-spacing:2px;font-weight:700;">' +
  '<div style="margin-bottom:10px;">FOLLOW US</div>' +
  '<img src="' +
  SOCIAL_ICONS +
  '" alt="Instagram Facebook X YouTube" width="180" style="display:block;width:180px;height:auto;border:0;outline:none;text-decoration:none;" />' +
  '</td>\n' +
  '</tr>\n' +
  '</table>\n' +
  '</td></tr>\n' +
  '</table>\n' +
  '</td></tr>\n' +
  '</table>\n' +
  '</body>\n' +
  '</html>';
