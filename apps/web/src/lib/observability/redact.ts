/**
 * Log-payload redaction.
 *
 * Walks an arbitrary JSON-ish value and masks fields that are never safe
 * to ship to an external log sink. The list is deliberately broad: it
 * catches common header names (Authorization, Cookie, Set-Cookie),
 * generic secret/key vocabulary (password, secret, token, api_key,
 * auth), and the two PII fields the app actually stores in plaintext
 * today (customerEmail, customerPhone) so an accidental log of an
 * entire RefundCase row doesn't leak them to Datadog/Grafana/etc.
 *
 * Masking rules:
 *   - password / secret / token / key / authorization / cookie → '[REDACTED]'
 *   - email-shaped strings → mask local part except first char, keep domain
 *   - phone-shaped strings → keep first 2 + last 2 digits, mask the rest
 *
 * The function is pure and does not mutate its input.
 */

// `auth(?!or|Code)` excludes both `author...` (legit text) and `authCode`
// (KNET payment authorization code stored on RefundComponent and surfaced
// in case detail views + KNET / refund Excel exports). `auth` on its own,
// `auth_token`, `authToken`, `authHeader`, `authorization` etc. all still
// match correctly.
const SECRET_KEY_RX = /(password|passwd|secret|token|api[_-]?key|authorization|auth(?!or|Code)|cookie|session|signing)/i;
const EMAIL_KEY_RX = /(email|emailAddress|to|from|cc|bcc|customerEmail)$/i;
const PHONE_KEY_RX = /(phone|customerPhone|mobile|tel)$/i;

function maskEmail(value: string): string {
  const [local, domain] = value.split('@');
  if (!local || !domain) return value;
  if (local.length <= 1) return `${local}***@${domain}`;
  return `${local[0]}***@${domain}`;
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `${digits.slice(0, 2)}***${digits.slice(-2)}`;
}

// Object types whose own enumerable properties don't reflect their value
// (e.g. Date stringifies via toISOString, Buffer / Error have a meaningful
// shape that recursing into would obliterate). Returning them as-is means
// the downstream JSON.stringify renders them correctly — Date → ISO
// string, Buffer → array shape, Error → { name, message, stack } via the
// custom toJSON if any. Without this guard, redact() would replace
// `{ createdAt: someDate }` with `{ createdAt: {} }` because Date has no
// own enumerable properties.
function isOpaqueObject(value: object): boolean {
  return (
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof Error ||
    value instanceof Map ||
    value instanceof Set ||
    (typeof Buffer !== 'undefined' && value instanceof Buffer) ||
    ArrayBuffer.isView(value)
  );
}

export function redact<T>(input: T, seen: WeakSet<object> = new WeakSet()): T {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') return input;
  if (typeof input !== 'object') return input;
  if (isOpaqueObject(input as object)) return input;
  if (seen.has(input as object)) return input;
  seen.add(input as object);

  if (Array.isArray(input)) {
    return input.map((v) => redact(v, seen)) as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_KEY_RX.test(key)) {
      out[key] = '[REDACTED]';
      continue;
    }
    if (typeof value === 'string' && EMAIL_KEY_RX.test(key)) {
      out[key] = maskEmail(value);
      continue;
    }
    if (typeof value === 'string' && PHONE_KEY_RX.test(key)) {
      out[key] = maskPhone(value);
      continue;
    }
    if (value && typeof value === 'object') {
      if (isOpaqueObject(value)) {
        out[key] = value;
        continue;
      }
      out[key] = redact(value, seen);
      continue;
    }
    out[key] = value;
  }
  return out as T;
}
