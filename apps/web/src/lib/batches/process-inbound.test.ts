import { describe, it, expect, beforeEach, vi } from 'vitest';

const auditCreate = vi.fn();
const approvalFindUnique = vi.fn();
const userFindFirst = vi.fn();
const transaction = vi.fn();

vi.mock('@wow/db', () => ({
  prisma: {
    auditLog: { create: (...args: unknown[]) => auditCreate(...args) },
    approvalBatch: { findUnique: (...args: unknown[]) => approvalFindUnique(...args) },
    user: { findFirst: (...args: unknown[]) => userFindFirst(...args) },
    $transaction: (...args: unknown[]) => transaction(...args),
    // Other models are not used in the tests below; they will throw a clear
    // error if they get hit, signalling an unintended code path.
  },
}));

import { processInboundReply } from './process-inbound';

beforeEach(() => {
  auditCreate.mockReset();
  approvalFindUnique.mockReset();
  userFindFirst.mockReset();
  transaction.mockReset();
  auditCreate.mockResolvedValue(undefined);
});

describe('processInboundReply', () => {
  describe('AI intent === UNCLEAR', () => {
    it('returns UNCLEAR_INTENT and writes an audit row without touching any batch', async () => {
      const out = await processInboundReply({
        fromEmail: 'manager@wow.local',
        subject: 'RE: Refund approvals required for batch APB-KW-2026-90002',
        rawBody: 'Maybe? Looks fine I guess. — KW Manager',
        aiParsed: {
          intent: 'UNCLEAR',
          confidence: 0.42,
          reason: 'Reply is hedging ("maybe", "I guess"); no explicit approval.',
        },
      });

      expect(out.intent).toBe('UNCLEAR_INTENT');
      expect(out.payload?.['reason']).toMatch(/hedging/i);
      expect(out.payload?.['confidence']).toBe(0.42);

      // The handler should never look up a batch \u2014 we never want UNCLEAR
      // replies to drive a decision.
      expect(approvalFindUnique).not.toHaveBeenCalled();

      // It MUST audit the unclear inbound so admins can review.
      expect(auditCreate).toHaveBeenCalledTimes(1);
      const args = auditCreate.mock.calls[0]?.[0] as { data: { action: string } };
      expect(args.data.action).toBe('inbound.ai_unclear');
    });
  });

  describe('approval-batch sender allowlist', () => {
    const baseBatch = {
      id: 'batch_1',
      batchNumber: 'APB-KW-2026-90002',
      countryId: 'kw',
      status: 'SENT',
      recipientEmails: 'kw-manager@wow.local',
      cases: [
        { id: 'case_1', caseNumber: 'REF-KW-2026-000002', status: 'PENDING_APPROVAL' },
      ],
    };

    it('rejects a sender that is neither the recipient nor a known manager', async () => {
      approvalFindUnique.mockResolvedValue(baseBatch);
      userFindFirst.mockResolvedValue(null);

      const out = await processInboundReply({
        fromEmail: 'random.attacker@evil.example',
        subject: 'RE: APB-KW-2026-90002',
        rawBody: 'Approved!',
      });

      expect(out.intent).toBe('UNAUTHORIZED_SENDER');
      expect(out.linkedBatchId).toBe('batch_1');

      // We expect the unauthorised attempt to be persisted in the audit log.
      expect(auditCreate).toHaveBeenCalledTimes(1);
      const args = auditCreate.mock.calls[0]?.[0] as { data: { action: string } };
      expect(args.data.action).toBe('inbound.unauthorized_sender');
    });

    it('accepts a sender listed on the batch\u2019s recipientEmails (case-insensitive)', async () => {
      approvalFindUnique.mockResolvedValue(baseBatch);

      // We don't actually need the inner $transaction to run for this test \u2014
      // we just care that the sender check passed and the handler progressed
      // past the allowlist gate. Rather than mock the full transaction, we
      // intercept the unmocked `prisma.user.findFirst` (which the allowlist
      // helper calls only when the recipient list does NOT match) and assert
      // it was never reached.
      try {
        await processInboundReply({
          fromEmail: 'KW-Manager@wow.local',
          subject: 'RE: APB-KW-2026-90002',
          rawBody: 'Approved.',
        });
      } catch {
        // Expected: the test prisma mock doesn't implement the rest of the
        // pipeline. We only assert the allowlist short-circuit didn't fire.
      }

      // No unauthorized_sender audit row was written \u2014 sender was on the
      // recipient list, so the role-fallback DB lookup should not run.
      const unauthorized = auditCreate.mock.calls.find(
        (c) =>
          (c[0] as { data: { action: string } }).data.action ===
          'inbound.unauthorized_sender',
      );
      expect(unauthorized).toBeUndefined();
      expect(userFindFirst).not.toHaveBeenCalled();
    });

    it('accepts a sender that is an active manager for the batch country', async () => {
      approvalFindUnique.mockResolvedValue(baseBatch);
      userFindFirst.mockResolvedValue({
        id: 'u1',
        email: 'deputy.kw@wow.local',
        primaryCountryId: 'kw',
        role: { key: 'MANAGER' },
      });

      try {
        await processInboundReply({
          fromEmail: 'deputy.kw@wow.local',
          subject: 'RE: APB-KW-2026-90002',
          rawBody: 'Approved.',
        });
      } catch {
        // Expected \u2014 we don't mock the rest of the prisma pipeline.
      }

      const unauthorized = auditCreate.mock.calls.find(
        (c) =>
          (c[0] as { data: { action: string } }).data.action ===
          'inbound.unauthorized_sender',
      );
      expect(unauthorized).toBeUndefined();
      expect(userFindFirst).toHaveBeenCalledTimes(1);
    });

    it('rejects a manager from a different country than the batch', async () => {
      approvalFindUnique.mockResolvedValue(baseBatch);
      userFindFirst.mockResolvedValue({
        id: 'u2',
        email: 'sa-manager@wow.local',
        primaryCountryId: 'sa', // wrong country
        role: { key: 'MANAGER' },
      });

      const out = await processInboundReply({
        fromEmail: 'sa-manager@wow.local',
        subject: 'RE: APB-KW-2026-90002',
        rawBody: 'Approved.',
      });

      expect(out.intent).toBe('UNAUTHORIZED_SENDER');
      const args = auditCreate.mock.calls[0]?.[0] as { data: { action: string } };
      expect(args.data.action).toBe('inbound.unauthorized_sender');
    });
  });

  describe('AI APPROVAL_RESPONSE — blanket + perCase ("approve all except X")', () => {
    it('applies blanket to every pending case, then per-case overrides', async () => {
      const batch = {
        id: 'batch_2',
        batchNumber: 'APB-KW-2026-91001',
        countryId: 'kw',
        status: 'SENT',
        recipientEmails: 'kw-manager@wow.local',
        cases: [
          { id: 'c1', caseNumber: 'REF-KW-2026-000001', status: 'PENDING_APPROVAL' },
          { id: 'c2', caseNumber: 'REF-KW-2026-000002', status: 'PENDING_APPROVAL' },
          { id: 'c3', caseNumber: 'REF-KW-2026-000003', status: 'PENDING_APPROVAL' },
        ],
      };
      approvalFindUnique.mockResolvedValue(batch);

      // Capture the decisions that the inner $transaction would have applied.
      // We resolve immediately so the outer flow returns the payload.
      transaction.mockResolvedValue(undefined);

      const out = await processInboundReply({
        fromEmail: 'kw-manager@wow.local',
        subject: 'RE: APB-KW-2026-91001',
        rawBody: 'Approve all except case 2',
        aiParsed: {
          intent: 'APPROVAL_RESPONSE',
          confidence: 0.95,
          blanket: 'APPROVED',
          perCase: [
            { caseNumber: 'REF-KW-2026-000002', decision: 'REJECTED' },
          ],
        },
      });

      expect(out.intent).toBe('APPROVAL_RESPONSE');
      const decisions = out.payload?.['decisions'] as Array<[string, string]>;
      // Blanket APPROVED applied to all 3 cases first, then perCase
      // overrode case 2 with REJECTED. Order matches batch.cases order.
      expect(decisions).toEqual([
        ['REF-KW-2026-000001', 'APPROVED'],
        ['REF-KW-2026-000002', 'REJECTED'],
        ['REF-KW-2026-000003', 'APPROVED'],
      ]);
    });
  });
});
