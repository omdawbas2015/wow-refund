/**
 * EmailDispatcher — single abstraction for all outbound emails.
 *
 * In production: posts a payload to Power Automate webhook.
 * In development / when POWER_AUTOMATE_WEBHOOK_URL is unset:
 *   logs the email to console and records it in EmailLog.
 *
 * Every email call is persisted to EmailLog (so the audit trail is complete
 * regardless of delivery success).
 */

import { prisma } from '@wow/db';
import { renderTemplate } from './render';
import { signBody } from '@/lib/security/signature';

export interface EmailPayload {
  templateKey: string;
  locale?: 'en' | 'ar';
  to: string;
  cc?: string;
  bcc?: string;
  /** Values to interpolate into the template's {{placeholders}} */
  variables: Record<string, string | number | undefined | null>;
  /** For audit + linking: what does this email relate to? */
  context?: {
    type: 'CASE' | 'BATCH' | 'PROMO' | 'STORE' | 'OTP' | 'AUTH' | 'SYSTEM';
    id?: string;
  };
  /** Override subject/body (skip template lookup) — used for admin notifications */
  override?: {
    subject: string;
    body: string;
  };
}

export interface EmailDispatchResult {
  logId: string;
  delivered: boolean;
  runId?: string;
  error?: string;
}

const WEBHOOK_URL = process.env['POWER_AUTOMATE_WEBHOOK_URL'] ?? '';
// Optional dedicated channel for CUSTOMER_PROMO_COMPENSATION emails.
// When set, customer-promo dispatches POST here instead of WEBHOOK_URL
// so operators can wire flow #7 (auto-send promo) and keep the unified
// router #1 / #3 for everything else. Falls back to WEBHOOK_URL when blank.
const PROMO_WEBHOOK_URL = process.env['POWER_AUTOMATE_PROMO_WEBHOOK_URL'] ?? '';
const SIGNING_SECRET = process.env['POWER_AUTOMATE_SIGNING_SECRET'] ?? '';

export async function dispatchEmail(payload: EmailPayload): Promise<EmailDispatchResult> {
  // Load template if no override given
  let subject: string;
  let body: string;
  let templateId: string | undefined;

  if (payload.override) {
    subject = payload.override.subject;
    body = payload.override.body;
  } else {
    const template = await prisma.emailTemplate.findUnique({
      where: {
        key_locale: { key: payload.templateKey, locale: payload.locale ?? 'en' },
      },
    });

    if (!template) {
      throw new Error(
        `Email template not found: ${payload.templateKey} (locale: ${payload.locale ?? 'en'})`,
      );
    }

    templateId = template.id;
    subject = renderTemplate(template.subject, payload.variables);
    body = renderTemplate(template.body, payload.variables);
  }

  // Persist log entry (status=PENDING)
  const log = await prisma.emailLog.create({
    data: {
      templateId,
      templateKey: payload.templateKey,
      to: payload.to,
      cc: payload.cc ?? null,
      bcc: payload.bcc ?? null,
      subject,
      body,
      contextType: payload.context?.type ?? null,
      contextId: payload.context?.id ?? null,
      status: 'PENDING',
    },
  });

  // Pick the webhook: customer-promo emails go to the dedicated channel
  // when one is configured.
  const targetWebhook =
    payload.templateKey === 'CUSTOMER_PROMO_COMPENSATION' && PROMO_WEBHOOK_URL
      ? PROMO_WEBHOOK_URL
      : WEBHOOK_URL;

  // If no webhook configured (dev), log to console and mark SENT
  if (!targetWebhook) {
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('📧 EMAIL (dev mode — no Power Automate webhook configured)');
    console.log('──────────────────────────────────────────────────────────────');
    console.log(`  Template: ${payload.templateKey} [${payload.locale ?? 'en'}]`);
    console.log(`  To:       ${payload.to}${payload.cc ? ` (cc: ${payload.cc})` : ''}`);
    console.log(`  Subject:  ${subject}`);
    console.log('──────────────────────────────────────────────────────────────');
    console.log(body.split('\n').map((line) => `  ${line}`).join('\n'));
    console.log('══════════════════════════════════════════════════════════════\n');

    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'SENT', sentAt: new Date(), powerAutomateRunId: 'dev-stub' },
    });

    return { logId: log.id, delivered: true, runId: 'dev-stub' };
  }

  // Production: POST to Power Automate.
  // The outbound body is HMAC-SHA256-signed with POWER_AUTOMATE_SIGNING_SECRET
  // and placed in `X-Wow-Signature`. If the secret is missing in production we
  // fail loudly so an un-authenticated webhook doesn't silently get a raw
  // payload — use the dev console fallback (blank WEBHOOK_URL) for local dev.
  if (!SIGNING_SECRET && process.env.NODE_ENV === 'production') {
    const message = 'POWER_AUTOMATE_SIGNING_SECRET is required when POWER_AUTOMATE_WEBHOOK_URL is configured';
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', failureReason: message },
    });
    return { logId: log.id, delivered: false, error: message };
  }

  const outboundBody = JSON.stringify({
    templateKey: payload.templateKey,
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    subject,
    body,
    logId: log.id,
    contextType: payload.context?.type,
    contextId: payload.context?.id,
    variables: payload.variables,
  });
  const signature = SIGNING_SECRET ? signBody(outboundBody, SIGNING_SECRET) : '';

  try {
    const res = await fetch(targetWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Wow-Signature': signature,
      },
      body: outboundBody,
    });

    if (!res.ok) {
      throw new Error(`Power Automate returned ${res.status}`);
    }

    const data: { runId?: string } = await res.json().catch(() => ({}));
    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        powerAutomateRunId: data.runId ?? null,
      },
    });

    return { logId: log.id, delivered: true, runId: data.runId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', failureReason: message },
    });
    return { logId: log.id, delivered: false, error: message };
  }
}
