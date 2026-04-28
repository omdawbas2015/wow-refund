/**
 * Inbound webhook for Power Automate.
 *
 * Power Automate listens to Office 365 inbox → when an email arrives (manager
 * reply, Finance ARN reply, Aura confirmation, customer reply), it POSTs the
 * payload here.
 *
 * Auth: `x-wow-signature` HMAC-SHA256 hex digest of the raw request body,
 * computed with `POWER_AUTOMATE_INBOUND_SECRET`. For backward compatibility
 * with earlier Flows that sent the secret directly, a plaintext match is
 * still accepted and logged as a deprecation warning so operators can roll
 * the Flow over at their own pace.
 *
 * We persist the raw email in `inbound_email`, then immediately classify it
 * and route it to the right handler. Parsing failures are non-fatal — they
 * leave the row in `parseStatus = 'FAILED'` for human review.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@wow/db';
import { processInboundReply } from '@/lib/batches/process-inbound';
import { legacyEqualsSecret, verifyBodySignature } from '@/lib/security/signature';
import { assertBodySize, readBodyText } from '@/lib/security/request-limits';
import { consume } from '@/lib/rate-limit';

const INBOUND_SECRET = process.env['POWER_AUTOMATE_INBOUND_SECRET'] ?? '';

// Inbound email payloads fit well under this cap — Power Automate's
// own HTTP action caps actions at 100 MB but a normal reply with its
// rawBody + subject is < 64 KiB. 256 KiB leaves headroom for big HTML
// bodies / attachments-as-base64 while still preventing a memory-
// exhaustion DoS against the webhook.
const MAX_INBOUND_BYTES = 256 * 1024;

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

interface InboundPayload {
  fromEmail: string;
  toEmail: string;
  subject: string;
  rawBody: string;
  powerAutomateRunId?: string;
}

export async function POST(req: NextRequest) {
  // Rate limit first so a flood of bad traffic can't burn CPU on body
  // reads + HMAC verification. 120 requests per minute per source IP
  // is 10x the expected peak from a single tenant (a busy Flow fires
  // < 5/s at peak) but low enough to throttle automated abuse.
  const ip = clientIp(req);
  const rl = await consume(`webhook:power-automate:${ip}`, 120, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Cap body size before we read it; prevents a malicious sender from
  // forcing us to buffer a multi-GB payload before the HMAC check.
  const sizeError = await assertBodySize(req, MAX_INBOUND_BYTES);
  if (sizeError) return sizeError;

  // Read the raw body exactly once — HMAC verification must happen against
  // the bytes the sender signed, not a re-serialized object.
  const rawBody = await readBodyText(req);

  if (INBOUND_SECRET) {
    const header = req.headers.get('x-wow-signature') ?? '';
    if (!header) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const hmacOk = verifyBodySignature(rawBody, header, INBOUND_SECRET);
    if (!hmacOk) {
      // Backward compat: older Flows sent the plaintext secret as the header
      // value. Accept but warn so operators can roll over to HMAC.
      if (legacyEqualsSecret(header, INBOUND_SECRET)) {
        console.warn(
          '[power-automate inbound] accepted legacy plaintext x-wow-signature; please upgrade the Flow to HMAC-SHA256(rawBody, POWER_AUTOMATE_INBOUND_SECRET)',
        );
      } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
  }

  let payload: InboundPayload;
  try {
    payload = JSON.parse(rawBody) as InboundPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const required: Array<keyof InboundPayload> = ['fromEmail', 'toEmail', 'subject', 'rawBody'];
  for (const field of required) {
    if (!payload[field]) {
      return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
    }
  }

  // Idempotency: if the caller includes a Power Automate runId and we've
  // already processed it, return the prior result instead of double-
  // processing. Safe because runIds are globally unique per Flow run.
  if (payload.powerAutomateRunId) {
    const existing = await prisma.inboundEmail.findFirst({
      where: { powerAutomateRunId: payload.powerAutomateRunId },
      select: { id: true, parseStatus: true, parsedIntent: true },
      orderBy: { receivedAt: 'desc' },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        id: existing.id,
        idempotent: true,
        intent: existing.parsedIntent ?? null,
        parseStatus: existing.parseStatus,
      });
    }
  }

  const record = await prisma.inboundEmail.create({
    data: {
      fromEmail: payload.fromEmail,
      toEmail: payload.toEmail,
      subject: payload.subject,
      rawBody: payload.rawBody,
      powerAutomateRunId: payload.powerAutomateRunId ?? null,
      parseStatus: 'PENDING',
    },
  });

  try {
    const outcome = await processInboundReply({
      fromEmail: payload.fromEmail,
      subject: payload.subject,
      rawBody: payload.rawBody,
    });

    await prisma.inboundEmail.update({
      where: { id: record.id },
      data: {
        parseStatus: outcome.intent === 'IGNORED' ? 'IGNORED' : 'PARSED',
        parsedIntent: outcome.intent,
        parsedPayload: outcome.payload ? JSON.stringify(outcome.payload) : null,
        parsedAt: new Date(),
        linkedBatchId: outcome.linkedBatchId ?? null,
        linkedCaseId: outcome.linkedCaseId ?? null,
        linkedComponentId: outcome.linkedComponentId ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      id: record.id,
      intent: outcome.intent,
      payload: outcome.payload ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.inboundEmail.update({
      where: { id: record.id },
      data: {
        parseStatus: 'FAILED',
        parseError: message.slice(0, 1000),
        parsedAt: new Date(),
      },
    });
    console.error('[inbound email] parse failed', record.id, message);
    return NextResponse.json({ ok: false, id: record.id, error: message }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({
    status: 'Power Automate inbound webhook is active',
    timestamp: new Date().toISOString(),
  });
}
