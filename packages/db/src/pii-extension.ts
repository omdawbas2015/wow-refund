/**
 * Prisma client extension that transparently encrypts/decrypts PII fields.
 *
 * Covered fields:
 *   - RefundCase:      customerEmail, customerPhone
 *   - PromoAllocation: customerEmail
 *
 * When PII_ENCRYPTION_KEY is unset the helpers are pass-through — no
 * behavioural change for dev / CI environments.
 */
import { Prisma } from '@prisma/client';
import { piiEncrypt, piiDecrypt } from './pii';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AnyRecord = Record<string, unknown>;

/** Encrypt specific string fields inside an arbitrary data object. */
function encryptFields<T extends AnyRecord>(
  data: T,
  fields: string[],
): T {
  const out = { ...data };
  for (const f of fields) {
    if (f in out && typeof out[f] === 'string') {
      (out as AnyRecord)[f] = piiEncrypt(out[f] as string);
    }
  }
  return out;
}

/** Decrypt specific string fields inside an arbitrary result object. */
function decryptFields<T extends AnyRecord>(
  row: T,
  fields: string[],
): T {
  const out = { ...row };
  for (const f of fields) {
    if (f in out && typeof out[f] === 'string') {
      (out as AnyRecord)[f] = piiDecrypt(out[f] as string);
    }
  }
  return out;
}

/** Recursively decrypt an array or single result. */
function decryptResult<T>(result: T, fields: string[]): T {
  if (result == null) return result;
  if (Array.isArray(result)) {
    return result.map((r) => decryptFields(r as AnyRecord, fields)) as T;
  }
  return decryptFields(result as AnyRecord, fields) as T;
}

/** Walk nested `data`, `create`, `update`, `upsert` args and encrypt. */
function encryptArgs(args: AnyRecord | undefined, fields: string[]): void {
  if (!args) return;

  if (args['data'] && typeof args['data'] === 'object') {
    args['data'] = encryptFields(args['data'] as AnyRecord, fields);
  }

  // upsert
  if (args['create'] && typeof args['create'] === 'object') {
    args['create'] = encryptFields(args['create'] as AnyRecord, fields);
  }
  if (args['update'] && typeof args['update'] === 'object') {
    args['update'] = encryptFields(args['update'] as AnyRecord, fields);
  }
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

const REFUND_CASE_PII = ['customerEmail', 'customerPhone'];
const PROMO_ALLOC_PII = ['customerEmail'];

export const piiExtension = Prisma.defineExtension({
  name: 'pii-encryption',
  query: {
    refundCase: {
      async findFirst({ args, query }) {
        return decryptResult(await query(args), REFUND_CASE_PII);
      },
      async findFirstOrThrow({ args, query }) {
        return decryptResult(await query(args), REFUND_CASE_PII);
      },
      async findUnique({ args, query }) {
        return decryptResult(await query(args), REFUND_CASE_PII);
      },
      async findUniqueOrThrow({ args, query }) {
        return decryptResult(await query(args), REFUND_CASE_PII);
      },
      async findMany({ args, query }) {
        return decryptResult(await query(args), REFUND_CASE_PII);
      },
      async create({ args, query }) {
        encryptArgs(args as AnyRecord, REFUND_CASE_PII);
        return decryptResult(await query(args), REFUND_CASE_PII);
      },
      async update({ args, query }) {
        encryptArgs(args as AnyRecord, REFUND_CASE_PII);
        return decryptResult(await query(args), REFUND_CASE_PII);
      },
      async upsert({ args, query }) {
        encryptArgs(args as AnyRecord, REFUND_CASE_PII);
        return decryptResult(await query(args), REFUND_CASE_PII);
      },
      async updateMany({ args, query }) {
        encryptArgs(args as AnyRecord, REFUND_CASE_PII);
        return query(args);
      },
      async createMany({ args, query }) {
        if (args.data) {
          if (Array.isArray(args.data)) {
            (args as AnyRecord).data = args.data.map((d) => encryptFields(d as AnyRecord, REFUND_CASE_PII));
          } else {
            (args as AnyRecord).data = encryptFields(args.data as AnyRecord, REFUND_CASE_PII);
          }
        }
        return query(args);
      },
    },
    promoAllocation: {
      async findFirst({ args, query }) {
        return decryptResult(await query(args), PROMO_ALLOC_PII);
      },
      async findFirstOrThrow({ args, query }) {
        return decryptResult(await query(args), PROMO_ALLOC_PII);
      },
      async findUnique({ args, query }) {
        return decryptResult(await query(args), PROMO_ALLOC_PII);
      },
      async findUniqueOrThrow({ args, query }) {
        return decryptResult(await query(args), PROMO_ALLOC_PII);
      },
      async findMany({ args, query }) {
        return decryptResult(await query(args), PROMO_ALLOC_PII);
      },
      async create({ args, query }) {
        encryptArgs(args as AnyRecord, PROMO_ALLOC_PII);
        return decryptResult(await query(args), PROMO_ALLOC_PII);
      },
      async update({ args, query }) {
        encryptArgs(args as AnyRecord, PROMO_ALLOC_PII);
        return decryptResult(await query(args), PROMO_ALLOC_PII);
      },
      async upsert({ args, query }) {
        encryptArgs(args as AnyRecord, PROMO_ALLOC_PII);
        return decryptResult(await query(args), PROMO_ALLOC_PII);
      },
      async createMany({ args, query }) {
        if (args.data) {
          if (Array.isArray(args.data)) {
            (args as AnyRecord).data = args.data.map((d) => encryptFields(d as AnyRecord, PROMO_ALLOC_PII));
          } else {
            (args as AnyRecord).data = encryptFields(args.data as AnyRecord, PROMO_ALLOC_PII);
          }
        }
        return query(args);
      },
    },
  },
});
