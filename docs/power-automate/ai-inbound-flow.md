# AI-driven inbound flow — explicit-approval gate

This document describes a **second, AI-enhanced inbound flow** that you
can use *instead of* the basic `wow-inbound-listener` package.

The original inbound flow simply forwards every reply email to
`/api/webhooks/power-automate` and lets the server-side regex parser
decide what happened. That works for the happy path ("Approved." in
the body), but it has two gaps the team explicitly wanted closed:

1. **Anyone who can send email to the inbox can drive a decision.** A
   typo or a forwarded thread from outside the manager group can flip
   a refund to APPROVED. We want the system to *only* accept an
   approval from the country managers we explicitly assigned to a
   batch.
2. **Regex-based intent detection is brittle.** Replies in the wild
   look more like *"Yes please go ahead with refund — except CRM-100002
   which is fraud, and ARN for CRM-100001 is 8473…"*. A regex misses
   the nuance; we want the LLM to read the email and emit a structured
   decision the server can apply atomically.

This flow uses **AI Builder's *Create text with GPT* action** (or, if
your tenant doesn't have AI Builder, an **Azure OpenAI · Chat
completion** action) to do the parsing **inside** the Power Automate
flow, then POSTs an enriched payload to the existing webhook. The
server then enforces the manager allowlist and applies the AI's
decisions.

> **Backend support.** The webhook now accepts an additional
> `aiParsed` field (see schema below). The server enforces a
> per-batch sender allowlist regardless of whether `aiParsed` is
> present, so the AI step is *additive*, not a replacement for the
> server-side checks.

---

## 1. End-to-end shape

```
Outlook (shared mailbox)
        │  manager replies "Approved" / "Reject CRM-100002" / etc.
        ▼
Power Automate flow
  ① "When a new email arrives (V3)"        ─ trigger
  ② "Get user profile"                      ─ make sure the sender exists in the M365 tenant (filters out spoofed externals)
  ③ "Create text with GPT"                  ─ AI Builder prompt → JSON
  ④ "Parse JSON"                            ─ schema-validate the AI output
  ⑤ "Condition: aiParsed.intent != UNCLEAR" ─ otherwise short-circuit + reply asking for clarification
  ⑥ "HTTP — POST /api/webhooks/power-automate"
        │
        ▼
WOW Refund app
  ⑦ Verify x-wow-signature header
  ⑧ processInboundReply()
       ├── if aiParsed.intent === 'UNCLEAR'  → audit + leave inbound row FAILED, no DB changes
       ├── verify fromEmail is on the batch's recipientEmails OR a known
       │     COUNTRY_MANAGER for the batch's country (audit + reject otherwise)
       ├── apply per-case / blanket decisions from aiParsed (preferred)
       │     OR fall back to the regex parser when aiParsed is missing
       └── update batch status, write activity log, send notifications
```

---

## 2. The HTTP payload the app expects

```jsonc
{
  // Always present — same shape as the existing inbound webhook.
  "fromEmail": "manager.kw@wow.local",
  "toEmail":   "refunds@wow.local",
  "subject":   "RE: Approval batch APB-KW-2026-0001 — 5 cases for review",
  "rawBody":   "<original plain-text body, signature included>",
  "powerAutomateRunId": "08585312…",

  // NEW — AI-parsed verdict from your GPT action.
  "aiParsed": {
    // One of the discrete intents the app understands. Returning
    // "UNCLEAR" is the safe default whenever the AI cannot tell.
    "intent": "APPROVAL_RESPONSE",
    "confidence": 0.93,

    // For "APPROVAL_RESPONSE" / "AURA_CONFIRMATION":
    // - blanket: applies to every PENDING case in the batch when
    //   the manager's reply doesn't enumerate cases.
    // - perCase: explicit per-case decisions; takes precedence over
    //   blanket. caseNumber must match RefundCase.caseNumber exactly
    //   (e.g. "REF-KW-2026-000001"). External CRM-style numbers
    //   (e.g. "CRM-100002") should be resolved to internal numbers
    //   by the AI prompt — see §4.
    "blanket": "APPROVED",
    "perCase": [
      { "caseNumber": "REF-KW-2026-000002", "decision": "REJECTED" }
    ],

    // For "KNET_ARN_REPLY":
    // - arns: each entry maps a refund case to its bank ARN. The
    //   server matches by caseNumber inside the batch.
    "arns": [
      { "caseNumber": "REF-KW-2026-000001", "arn": "847312009912" }
    ],

    // Required when intent === "UNCLEAR".
    "reason": "Reply contains hedging language and no explicit verdict."
  }
}
```

The `aiParsed` object is **optional**. Omitting it preserves the old
behaviour (server-side regex parser). When present:

- `intent === 'UNCLEAR'` → the server records an audit entry, marks
  the inbound email as `FAILED`, and never touches the batch.
- `intent === 'APPROVAL_RESPONSE'` and `'AURA_CONFIRMATION'` →
  `perCase` is applied first; if empty, `blanket` is fanned out over
  every case still pending in the batch.
- `intent === 'KNET_ARN_REPLY'` → `arns[]` is applied directly,
  skipping the regex ARN parser.

---

## 3. Sender allowlist (server-side, always on)

The webhook now runs an `isAuthorizedSender` check **before** applying
any decision, regardless of whether `aiParsed` is set.

A reply is accepted if **either**:

1. The lowercased `fromEmail` appears in the batch's `recipientEmails`
   field (the address(es) we originally sent the batch to), **or**
2. `fromEmail` belongs to an *active*, non-deleted `User` row whose
   `role.key` is in the per-batch-type allowlist:

   | Batch type     | Allowed roles            | Country must match? |
   | -------------- | ------------------------ | ------------------- |
   | Approval batch | `MANAGER`, `ADMIN`       | Yes — `User.primaryCountryId` must equal `batch.countryId` |
   | KNET batch     | `FINANCE`, `ADMIN`       | No (KNET is global)  |
   | Aura batch     | `OPERATIONS`, `ADMIN`    | No (Aura is global)  |

Anything else → the webhook returns `intent: 'UNAUTHORIZED_SENDER'`,
the inbound row is parked as `FAILED`, an `AuditLog` row of action
`inbound.unauthorized_sender` is written, and **no case status is
changed**. Admins can review unauthorized inbounds from the inbound
emails admin panel.

This is defence-in-depth: even if the Power Automate flow forgot to
filter sender, or someone replays a captured payload, the server will
still refuse to act on it.

---

## 4. The AI Builder / GPT prompt

Use the prompt below in your **Create text with GPT** (AI Builder) or
**Azure OpenAI · Chat completion** action. It returns *only* JSON
matching the `aiParsed` schema in §2.

> Pass the email's `Subject` and `Body (plain text)` as variables; do
> **not** include attachments. If you have access to the batch's case
> list at the time of the reply, also pass the comma-separated list
> of `caseNumber`s as a variable — that lets the model translate the
> manager's customer-facing references (`CRM-100002`, `Order
> 2002033`) to the canonical internal numbers (`REF-KW-2026-000002`).

````text
You are a strict email classifier for a refund-operations system.
Given a reply email, return ONLY a single JSON object that conforms
to the schema below — no prose, no markdown fences.

The schema:

{
  "intent": "APPROVAL_RESPONSE" | "KNET_ARN_REPLY" | "AURA_CONFIRMATION"
          | "CUSTOMER_REPLY"    | "UNCLEAR",
  "confidence": <number between 0 and 1>,
  "blanket":  "APPROVED" | "REJECTED" | null,
  "perCase":  [ { "caseNumber": "<REF-...>", "decision": "APPROVED" | "REJECTED" } ],
  "arns":     [ { "caseNumber": "<REF-...>", "arn": "<digits>" } ],
  "reason":   "<short string, required when intent === 'UNCLEAR'>"
}

RULES:

1. Set "intent" to "UNCLEAR" if you are not >= 90% sure the reply
   contains an explicit, unambiguous decision. Examples that ARE
   unclear: "looks ok I guess", "let me check", "thanks, will
   review", "FYI". Forwarded threads where the manager only adds
   "FYI" or "noted" are also UNCLEAR.

2. Set "intent" to "APPROVAL_RESPONSE" when the email is a manager
   replying about cases that need approval (subject contains an
   APB-XX-YYYY-NNNN batch number, or the body lists REF-XX-YYYY-NNNNNN
   case numbers and uses approve/reject verbs). Use:
   - "blanket": "APPROVED" if the reply globally approves everything
     ("approved", "approve all", "go ahead", "موافق", "أوافق", "تم
     الاعتماد", "yes please refund"). Set "blanket": "REJECTED" for
     globally negative replies.
   - "perCase": [...] when the reply lists specific cases. Match each
     listed case number to the canonical "REF-XX-YYYY-NNNNNN" form.
     If the manager uses an external reference like "CRM-100002" or
     "Order 2002033", look it up in the AVAILABLE_CASES variable and
     emit the matching REF-... number. If you can't resolve it, drop
     that entry rather than guessing.
   - When both blanket and perCase appear in the email (e.g.
     "approve all except CRM-100002"), set blanket = the global
     decision AND list the exceptions in perCase with the opposite
     decision.

3. Set "intent" to "KNET_ARN_REPLY" when the email is from Finance
   replying with bank ARNs. Populate `arns[]` with each
   { caseNumber, arn } pair you can extract. Match cases by
   REF-... numbers exactly; ignore lines without a clear case ↔ ARN
   pairing.

4. Set "intent" to "AURA_CONFIRMATION" when the email is from the
   Aura points operations team confirming or rejecting Aura refund
   batches (subject contains AURA-YYYY-NNNN). Same blanket / perCase
   semantics as APPROVAL_RESPONSE — APPROVED means "Aura processed",
   REJECTED means "Aura failed / did not process".

5. Set "intent" to "CUSTOMER_REPLY" when the sender is the customer
   (not a manager / Finance / Aura), regardless of content.

6. Always include "reason" when intent === "UNCLEAR". Keep it under
   200 chars and explain WHY the email is ambiguous.

NEVER guess. When in doubt, return UNCLEAR.

INPUT:
  Subject: {{Subject}}
  Body:    {{Body}}
  AVAILABLE_CASES (caseNumber → externalCaseNumber, comma-separated):
    {{AvailableCases}}
````

The expected output is a single line of JSON; feed it directly into
**Parse JSON** with the schema in
[`flows/ai-parsed-reply-schema.json`](./flows/ai-parsed-reply-schema.json).

---

## 5. Quick install — Solution ZIP

A pre-built importable package is shipped at
[`packages/wow-ai-inbound-listener.zip`](./packages/wow-ai-inbound-listener.zip).
Use it for the fastest path to a working flow:

1. Open Power Automate → **My flows → Import → Import Package
   (Legacy)** → upload the ZIP.
2. The wizard asks you to bind the **Office 365 Outlook** connector;
   pick (or create) the connection that owns the shared mailbox.
3. Click **Import**. The flow lands as a draft.
4. Open the flow → edit the four `Initialize variable` actions at the
   top and replace the placeholders with your real values:
   - `appBaseUrl` → public URL of the WOW Refund app, e.g.
     `https://refund.example.com` (no trailing slash).
   - `inboundSecret` → the value of `POWER_AUTOMATE_INBOUND_SECRET`
     in the platform's `.env`.
   - `aoaiEndpoint` → the full Azure OpenAI Chat Completions URL,
     e.g. `https://<resource>.openai.azure.com/openai/deployments/<deployment>/chat/completions?api-version=2024-08-01-preview`.
     (The flow uses the REST API directly, so AI Builder licensing
     is **not** required.)
   - `aoaiKey` → your Azure OpenAI resource key.
5. Optional — the `availableCases` variable is empty by default. If
   you can fetch the case list for the batch in the subject (e.g. by
   adding an HTTP action to call the platform), populate it as
   `REF-KW-2026-000001=CRM-100001, REF-KW-2026-000002=CRM-100002` so
   the AI can translate customer-facing CRM numbers to canonical
   `REF-…` numbers.
6. Save → **Turn on**.

Send a test reply from a manager who is on the batch's
`recipientEmails` and check the run history. Inside the platform the
inbound row should show `parsedIntent: 'APPROVAL_RESPONSE'` and the
batch's cases should be moved to APPROVED / REJECTED according to
the AI verdict.

> **Don't want to use the ZIP?** The full Code-view JSON is at
> [`flows/ai-inbound-flow-definition.json`](./flows/ai-inbound-flow-definition.json) —
> create a new "Automated cloud flow" in Power Automate and paste it
> into the Code view, or build it action-by-action with the
> click-through guide below.

---

## 6. Click-through setup (manual)

Reuse the existing inbound flow steps (1, 2, 7 from
[`README.md` §2](./README.md)) and insert the AI step between them.

1. **Trigger** — `Office 365 Outlook · When a new email arrives
   (V3)`. Configure folder = the shared mailbox you set up.
2. **Get user profile (V2)** — UPN = the email's `From` address.
   - Add a **Configure run after** on this action so the flow only
     proceeds on success. Failures here mean the sender isn't even
     in your M365 tenant (likely external) — terminate the flow.
3. **(Optional) Compose — AvailableCases** — call the app's
   `/api/internal/batch/{number}/cases` endpoint (or query Dataverse)
   to get the list of `caseNumber → externalCaseNumber` for the
   batch referenced in the subject. Concatenate as
   `REF-KW-2026-000001=CRM-100001, REF-KW-2026-000002=CRM-100002`.
4. **Create text with GPT** (AI Builder) — paste the prompt from §4.
   Pass:
   - `Subject` → `triggerBody()?['Subject']`
   - `Body`    → `triggerBody()?['Body']` (use the *plain-text* body,
     not the HTML one, to keep the prompt cheap and stable)
   - `AvailableCases` → output of step 3 (or empty string if you
     skipped it)
5. **Parse JSON** — Content = `outputs('Create_text_with_GPT')?['body']
   ?['responseV2']?['predictionOutput']?['text']`, Schema =
   contents of `flows/ai-parsed-reply-schema.json`.
6. **Condition** — `body('Parse_JSON')?['intent']` `is equal to`
   `UNCLEAR`.
   - **If yes** → `Office 365 Outlook · Reply to email (V3)` with a
     short *"Hi — could you clarify whether this is APPROVED or
     REJECTED, and which cases?"* template. Then **Terminate** with
     status `Succeeded`.
   - **If no** → continue to step 7.
7. **HTTP — POST** to `${WOW_BASE_URL}/api/webhooks/power-automate`.
   - Headers: `Content-Type: application/json`, `x-wow-signature:
     <INBOUND_SECRET>`.
   - Body — see below.

```json
{
  "fromEmail":  "@{triggerBody()?['From']}",
  "toEmail":    "@{first(triggerBody()?['To'])}",
  "subject":    "@{triggerBody()?['Subject']}",
  "rawBody":    "@{triggerBody()?['Body']}",
  "powerAutomateRunId": "@{workflow()?['run']?['name']}",
  "aiParsed":   "@{body('Parse_JSON')}"
}
```

8. **Configure run after** on the HTTP action: also run when the
   condition's *false* branch finished. Add a final **Compose** at
   the end with the HTTP response so you can audit it from the run
   history.

---

## 7. Sample payloads

| Scenario | Sample |
| -------- | ------ |
| Manager approves all | [`sample-payloads/inbound-ai-approval.json`](./sample-payloads/inbound-ai-approval.json) |
| Manager approves all except one | [`sample-payloads/inbound-ai-approval-mixed.json`](./sample-payloads/inbound-ai-approval-mixed.json) |
| Finance returns ARNs | [`sample-payloads/inbound-ai-knet-arns.json`](./sample-payloads/inbound-ai-knet-arns.json) |
| AI says UNCLEAR | [`sample-payloads/inbound-ai-unclear.json`](./sample-payloads/inbound-ai-unclear.json) |
| Sender not on allowlist | [`sample-payloads/inbound-ai-unauthorized.json`](./sample-payloads/inbound-ai-unauthorized.json) |

You can replay any of them against a running app with:

```bash
curl -X POST "$WOW_BASE_URL/api/webhooks/power-automate" \
  -H 'Content-Type: application/json' \
  -H "x-wow-signature: $POWER_AUTOMATE_INBOUND_SECRET" \
  --data-binary @docs/power-automate/sample-payloads/inbound-ai-approval.json
```

The expected response is `200 OK` with a JSON body whose `intent`
field is one of `APPROVAL_RESPONSE`, `KNET_ARN_REPLY`,
`AURA_CONFIRMATION`, `UNAUTHORIZED_SENDER`, `UNCLEAR_INTENT`, or
`IGNORED`.

---

## 8. Operational notes

- **Audit trail.** Both unauthorised senders and AI-`UNCLEAR` verdicts
  are persisted in `audit_log` (actions
  `inbound.unauthorized_sender` and `inbound.ai_unclear`) **and** in
  `inbound_email` with `parseStatus = 'FAILED'`. Surface them in the
  admin → inbound emails panel so ops can decide whether to ask the
  manager for clarification or process manually.
- **Manager whitelist drift.** When you add a new country manager,
  make sure their User row has `role.key = 'MANAGER'`,
  `status = 'ACTIVE'`, and the right `primaryCountryId` — otherwise
  their replies will be rejected as unauthorized.
- **Replay protection.** If the same `powerAutomateRunId` arrives
  twice (e.g. a flow retry after a timeout), the second call is a
  no-op for already-decided cases thanks to the per-case
  `status: 'PENDING_APPROVAL'` guard inside the transaction. The
  inbound row is still recorded for audit.
- **Cost.** A typical reply email is ~600 input tokens + ~120
  output tokens for the AI step. With GPT-4o-mini that's well under
  $0.001 per reply.
