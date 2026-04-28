import { describe, it, expect, beforeEach, vi } from 'vitest';

const findMany = vi.fn();
const count = vi.fn();
const dispatch = vi.fn();

vi.mock('@wow/db', () => ({
  prisma: {
    emailLog: {
      findMany: (...args: unknown[]) => findMany(...args),
      count: (...args: unknown[]) => count(...args),
    },
  },
}));

vi.mock('./dispatcher', () => ({
  dispatchEmail: (...args: unknown[]) => dispatch(...args),
}));

// eslint-disable-next-line import/first
import { sweepFailedEmails } from './retry';

const base = {
  templateKey: 'CUSTOMER_PROMO_COMPENSATION',
  to: 'a@b.com',
  cc: null as string | null,
  bcc: null as string | null,
  subject: 'Re: your refund',
  body: 'Hello',
  contextType: 'PROMO',
  contextId: 'ctx-1',
};

describe('sweepFailedEmails', () => {
  beforeEach(() => {
    findMany.mockReset();
    count.mockReset();
    dispatch.mockReset();
  });

  it('returns zeroed outcome when no candidates', async () => {
    findMany.mockResolvedValueOnce([]);
    const out = await sweepFailedEmails();
    expect(out).toEqual({ considered: 0, delivered: 0, failed: 0, skippedTooManyAttempts: 0 });
  });

  // The sweep now issues TWO count() calls per candidate:
  //   1. Are there any SENT siblings? (dedupe gate)
  //   2. How many total attempts so far? (cap gate)
  // Test mocks branch on `where.status === 'SENT'` to keep both gates honest.
  function mockCounts(opts: { sent: number; attempts: number }) {
    count.mockImplementation((args: { where?: { status?: string } } = {}) => {
      if (args.where?.status === 'SENT') return Promise.resolve(opts.sent);
      return Promise.resolve(opts.attempts);
    });
  }

  it('retries each candidate once, counts delivered and failed', async () => {
    findMany.mockResolvedValueOnce([
      { id: '1', ...base },
      { id: '2', ...base, to: 'c@d.com' },
    ]);
    mockCounts({ sent: 0, attempts: 1 }); // never delivered, well below cap
    dispatch
      .mockResolvedValueOnce({ logId: 'n1', delivered: true })
      .mockResolvedValueOnce({ logId: 'n2', delivered: false, error: 'nope' });

    const out = await sweepFailedEmails();
    expect(out.considered).toBe(2);
    expect(out.delivered).toBe(1);
    expect(out.failed).toBe(1);
    expect(out.skippedTooManyAttempts).toBe(0);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('skips rows that already hit the attempt cap', async () => {
    findMany.mockResolvedValueOnce([{ id: '1', ...base }]);
    mockCounts({ sent: 0, attempts: 99 });
    const out = await sweepFailedEmails({ maxAutoRetries: 4 });
    expect(out.considered).toBe(1);
    expect(out.skippedTooManyAttempts).toBe(1);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('skips rows whose destination already has a SENT sibling', async () => {
    findMany.mockResolvedValueOnce([{ id: '1', ...base }]);
    mockCounts({ sent: 1, attempts: 2 });
    const out = await sweepFailedEmails();
    expect(out.considered).toBe(1);
    expect(out.skippedTooManyAttempts).toBe(1);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('counts dispatch throws as failure, not crash', async () => {
    findMany.mockResolvedValueOnce([{ id: '1', ...base }]);
    mockCounts({ sent: 0, attempts: 1 });
    dispatch.mockRejectedValueOnce(new Error('boom'));
    const out = await sweepFailedEmails();
    expect(out.failed).toBe(1);
    expect(out.delivered).toBe(0);
  });
});
