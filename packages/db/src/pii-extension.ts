/**
 * Prisma extension that transparently encrypts + hashes PII on write
 * and decrypts on read for RefundCase, PromoAllocation, InboundEmail,
 * EmailLog, and CaseNote.
 *
 * Two flavors of handler:
 *   - Customer email/phone (RefundCase, PromoAllocation): full
 *     encrypt + hash + where-rewrite so exact-match lookups by email
 *     still work against ciphertext.
 *   - Free-text body fields (InboundEmail.rawBody, EmailLog.body/cc/
 *     bcc, CaseNote.body): encrypt-on-write / decrypt-on-read only,
 *     no hash and no where-rewrite. These fields are list+render or
 *     find-by-id+render in practice, so a hash column would be dead
 *     weight.
 *
 * The extension is a no-op when neither PII_ENCRYPTION_KEY nor
 * PII_HASH_KEY are configured, so local dev and legacy deploys behave
 * exactly as before.
 *
 * When PII_ENCRYPTION_KEY is set, every RefundCase/PromoAllocation
 * create/update/upsert/createMany has customerEmail + customerPhone
 * wrapped with AES-256-GCM before hitting the DB, and every find*
 * result has them unwrapped before returning. The same wrap/unwrap
 * pipeline runs for the free-text body fields on the secondary
 * models.
 *
 * When PII_HASH_KEY is set (orthogonal to encryption; they can be set
 * independently but usually go together), hashes are computed on write
 * AND any top-level `where.customerEmail = "x@y.z"` / `{equals: …}` is
 * transparently rewritten to `where.customerEmailHash = hash("x@y.z")`
 * so exact-match lookups survive encryption.
 *
 * What the extension does NOT do (documented limitations):
 *   - `contains`, `startsWith`, `endsWith`, `in` on customerEmail /
 *     customerPhone → passed through unchanged. These queries will no
 *     longer match rows whose plaintext has been encrypted. Callers
 *     that need search UX must upstream-detect email shape and route
 *     to hash lookup themselves (see apps/web/src/app/api/export/
 *     cases/route.ts for the reference pattern).
 *   - Nested `OR`/`AND`/`NOT` rewrites: supported.
 *   - Rewrite on `customerName`: not done — name stays plaintext for
 *     contains search. Name encryption is a future PR.
 *   - Aggregate/groupBy by email/phone: unsupported (broken on
 *     encrypted data).
 */
import type { Prisma } from '@prisma/client';
import { encryptPii, decryptPii } from './pii-crypto';
import { hashEmailDb, hashPhoneDb } from './pii-hash-db';

type Op =
  | 'create'
  | 'createMany'
  | 'update'
  | 'updateMany'
  | 'upsert'
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findFirst'
  | 'findFirstOrThrow'
  | 'findMany';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Walk where.customerEmail / customerPhone top-level equality and rewrite to hash. */
export function rewriteWhere(where: unknown): unknown {
  if (!isPlainObject(where)) return where;
  const next: Record<string, unknown> = { ...where };

  if ('customerEmail' in next) {
    const val = next['customerEmail'];
    const hashable = extractEqualityString(val);
    if (hashable !== null) {
      const h = hashEmailDb(hashable);
      if (h !== null) {
        delete next['customerEmail'];
        next['customerEmailHash'] = h;
      }
    }
  }
  if ('customerPhone' in next) {
    const val = next['customerPhone'];
    const hashable = extractEqualityString(val);
    if (hashable !== null) {
      const h = hashPhoneDb(hashable);
      if (h !== null) {
        delete next['customerPhone'];
        next['customerPhoneHash'] = h;
      }
    }
  }
  if (Array.isArray(next['OR'])) next['OR'] = next['OR'].map(rewriteWhere);
  if (Array.isArray(next['AND'])) next['AND'] = next['AND'].map(rewriteWhere);
  if (isPlainObject(next['NOT'])) next['NOT'] = rewriteWhere(next['NOT']);
  return next;
}

function extractEqualityString(val: unknown): string | null {
  if (typeof val === 'string') return val;
  if (isPlainObject(val) && typeof val['equals'] === 'string') return val['equals'];
  return null;
}

/**
 * Encrypt the two PII string fields on a `data` object and add their
 * hashes. Returns a shallow copy — never mutates the caller's object.
 */
function wrapWriteData(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data };
  if (typeof next['customerEmail'] === 'string') {
    const plain = next['customerEmail'];
    const hash = hashEmailDb(plain);
    if (hash !== null) next['customerEmailHash'] = hash;
    next['customerEmail'] = encryptPii(plain);
  }
  if (typeof next['customerPhone'] === 'string') {
    const plain = next['customerPhone'];
    const hash = hashPhoneDb(plain);
    if (hash !== null) next['customerPhoneHash'] = hash;
    next['customerPhone'] = encryptPii(plain);
  }
  return next;
}

function unwrapReadRow<T>(row: T): T {
  if (!isPlainObject(row)) return row;
  const out = { ...row } as Record<string, unknown>;
  if (typeof out['customerEmail'] === 'string') {
    out['customerEmail'] = decryptPii(out['customerEmail']);
  }
  if (typeof out['customerPhone'] === 'string') {
    out['customerPhone'] = decryptPii(out['customerPhone']);
  }
  return out as unknown as T;
}

function unwrapReadResult<T>(result: T): T {
  if (result == null) return result;
  if (Array.isArray(result)) {
    return result.map((r) => unwrapReadRow(r)) as unknown as T;
  }
  return unwrapReadRow(result);
}

/**
 * Generic encrypt-on-write / decrypt-on-read for free-text fields that
 * are NOT queried by exact match (so we don't need to maintain hash
 * columns + where-rewrite for them).
 *
 * Used for body / rawBody / cc / bcc fields where the only access
 * pattern is "list rows + render" or "find by id + render". Adding
 * a field here is forward-only: existing plaintext rows decrypt
 * unchanged thanks to the `v1:` prefix check in decryptPii.
 *
 * If a caller introduces a `where: { body: { contains: ... } }` query
 * later, that query won't match encrypted rows — same documented
 * limitation as customerEmail's contains search.
 */
const SIMPLE_ENCRYPT_FIELDS: Record<string, readonly string[]> = {
  inboundEmail: ['rawBody'],
  emailLog: ['body', 'cc', 'bcc'],
  caseNote: ['body'],
};

function wrapSimpleFields(
  data: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> {
  const next = { ...data };
  for (const f of fields) {
    if (typeof next[f] === 'string') {
      next[f] = encryptPii(next[f] as string);
    }
  }
  return next;
}

function unwrapSimpleFields<T>(row: T, fields: readonly string[]): T {
  if (!isPlainObject(row)) return row;
  const out = { ...row } as Record<string, unknown>;
  for (const f of fields) {
    if (typeof out[f] === 'string') {
      out[f] = decryptPii(out[f] as string);
    }
  }
  return out as unknown as T;
}

function unwrapSimpleResult<T>(result: T, fields: readonly string[]): T {
  if (result == null) return result;
  if (Array.isArray(result)) {
    return result.map((r) => unwrapSimpleFields(r, fields)) as unknown as T;
  }
  return unwrapSimpleFields(result, fields);
}

/** Build the extension config. Models covered: RefundCase, PromoAllocation. */
export const piiExtension = {
  name: 'wow-pii',
  query: {
    refundCase: buildModelHandlers(),
    promoAllocation: buildModelHandlers({ phone: false }),
    inboundEmail: buildSimpleHandlers(SIMPLE_ENCRYPT_FIELDS['inboundEmail']!),
    emailLog: buildSimpleHandlers(SIMPLE_ENCRYPT_FIELDS['emailLog']!),
    caseNote: buildSimpleHandlers(SIMPLE_ENCRYPT_FIELDS['caseNote']!),
  },
} as const;

/**
 * Builds Prisma extension handlers for models that only need
 * encrypt-on-write / decrypt-on-read (no hash columns, no where
 * rewrite). Cheaper than buildModelHandlers and used for free-text
 * fields like email bodies and case notes.
 */
function buildSimpleHandlers(fields: readonly string[]) {
  const wrap = (data: Record<string, unknown>) => wrapSimpleFields(data, fields);
  const unwrap = <T>(r: T): T => unwrapSimpleResult(r, fields);
  return {
    async create({ args, query }: { args: { data: Record<string, unknown> }; query: (a: unknown) => Promise<unknown> }) {
      args.data = wrap(args.data);
      return unwrap(await query(args));
    },
    async createMany({ args, query }: { args: { data: Record<string, unknown> | Record<string, unknown>[] }; query: (a: unknown) => Promise<unknown> }) {
      if (Array.isArray(args.data)) {
        args.data = args.data.map(wrap);
      } else {
        args.data = wrap(args.data);
      }
      return query(args);
    },
    async update({ args, query }: { args: { data: Record<string, unknown> }; query: (a: unknown) => Promise<unknown> }) {
      args.data = wrap(args.data);
      return unwrap(await query(args));
    },
    async updateMany({ args, query }: { args: { data: Record<string, unknown> }; query: (a: unknown) => Promise<unknown> }) {
      args.data = wrap(args.data);
      return query(args);
    },
    async upsert({ args, query }: { args: { create: Record<string, unknown>; update: Record<string, unknown> }; query: (a: unknown) => Promise<unknown> }) {
      args.create = wrap(args.create);
      args.update = wrap(args.update);
      return unwrap(await query(args));
    },
    async findUnique(ctx: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
      return unwrap(await ctx.query(ctx.args));
    },
    async findUniqueOrThrow(ctx: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
      return unwrap(await ctx.query(ctx.args));
    },
    async findFirst(ctx: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
      return unwrap(await ctx.query(ctx.args));
    },
    async findFirstOrThrow(ctx: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
      return unwrap(await ctx.query(ctx.args));
    },
    async findMany(ctx: { args: unknown; query: (a: unknown) => Promise<unknown> }) {
      return unwrap(await ctx.query(ctx.args));
    },
  };
}

function buildModelHandlers(opts: { phone?: boolean } = {}) {
  const wantPhone = opts.phone !== false;
  // Adjust wrapWriteData when phone is not on this model (PromoAllocation).
  const wrap = (data: Record<string, unknown>) => {
    const wrapped = wrapWriteData(data);
    if (!wantPhone) {
      delete wrapped['customerPhone'];
      delete wrapped['customerPhoneHash'];
    }
    return wrapped;
  };
  const unwrap = <T>(r: T): T => {
    // PromoAllocation doesn't have customerPhone, so the copy is cheap
    // and decryptPii() on a missing field is a no-op anyway.
    return unwrapReadResult(r);
  };
  return {
    async create({ args, query }: { args: { data: Record<string, unknown> }; query: (a: unknown) => Promise<unknown> }) {
      args.data = wrap(args.data);
      return unwrap(await query(args));
    },
    async createMany({ args, query }: { args: { data: Record<string, unknown> | Record<string, unknown>[] }; query: (a: unknown) => Promise<unknown> }) {
      if (Array.isArray(args.data)) {
        args.data = args.data.map(wrap);
      } else {
        args.data = wrap(args.data);
      }
      return query(args);
    },
    async update({ args, query }: { args: { data: Record<string, unknown>; where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
      args.data = wrap(args.data);
      if (args.where) args.where = rewriteWhere(args.where) as never;
      return unwrap(await query(args));
    },
    async updateMany({ args, query }: { args: { data: Record<string, unknown>; where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
      args.data = wrap(args.data);
      if (args.where) args.where = rewriteWhere(args.where) as never;
      return query(args);
    },
    async upsert({ args, query }: { args: { create: Record<string, unknown>; update: Record<string, unknown>; where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
      args.create = wrap(args.create);
      args.update = wrap(args.update);
      if (args.where) args.where = rewriteWhere(args.where) as never;
      return unwrap(await query(args));
    },
    async findUnique(ctx: { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
      if (ctx.args.where) ctx.args.where = rewriteWhere(ctx.args.where) as never;
      return unwrap(await ctx.query(ctx.args));
    },
    async findUniqueOrThrow(ctx: { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
      if (ctx.args.where) ctx.args.where = rewriteWhere(ctx.args.where) as never;
      return unwrap(await ctx.query(ctx.args));
    },
    async findFirst(ctx: { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
      if (ctx.args.where) ctx.args.where = rewriteWhere(ctx.args.where) as never;
      return unwrap(await ctx.query(ctx.args));
    },
    async findFirstOrThrow(ctx: { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
      if (ctx.args.where) ctx.args.where = rewriteWhere(ctx.args.where) as never;
      return unwrap(await ctx.query(ctx.args));
    },
    async findMany(ctx: { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> }) {
      if (ctx.args.where) ctx.args.where = rewriteWhere(ctx.args.where) as never;
      return unwrap(await ctx.query(ctx.args));
    },
  };
}

// Silence unused-import warnings when the helpers above aren't used by
// the shim builds.
export type { Op, Prisma };
