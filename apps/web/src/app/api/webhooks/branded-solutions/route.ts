import { NextResponse, type NextRequest } from 'next/server';
import { ingestMaintenanceRequest } from '@/lib/maintenance/intake';

/**
 * Inbound webhook for the Branded Solutions Microsoft Form. Power
 * Automate posts the form payload here as soon as the customer hits
 * Submit; we persist the ticket, run round-robin, fan out SSE / bell
 * notifications, and echo a tiny summary back so Power Automate can
 * log the assignment.
 *
 * Security: when MAINTENANCE_INTAKE_SECRET is set, the request must
 * carry a matching `x-wow-signature` header. In dev the secret is
 * usually unset and the webhook is open — fine for local testing
 * because the URL itself is private to the tunnel.
 *
 * Power Automate body shape (minimum):
 * {
 *   "countryName":  "KSA",
 *   "cityName":     "Riyadh",
 *   "customerName": "Nestlé Saudi",
 *   "storeName":    "ninja shbra",
 *   "location":     "https://maps.app.goo.gl/...",
 *   "submitterName":"hassan",
 *   "contactNumber":"0562606750",
 *   "email":        "hassan@nestle.com",
 *   "machineModel": "thermoplan",
 *   "issueType":    "coffee machine not working after clean",
 *   "powerAutomateRunId": "@{workflow().run.name}"
 * }
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUIRED_FIELDS = [
  'countryName',
  'customerName',
  'storeName',
  'submitterName',
  'contactNumber',
  'email',
  'machineModel',
  'issueType',
] as const;

const INTAKE_SECRET = process.env['MAINTENANCE_INTAKE_SECRET'] ?? '';

interface InboundBody {
  countryName?: string;
  cityName?: string;
  customerName?: string;
  storeName?: string;
  location?: string;
  submitterName?: string;
  contactNumber?: string;
  email?: string;
  machineModel?: string;
  issueType?: string;
  powerAutomateRunId?: string;
  source?: string;
  // Power Automate sometimes wraps the form fields under a `body` or
  // `formResponse` key — accept either shape.
  body?: Record<string, unknown>;
  formResponse?: Record<string, unknown>;
}

export async function GET() {
  return NextResponse.json({
    status: 'Branded Solutions intake webhook is active',
    expectedFields: REQUIRED_FIELDS,
    secured: Boolean(INTAKE_SECRET),
  });
}

export async function POST(req: NextRequest) {
  if (INTAKE_SECRET) {
    const sig = req.headers.get('x-wow-signature');
    if (sig !== INTAKE_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: InboundBody;
  try {
    body = (await req.json()) as InboundBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Unwrap nested forms shapes.
  const inner = (body.formResponse ?? body.body ?? body) as Record<string, unknown>;
  const get = (k: string): string | undefined => {
    const raw = inner[k];
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'number') return String(raw);
    return undefined;
  };

  const missing = REQUIRED_FIELDS.filter((f) => !get(f) || (get(f) ?? '').trim().length === 0);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'Missing required fields', missing },
      { status: 400 },
    );
  }

  try {
    const result = await ingestMaintenanceRequest({
      countryName: get('countryName') as string,
      cityName: get('cityName') ?? null,
      customerName: get('customerName') as string,
      storeName: get('storeName') as string,
      location: get('location') ?? null,
      submitterName: get('submitterName') as string,
      contactNumber: get('contactNumber') as string,
      email: get('email') as string,
      machineModel: get('machineModel') as string,
      issueType: get('issueType') as string,
      powerAutomateRunId: get('powerAutomateRunId') ?? null,
      source: get('source') ?? 'MS_FORM',
      raw: body,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[branded-solutions/webhook] ingest failed:', err);
    return NextResponse.json(
      { error: 'Internal error', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
