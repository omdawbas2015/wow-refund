/**
 * HTML body for the CUSTOMER_PROMO_COMPENSATION email.
 *
 * Mirrors the visual structure of a Chipotle "$X OFF EXCLUSIVELY FOR YOU"
 * promo email: brand logo header, big "OFF" hero banner, ordering icons,
 * ticket-style promo code with expiry, ORDER NOW CTA, "Crave more" footer
 * with brand logo + copyright + social icons.
 *
 * Email-safe (table layout, inline CSS, web-safe fonts). Designed to render
 * in Outlook / Gmail / Apple Mail without breakage.
 *
 * Placeholders used: customerName, brandName, brandLogoUrl, promoCode,
 * value, currency, expiresAt, orderUrl, websiteUrl, brandAddress,
 * brandCopyright, brandColor, brandColorAccent.
 *
 * NOTE: Written as a single-quoted concatenated string (NOT a template
 * literal) so the renderer's `{{placeholder}}` syntax never collides with
 * JS `${}` interpolation. Do not change to backticks.
 */

export const CUSTOMER_PROMO_COMPENSATION_HTML_EN =
  '<!doctype html>\n' +
  '<html lang="en">\n' +
  '<head>\n' +
  '<meta charset="utf-8" />\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
  '<title>Your promo from {{brandName}}</title>\n' +
  '</head>\n' +
  '<body style="margin:0;padding:0;background:#f5f0e6;font-family:Helvetica,Arial,sans-serif;color:#2b1b10;">\n' +
  '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">' +
  '{{value}} {{currency}} OFF — exclusively for you from {{brandName}}.' +
  '</div>\n' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f0e6;">\n' +
  '<tr><td align="center" style="padding:24px 12px;">\n' +
  '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:6px;overflow:hidden;">\n' +
  // Header: brand logo + view in browser
  '<tr><td style="padding:20px 24px;background:#ffffff;border-bottom:1px solid #ece4d6;">\n' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">\n' +
  '<tr>\n' +
  '<td align="left" style="vertical-align:middle;">' +
  '<img src="{{brandLogoUrl}}" alt="{{brandName}}" height="48" style="display:block;max-height:48px;border:0;outline:none;text-decoration:none;" />' +
  '</td>\n' +
  '<td align="right" style="vertical-align:middle;font-size:11px;color:#7a6b5a;">' +
  '<a href="{{orderUrl}}" style="color:#7a6b5a;text-decoration:none;">View in Browser</a>' +
  '</td>\n' +
  '</tr>\n' +
  '</table>\n' +
  '</td></tr>\n' +
  // Hero banner: $VALUE OFF EXCLUSIVELY FOR YOU
  '<tr><td style="padding:0;background:{{brandColor}};">\n' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">\n' +
  '<tr><td align="center" style="padding:56px 24px;color:#ffffff;text-align:center;">\n' +
  '<div style="background:#ffffff;color:{{brandColor}};display:inline-block;padding:14px 28px;font-size:46px;line-height:1;font-weight:900;letter-spacing:1px;">' +
  '{{value}} {{currency}} OFF' +
  '</div>\n' +
  '<div style="margin-top:14px;background:#ffffff;color:{{brandColor}};display:inline-block;padding:10px 22px;font-size:30px;line-height:1;font-weight:900;letter-spacing:1px;">' +
  'EXCLUSIVELY' +
  '</div>\n' +
  '<div style="margin-top:10px;background:#ffffff;color:{{brandColor}};display:inline-block;padding:8px 18px;font-size:22px;line-height:1;font-weight:900;letter-spacing:1px;">' +
  'FOR YOU' +
  '</div>\n' +
  '</td></tr>\n' +
  '</table>\n' +
  '</td></tr>\n' +
  // Intro line + ordering channels
  '<tr><td align="center" style="padding:32px 24px 8px 24px;color:#2b1b10;">\n' +
  '<div style="font-size:16px;line-height:1.5;">Hi {{customerName}}, use the <strong>Promo Code</strong> on your next order</div>\n' +
  '<div style="font-size:16px;line-height:1.5;">on the <strong>{{brandName}}</strong> website or app.</div>\n' +
  '</td></tr>\n' +
  '<tr><td align="center" style="padding:18px 24px 8px 24px;">\n' +
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0">\n' +
  '<tr>\n' +
  '<td align="center" style="padding:0 14px;font-size:12px;color:{{brandColor}};letter-spacing:1px;font-weight:700;">\n' +
  '<div style="font-size:20px;">📱</div>\n' +
  '<div style="margin-top:4px;">ONLINE ORDER</div>\n' +
  '</td>\n' +
  '<td style="color:#d6cab6;font-size:18px;padding:0 4px;">|</td>\n' +
  '<td align="center" style="padding:0 14px;font-size:12px;color:{{brandColor}};letter-spacing:1px;font-weight:700;">\n' +
  '<div style="font-size:20px;">🛍️</div>\n' +
  '<div style="margin-top:4px;">PICKUP</div>\n' +
  '</td>\n' +
  '<td style="color:#d6cab6;font-size:18px;padding:0 4px;">|</td>\n' +
  '<td align="center" style="padding:0 14px;font-size:12px;color:{{brandColor}};letter-spacing:1px;font-weight:700;">\n' +
  '<div style="font-size:20px;">🚚</div>\n' +
  '<div style="margin-top:4px;">DELIVERY</div>\n' +
  '</td>\n' +
  '</tr>\n' +
  '</table>\n' +
  '</td></tr>\n' +
  // Promo code ticket
  '<tr><td align="center" style="padding:28px 24px 8px 24px;">\n' +
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">\n' +
  '<tr>\n' +
  '<td style="background:{{brandColor}};color:#ffffff;padding:18px 16px;font-size:13px;font-weight:700;letter-spacing:2px;line-height:1.1;text-align:center;width:78px;border-top-left-radius:6px;border-bottom-left-radius:6px;">' +
  'PROMO<br/>CODE' +
  '</td>\n' +
  '<td style="background:#ffffff;border:2px solid {{brandColor}};padding:18px 28px;font-size:30px;font-weight:900;letter-spacing:2px;color:{{brandColor}};text-align:center;border-top-right-radius:6px;border-bottom-right-radius:6px;">' +
  '{{promoCode}}' +
  '</td>\n' +
  '</tr>\n' +
  '</table>\n' +
  '</td></tr>\n' +
  '<tr><td align="center" style="padding:8px 24px 4px 24px;font-size:12px;color:#7a6b5a;letter-spacing:2px;font-weight:700;">' +
  'EXPIRES {{expiresAt}}' +
  '</td></tr>\n' +
  // ORDER NOW button
  '<tr><td align="center" style="padding:24px 24px 32px 24px;">\n' +
  '<a href="{{orderUrl}}" style="background:{{brandColor}};color:#ffffff;text-decoration:none;display:inline-block;padding:16px 56px;border-radius:32px;font-size:14px;font-weight:700;letter-spacing:2px;">' +
  'ORDER NOW' +
  '</a>\n' +
  '</td></tr>\n' +
  // Crave more section
  '<tr><td align="center" style="background:#ffffff;border-top:1px solid #ece4d6;padding:32px 24px;">\n' +
  '<div style="background:{{brandColor}};color:#ffffff;width:36px;height:36px;line-height:36px;border-radius:18px;display:inline-block;font-size:18px;font-weight:700;margin-bottom:12px;">★</div>\n' +
  '<div style="font-size:16px;color:#2b1b10;margin-bottom:14px;">Crave more? Get your favorites your way.</div>\n' +
  '<div style="font-size:13px;font-weight:700;color:{{brandColor}};letter-spacing:2px;line-height:1.8;">' +
  'BURRITOS &nbsp;|&nbsp; BOWLS &nbsp;|&nbsp; TACOS &nbsp;|&nbsp; SALADS<br/>' +
  'QUESADILLAS &nbsp;|&nbsp; KID\'S MENU &nbsp;|&nbsp; CATERING' +
  '</div>\n' +
  '<div style="margin-top:18px;">' +
  '<a href="{{websiteUrl}}" style="display:inline-block;border:2px solid {{brandColor}};color:{{brandColor}};text-decoration:none;padding:12px 36px;border-radius:32px;font-size:13px;font-weight:700;letter-spacing:2px;">' +
  'EXPLORE MENU' +
  '</a>' +
  '</div>\n' +
  '</td></tr>\n' +
  // Footer: brand logo + address + social
  '<tr><td style="background:#ece4d6;padding:24px;">\n' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">\n' +
  '<tr>\n' +
  '<td style="vertical-align:top;">' +
  '<img src="{{brandLogoUrl}}" alt="{{brandName}}" height="36" style="display:block;max-height:36px;border:0;" />' +
  '<div style="margin-top:10px;font-size:11px;color:#5a4633;line-height:1.5;">' +
  'This email was sent by {{brandName}}.<br/>' +
  '{{brandAddress}}<br/>' +
  '{{brandCopyright}}<br/>' +
  '<a href="{{orderUrl}}" style="color:#5a4633;text-decoration:underline;">Unsubscribe</a>' +
  '</div>' +
  '</td>\n' +
  '<td align="right" style="vertical-align:top;font-size:11px;color:#5a4633;letter-spacing:2px;font-weight:700;">' +
  '<div style="margin-bottom:8px;">FOLLOW US</div>' +
  '<a href="#" style="text-decoration:none;color:{{brandColor}};font-size:18px;margin:0 4px;">📷</a>' +
  '<a href="#" style="text-decoration:none;color:{{brandColor}};font-size:18px;margin:0 4px;">f</a>' +
  '<a href="#" style="text-decoration:none;color:{{brandColor}};font-size:18px;margin:0 4px;">𝕏</a>' +
  '<a href="#" style="text-decoration:none;color:{{brandColor}};font-size:18px;margin:0 4px;">▶</a>' +
  '</td>\n' +
  '</tr>\n' +
  '</table>\n' +
  '</td></tr>\n' +
  '</table>\n' +
  '</td></tr>\n' +
  '</table>\n' +
  '</body>\n' +
  '</html>';
