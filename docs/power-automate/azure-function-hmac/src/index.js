/**
 * WOW Refund — HMAC helper Azure Function.
 *
 * Power Automate's workflow definition language has no native HMAC
 * primitive. This tiny Functions app exposes two endpoints that the
 * Power Automate HTTP action can call to compute and verify the same
 * HMAC-SHA256 hex digest the WOW Refund app uses on its webhooks.
 *
 *   POST /api/sign     { "body": "<raw json>", "secret": "<shared secret>" }
 *     → 200 { "signature": "<hex>" }
 *
 *   POST /api/verify   { "body": "<raw json>", "signature": "<hex>",
 *                        "secret": "<shared secret>" }
 *     → 200 { "valid": true|false }
 *
 * Both endpoints are protected by the Functions function-key auth
 * (`?code=<key>` or `x-functions-key` header). Treat the function key as
 * sensitive — it grants the ability to compute valid signatures.
 *
 * Deploy with:
 *   az functionapp create --consumption-plan-location <region> \
 *     --name <function-app-name> --resource-group <rg> \
 *     --runtime node --runtime-version 20 --functions-version 4 \
 *     --storage-account <storage>
 *   func azure functionapp publish <function-app-name>
 */

const { app } = require('@azure/functions');
const { createHmac, timingSafeEqual } = require('node:crypto');

function signBody(body, secret) {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

function verifyBodySignature(body, providedSignature, secret) {
  if (!body || !providedSignature || !secret) return false;
  const normalized = providedSignature.startsWith('sha256=')
    ? providedSignature.slice(7)
    : providedSignature;
  const expected = signBody(body, secret);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(normalized, 'utf8');
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

app.http('sign', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON' } };
    }
    const { body, secret } = payload ?? {};
    if (typeof body !== 'string' || !body) {
      return { status: 400, jsonBody: { error: 'body must be a non-empty string' } };
    }
    if (typeof secret !== 'string' || !secret) {
      return { status: 400, jsonBody: { error: 'secret must be a non-empty string' } };
    }
    const signature = signBody(body, secret);
    context.log(`signed body of length ${body.length}`);
    return { status: 200, jsonBody: { signature } };
  },
});

app.http('verify', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON' } };
    }
    const { body, signature, secret } = payload ?? {};
    if (typeof body !== 'string' || !body) {
      return { status: 400, jsonBody: { error: 'body must be a non-empty string' } };
    }
    if (typeof signature !== 'string' || !signature) {
      return { status: 400, jsonBody: { error: 'signature must be a non-empty string' } };
    }
    if (typeof secret !== 'string' || !secret) {
      return { status: 400, jsonBody: { error: 'secret must be a non-empty string' } };
    }
    const valid = verifyBodySignature(body, signature, secret);
    context.log(`verify: valid=${valid}`);
    return { status: 200, jsonBody: { valid } };
  },
});
