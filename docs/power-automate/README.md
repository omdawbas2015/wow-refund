# Power Automate Integration

The WOW Refund platform talks to Office 365 through Power Automate
cloud flows. This folder ships **six importable flow packages** so you
can pick the security / functionality posture that matches your tenant
and import each one with two clicks.

> ⚡ **TL;DR** — open `make.powerautomate.com`, go to **My flows →
> Import → Import Package (Legacy)**, upload the `.zip` from
> [`packages/`](./packages/), map the connection(s), turn the flow
> **On**. Repeat for every package you want. Section [§ 5](#5--mapping-flows-to-platform-env-vars)
> tells you which env vars to set on the platform side.

> 🧪 **Want to do a sanity check first?** Import package #6
> ([`wow-test-customer-promo.zip`](./packages/wow-test-customer-promo.zip)),
> open the flow, click **Run**, fill in your own email + a fake promo
> code — you should receive a real promo email in seconds. That
> confirms your Outlook connection works end-to-end before you wire up
> the live mail router.

| # | Package | What it does | Direction | Security | Trigger | Connectors |
| - | ------- | ------------ | --------- | -------- | ------- | ---------- |
| 1 | [`wow-outbound-mailer.zip`](./packages/wow-outbound-mailer.zip) | **Single mail dispatcher** — sends every email the app produces (OTP, signup, approval, KNET, Aura, customer refund, **customer promo code**, scheduled reports, store help-desk) | App → Outlook | URL-secret | HTTP POST | Office 365 Outlook |
| 2 | [`wow-inbound-listener.zip`](./packages/wow-inbound-listener.zip) | Forwards manager / Finance / Aura / customer **replies** in the operator mailbox to the platform webhook | Outlook → App | None (dev) | New email arrives | Office 365 Outlook |
| 3 | [`wow-outbound-mailer-hmac.zip`](./packages/wow-outbound-mailer-hmac.zip) | Production hardening of #1 — verifies `X-Wow-Signature` HMAC-SHA256 before sending | App → Outlook | **HMAC verified** | HTTP POST | Office 365 Outlook + Azure Function |
| 4 | [`wow-inbound-listener-hmac.zip`](./packages/wow-inbound-listener-hmac.zip) | Production hardening of #2 — signs the body with HMAC-SHA256 before posting to the webhook | Outlook → App | **HMAC signed** | New email arrives | Office 365 Outlook + Azure Function |
| 5 | [`wow-approval-batch.zip`](./packages/wow-approval-batch.zip) | **Replaces** the plain `APPROVAL_BATCH_MANAGER` email with a real Microsoft Approvals card (Approve / Reject buttons in Outlook + Teams + PA mobile) | App → Approvals → App | URL-secret | HTTP POST | Microsoft Approvals + Outlook |
| 6 | [`wow-test-customer-promo.zip`](./packages/wow-test-customer-promo.zip) | **Sanity test only.** Manual button trigger that sends one promo-code email to whatever address you type. No platform integration — just confirms Outlook + mailbox + sender identity work. Delete after on-boarding. | Manual → Outlook | None (manual) | Button | Office 365 Outlook |
| 7 | [`wow-customer-promo-auto.zip`](./packages/wow-customer-promo-auto.zip) | **Auto-send promo email.** HTTP-triggered: every time the app allocates a promo to a customer, this flow forwards `CUSTOMER_PROMO_COMPENSATION` to Outlook with a styled HTML card (gradient header, code box, value/expires table). Filters on `templateKey` — anything other than the promo template returns 400. Wire into `POWER_AUTOMATE_PROMO_WEBHOOK_URL`, **or** branch off the main router via a `Switch` | App → Outlook | URL-secret (HTTP POST) | HTTP POST | Office 365 Outlook |

### Email templates the app produces (and which flow handles them)

The app pre-renders every email body locally using its own templates
table — Power Automate just receives the rendered subject + body and
forwards them. That means **all** outbound traffic flows through the
single mail-router (#1 or #3); there is no per-template flow except for
the optional Approvals override (#5).

| `templateKey` | Audience | When it fires | Locales | Goes through |
| --- | --- | --- | --- | --- |
| `AUTH_OTP_PASSWORD_RESET` | The user | Forgot-password / first-login set-password flow | en, ar | flow #1 (or #3) |
| `AUTH_ADMIN_NEW_SIGNUP` | All admins | New signup awaiting approval | en | flow #1 (or #3) |
| `AUTH_SIGNUP_APPROVED` | The user | Admin approved their signup | en | flow #1 (or #3) |
| `APPROVAL_BATCH_MANAGER` | Country manager | Daily batch of cases pending approval | en | flow #1 (or #3) — **or** route to flow #5 to use Approvals card |
| `KNET_BATCH_FINANCE` | Finance team | Daily KNET refund batch (Finance fills in ARN) | en | flow #1 (or #3) |
| `AURA_BATCH_TEAM` | Aura team | Daily Aura points refund batch | en | flow #1 (or #3) |
| `AURA_BATCH_SENT` | Internal | Aura batch confirmation from operations | en | flow #1 (or #3) |
| `CUSTOMER_REFUND_COMPLETED` | The customer | Refund processed end-to-end | en, ar | flow #1 (or #3) |
| `CUSTOMER_PROMO_COMPENSATION` | **The customer** | Goodwill promo code allocated | en | flow #1 (or #3) for the unified router · **flow #7 for a dedicated auto-send channel with rich HTML** · flow #6 for manual sanity testing |
| `STORE_<key>` | Store managers | Help-desk store-communication templates | en | flow #1 (or #3) |
| `scheduled_report.summary` | Admin | Scheduled report run | en | flow #1 (or #3) |

### Inbound replies the listener classifies (`parsedIntent`)

| `parsedIntent` | Trigger | Source mailbox | Becomes |
| --- | --- | --- | --- |
| `APPROVAL_RESPONSE` | Manager replies "Approved" / "Rejected" with case numbers | reply to a `APPROVAL_BATCH_MANAGER` email | Cases advance to `APPROVED` / `REJECTED` automatically |
| `KNET_ARN_REPLY` | Finance replies with ARN for each transaction | reply to a `KNET_BATCH_FINANCE` email | KNET batch components get their `arn` populated |
| `AURA_CONFIRMATION` | Aura team confirms each order processed | reply to a `AURA_BATCH_TEAM` email | Aura batch components transition to `AURA_CONFIRMED` |
| `CUSTOMER_REPLY` | Customer replies to any of their emails | from the customer's own mailbox | Logged on the case timeline for the agent |

The `-hmac` variants call a tiny Azure Function (
[`azure-function-hmac/`](./azure-function-hmac/) — deploy in 5 minutes
on the consumption plan, well inside the 1M-call/month free tier) so
they can compute the same HMAC-SHA256 hex digest the platform expects.
Use them in production. The non-HMAC packages are fine for
dev / staging where the trigger URL itself is enough secret.

The legacy zips are **regenerated** from the JSON definitions next door
by [`build-packages.py`](./build-packages.py):

```bash
python3 docs/power-automate/build-packages.py
```

Tweak a JSON, re-run, commit. Each zip has its own pre-allocated
`flowId`, so re-importing always lands as a fresh flow rather than
silently overwriting the old one.

---

## ملخّص بالعربي (Quick Arabic summary)

التمبلتس دي تتعمل **Import** على طول من
`make.powerautomate.com → My flows → Import → Import Package (Legacy)`.

- **باكدج رقم 6** ([`wow-test-customer-promo.zip`](./packages/wow-test-customer-promo.zip)) — **ابدأ بيها**. زرار Run يدوي
  بيبعت إيميل برومو كود تجريبي على أي مالبوكس تكتبه. خلصت تجربة
  ـ Outlook connection والمالبوكس قبل ما توصل أي حاجة جدية.
- **باكدج رقم 1** ([`wow-outbound-mailer.zip`](./packages/wow-outbound-mailer.zip)) — **هي اللي بتبعت كل الإيميلات**:
  OTP، signup approval، approval batch للمانجر، KNET للفاينانس، Aura
  للفريق، **برومو كود للكاستمر**، refund completed للكاستمر، store
  emails، scheduled reports. الـ app بيرندر السبجكت والبودي بنفسه
  وبيبعت كل حاجة على trigger URL واحد بـ `templateKey` مختلف.
- **باكدج رقم 2** ([`wow-inbound-listener.zip`](./packages/wow-inbound-listener.zip)) — بتاخد الردود من المانجر / الفاينانس / Aura /
  الكاستمر اللي جايه على الـ operator mailbox وتبعتها للـ app webhook
  عشان الـ classifier يحرك الـ batches.
- **باكدج رقم 3 و 4** — نسخة production من 1 و 2 بـ HMAC-SHA256
  verification (محتاجة Azure Function صغيرة تحت [`azure-function-hmac/`](./azure-function-hmac/)).
- **باكدج رقم 5** ([`wow-approval-batch.zip`](./packages/wow-approval-batch.zip)) — **بديل** للـ
  `APPROVAL_BATCH_MANAGER` بس. زرار Approve / Reject في Outlook +
  Teams بدل ما المانجر يرد بإيميل نصي.

ترتيب التركيب المقترح: 6 → 1 → 2 → (5 لو حابب). كل templateKey في الـ
catalog فوق بيمر من باكدج 1 (أو 3 لو HMAC).

كل اللي محتاج تعمله بعد الـ Import:
1. تربط الـ connections (Outlook + Approvals).
2. تفتح كل flow وتستبدل الـ placeholders زي `<APP_BASE_URL>` و
   `<HMAC_FUNCTION_BASE_URL>` و `<INBOUND_SECRET>`.
3. تعمل Save + Turn On.
4. تنسخ الـ HTTP POST URL من الـ outbound flow وتحطه في الـ
   `POWER_AUTOMATE_WEBHOOK_URL` على الـ app.

التفاصيل الكاملة لكل flow في الأقسام تحت بالإنجليزي.

---

## 0. Prerequisites

You need:

1. An **Office 365 mailbox** the team will use as the sender / receiver
   (e.g. `refund-ops@yourcompany.com`). A shared mailbox works fine but
   the user that owns the connection must have **Send As** rights.
2. The platform deployed at a **public HTTPS URL** — Power Automate must
   reach the webhook endpoint over the internet. `localhost` won't work;
   use ngrok / Cloudflare Tunnel for local testing.
3. Two **shared secrets** — `openssl rand -hex 32` produces a good one.
   Generate one for outbound (`OUTBOUND_SIGNING_SECRET`) and one for
   inbound (`INBOUND_SECRET`). Both go into the platform `.env`:
   ```env
   POWER_AUTOMATE_WEBHOOK_URL=https://prod-xx.westus.logic.azure.com:443/workflows/.../triggers/manual/paths/invoke?...
   POWER_AUTOMATE_SIGNING_SECRET=<OUTBOUND_SIGNING_SECRET>
   POWER_AUTOMATE_INBOUND_SECRET=<INBOUND_SECRET>
   ```
   You'll fill `POWER_AUTOMATE_WEBHOOK_URL` after the **outbound** flow
   is saved (the URL is auto-generated by Power Automate).
4. *(HMAC variants only)* An **Azure subscription** + **Functions Core
   Tools v4** — used to deploy the HMAC helper. Free tier covers the
   integration's typical traffic. See
   [`azure-function-hmac/README.md`](./azure-function-hmac/README.md).

---

## 0. Recommended import order

Import the flows roughly in this order — each step builds on the
previous one and lets you verify Power Automate is healthy before you
push customer-facing traffic through it.

| Step | Flow | What you confirm |
| --- | --- | --- |
| 0. Sanity test | **#6 `wow-test-customer-promo.zip`** | Outlook connection, mailbox identity, sending limits, anti-spam reputation. Click Run, fill in your own email, expect a real promo email in seconds. |
| 1. Outbound | **#1 `wow-outbound-mailer.zip`** (or #3 for HMAC) | The platform can send every email it produces (every `templateKey` in the catalog above). |
| 1b. (optional) Dedicated promo channel | **#7 `wow-customer-promo-auto.zip`** | A second outbound URL just for `CUSTOMER_PROMO_COMPENSATION`. Useful when the customer-facing promo email needs a different sender / branding / SLA than the operator mail. Either set `POWER_AUTOMATE_PROMO_WEBHOOK_URL` on the platform, or call it from #1 via a `Switch` on `templateKey`. |
| 2. Inbound | **#2 `wow-inbound-listener.zip`** (or #4 for HMAC) | Manager / Finance / Aura / customer replies make it back into the platform, get classified, advance batches automatically. |
| 3. *(Optional)* Approvals | **#5 `wow-approval-batch.zip`** | Country managers see one-click Approve / Reject cards in Outlook + Teams + PA mobile instead of replying with text. Wire up only after #1 + #2 are stable. |

You can stop after step 0 if you only want to confirm the tenant is
plumbed correctly. You can stop after step 2 if your managers prefer
text replies. Step 3 is purely UX upgrade.

---

## 1. Outbound flow — `wow-outbound-mailer.zip`

The platform POSTs JSON like this:

```jsonc
{
  "templateKey": "approval_batch_request",
  "to": "manager.kuwait@example.com",
  "cc": "ops@example.com",
  "bcc": null,
  "subject": "Approval batch APB-KW-2026-0001 — 5 cases for review",
  "body": "Hi team,\n\nPlease review the cases below…",
  "logId": "ckl3...",
  "contextType": "BATCH",
  "contextId": "ckl3...",
  "variables": { "batchNumber": "APB-KW-2026-0001", "caseCount": 5 }
}
```

Headers:

```
Content-Type: application/json
X-Wow-Signature: <hex HMAC-SHA256(rawBody, OUTBOUND_SIGNING_SECRET)>
```

Expected response: HTTP 200 with `{ "runId": "<flow run id>",
"logId": "<...>", "delivered": true }`.

### Import the package

1. `make.powerautomate.com` → **My flows → Import → Import Package
   (Legacy)** → upload [`packages/wow-outbound-mailer.zip`](./packages/wow-outbound-mailer.zip).
2. Map the **Office 365 Outlook** connection to the operator mailbox.
   If you don't have one yet, click *Create new* and sign in.
3. **Import**. The flow lands as a draft.
4. Open the flow → click the **trigger** → copy the **HTTP POST URL**
   into `POWER_AUTOMATE_WEBHOOK_URL` on the platform.
5. Toggle **Off → On**.

This package **does not verify HMAC** — the Power Automate trigger URL
is the secret. That's fine for staging / single-tenant deployments. If
you need server-side HMAC verification, use package #3 instead.

---

## 2. Inbound flow — `wow-inbound-listener.zip`

When an email lands in the operator mailbox whose subject contains
`APB-`, `KNET-`, or `AURA-`, this flow forwards a normalised payload to
the platform webhook so the inbound classifier picks it up.

Webhook expects:

```jsonc
{
  "fromEmail": "manager.kuwait@example.com",
  "toEmail": "refund-ops@yourcompany.com",
  "subject": "Re: Approval batch APB-KW-2026-0001 — 5 cases for review",
  "rawBody": "Approved 1, 2, 3\nRejected 4 (out of policy)\nNeed more info on 5",
  "powerAutomateRunId": "08585312..."
}
```

### Import the package

1. **Import → Import Package (Legacy)** →
   [`packages/wow-inbound-listener.zip`](./packages/wow-inbound-listener.zip).
2. Map the **Office 365 Outlook** connection.
3. **Import**, then open the flow.
4. In the **POST_to_webhook** action, replace `<APP_BASE_URL>` with
   your real platform URL (e.g. `https://refund.example.com`).
5. Save and turn the flow **On**.

This package **does not sign the body** — the platform's
`POWER_AUTOMATE_INBOUND_SECRET` must be **unset (or empty)** for the
webhook to accept the unsigned payload. That's fine for dev / staging
deployments behind a private URL. For production, use package #4.

---

## 3. Outbound flow (HMAC) — `wow-outbound-mailer-hmac.zip`

Same as package #1 but **verifies** the `X-Wow-Signature` header
server-side by calling the Azure Function HMAC helper before sending
the email. Returns 401 on signature mismatch.

### Import + configure

1. Deploy the Azure Function HMAC helper first — see
   [`azure-function-hmac/README.md`](./azure-function-hmac/README.md).
   Note the **base URL** (e.g. `https://wow-refund-pa-hmac.azurewebsites.net`)
   and the **default function key**.
2. **Import → Import Package (Legacy)** →
   [`packages/wow-outbound-mailer-hmac.zip`](./packages/wow-outbound-mailer-hmac.zip).
3. Map the **Office 365 Outlook** connection.
4. Open the flow → **Verify_signature_via_azure_function** action →
   replace:
   - `<HMAC_FUNCTION_BASE_URL>` → your Function App's base URL.
   - `<HMAC_FUNCTION_KEY>` → the function key from step 1.
   - `<OUTBOUND_SIGNING_SECRET>` → same value as
     `POWER_AUTOMATE_SIGNING_SECRET` on the platform.
5. Save + copy the trigger URL into `POWER_AUTOMATE_WEBHOOK_URL`.
6. Toggle **On**.

---

## 4. Inbound flow (HMAC) — `wow-inbound-listener-hmac.zip`

Same as package #2 but **signs** the outbound HTTP body so the
platform's `POWER_AUTOMATE_INBOUND_SECRET`-secured webhook accepts it.

### Import + configure

1. Deploy the Azure Function HMAC helper first.
2. **Import → Import Package (Legacy)** →
   [`packages/wow-inbound-listener-hmac.zip`](./packages/wow-inbound-listener-hmac.zip).
3. Map the **Office 365 Outlook** connection.
4. Open the flow → **Sign_via_azure_function** action → replace:
   - `<HMAC_FUNCTION_BASE_URL>`
   - `<HMAC_FUNCTION_KEY>`
   - `<INBOUND_SECRET>` → same value as
     `POWER_AUTOMATE_INBOUND_SECRET` on the platform.
5. **POST_to_webhook** → replace `<APP_BASE_URL>` with your platform
   URL.
6. Save + turn **On**.

---

## 5. Approval-batch flow — `wow-approval-batch.zip`

This is a **higher-level alternative** to the plain outbound mailer
*for `templateKey == "approval_batch_request"` only*. Instead of
sending a plain email, it:

1. Opens a **Microsoft Approvals** card with **Approve / Reject**
   buttons (delivered to the manager via Outlook + Teams + Power
   Automate mobile).
2. Waits indefinitely for the manager's response.
3. POSTs the response back to the platform's inbound webhook
   (`/api/webhooks/power-automate`) shaped as an
   `APPROVAL_RESPONSE` reply, so the platform's existing classifier
   advances the batch state automatically.

### When to use it

Use this **in addition to** the plain outbound mailer (#1 or #3) — keep
the plain mailer for KNET / Aura / OTP / SYSTEM emails, and route
`approval_batch_request` traffic to this approval flow.

### How to wire it

Either:
- **Single mailer**: keep `POWER_AUTOMATE_WEBHOOK_URL` pointed at the
  approval flow only when you've set
  `POWER_AUTOMATE_TEMPLATE_KEY_FILTER=approval_batch_request` on the
  platform. (Not implemented yet — see issue / TODO note.)
- **Recommended — branch in Power Automate**: keep
  `POWER_AUTOMATE_WEBHOOK_URL` on the plain outbound mailer; add a
  **Switch** action at the top of the plain mailer that routes
  `triggerBody()?['templateKey'] == 'approval_batch_request'` to
  *Trigger another flow* (this approval flow) and everything else to
  the existing **Send_an_email_(V2)** path.

### Import + configure

1. **Import → Import Package (Legacy)** →
   [`packages/wow-approval-batch.zip`](./packages/wow-approval-batch.zip).
2. Map the **Microsoft Approvals** connection (and **Office 365
   Outlook** if prompted — it's used to deliver the approval card).
3. Open the flow → **Start_and_wait_for_an_approval** action → replace
   `<APP_BASE_URL>` in **WebhookApprovalCreationInput/itemLink** with
   your platform URL so the manager can click *Open batch in WOW
   Refund* directly.
4. **POST_response_to_webhook** → replace `<APP_BASE_URL>` again.
5. *(Optional)* If your deployment uses HMAC-secured inbound, replace
   the **POST_response_to_webhook** action body with the
   `Sign_via_azure_function` + signed POST pattern from
   [`flows/inbound-flow-definition.hmac.json`](./flows/inbound-flow-definition.hmac.json).
6. Save + turn **On**.
7. Copy the trigger URL — that's the URL you point at when you want
   `approval_batch_request` traffic to use Approvals.

---

## 6. Test customer-promo flow — `wow-test-customer-promo.zip`

A **manual-trigger sanity flow** for the very first day. It produces
the same shape of email as the live `CUSTOMER_PROMO_COMPENSATION`
template (greeting, code box, value, expiry, brand sign-off) but
doesn't talk to the platform at all — you click **Run**, fill in a
few fields, and an email lands in the address you typed.

### Why use it

- Confirm Outlook → your operator mailbox connection is healthy.
- Confirm your sender identity (display name, From address) renders
  correctly to recipients.
- Confirm the email isn't getting flagged as spam by typical Gmail /
  Outlook.com inboxes.
- Demo the customer-facing promo email to stakeholders without
  spinning up the platform.

### Import + run

1. **Import → Import Package (Legacy)** →
   [`packages/wow-test-customer-promo.zip`](./packages/wow-test-customer-promo.zip).
2. Map the **Office 365 Outlook** connection.
3. Save the flow.
4. Open it → click **Run** in the top-right.
5. Fill in the form:
   - **Customer email** — use your own mailbox first; switch to a
     real customer only once you trust the output.
   - **Customer name** — e.g. "Test Customer".
   - **Brand name** — e.g. "WOW Burger" / "PaperMoon" / your test brand.
   - **Promo code** — anything, it's just for display.
   - **Value / Currency / Expires at** — anything, just for display.
6. Click **Run flow**. The customer mailbox should receive a real
   styled email within a few seconds.
7. Once you're happy, **delete the flow** — it has no place in a
   production tenant.

### When NOT to use it

This flow does **not** wire into `POWER_AUTOMATE_WEBHOOK_URL`, does
**not** verify HMAC, and does **not** create platform `EmailLog`
rows. It is purely a sanity check before you turn on the live
router (#1 / #3). Once you have proven the live mailer works, this
flow has no further role.

---

## 7. Auto-send customer-promo flow — `wow-customer-promo-auto.zip`

A **production HTTP-triggered flow** that is dedicated to a single
template: `CUSTOMER_PROMO_COMPENSATION`. Use it when you want the
customer-facing promo email to look polished (gradient header, code
box, value/expires table, brand sign-off) without having to embed
that HTML inside the unified router (#1 / #3).

It accepts the same dispatcher payload as flow #1 — `templateKey`,
`to`, `subject`, `body`, `variables` — but only acts on payloads
where `templateKey == "CUSTOMER_PROMO_COMPENSATION"`. Anything else
returns **400** so misroutes are obvious. The HTML body is built from
the `variables` block (`customerName`, `promoCode`, `value`,
`currency`, `expiresAt`, `brandName`); each falls back to a sensible
default via `coalesce(...)`.

### Two ways to wire it up

**Option A — dedicated webhook URL (cleanest):**

1. **Import → Import Package (Legacy)** →
   [`packages/wow-customer-promo-auto.zip`](./packages/wow-customer-promo-auto.zip).
2. Map the **Office 365 Outlook** connection.
3. Save → Turn on → copy the HTTP POST URL of the trigger.
4. Set on the platform:
   ```
   POWER_AUTOMATE_PROMO_WEBHOOK_URL=https://prod-XX.westeurope.logic.azure.com/...
   ```
   (The dispatcher will preferentially route
   `CUSTOMER_PROMO_COMPENSATION` to this URL when set, falling back to
   `POWER_AUTOMATE_WEBHOOK_URL` otherwise.)

**Option B — branch off the main router:**

Keep `POWER_AUTOMATE_WEBHOOK_URL` pointing at flow #1 / #3, then in
that flow add a `Switch` on `triggerBody()?['templateKey']` and have
the `CUSTOMER_PROMO_COMPENSATION` case POST to flow #7's trigger URL
instead of calling Send-Email directly. Useful if you want every
outbound email tracked in the same Power Automate run history.

### Smoke test before going live

```bash
curl -X POST '<flow-7-trigger-url>' \
  -H 'Content-Type: application/json' \
  -d '{
    "templateKey": "CUSTOMER_PROMO_COMPENSATION",
    "to": "you@example.com",
    "subject": "A little something from Chipotle",
    "body": "plain-text fallback",
    "logId": "manual-smoke-1",
    "variables": {
      "customerName": "Berka",
      "promoCode": "C-CHI-BH-25-S852RS",
      "value": "25",
      "currency": "BHD",
      "expiresAt": "2026-12-31",
      "brandName": "Chipotle"
    }
  }'
```

A `200` with `delivered: true` means the styled HTML promo email
just landed in the recipient's mailbox.

---

## 8. Mapping flows to platform env vars

| Env var | Used by | Set to |
| ------- | ------- | ------ |
| `POWER_AUTOMATE_WEBHOOK_URL` | App → outbound mailer (#1 / #3) or approval flow (#5) | the trigger URL of the flow you chose |
| `POWER_AUTOMATE_PROMO_WEBHOOK_URL` | App → dedicated promo channel (#7) | the trigger URL of flow #7. Optional. When unset, `CUSTOMER_PROMO_COMPENSATION` falls back to `POWER_AUTOMATE_WEBHOOK_URL` |
| `POWER_AUTOMATE_SIGNING_SECRET` | App → outbound (#3 verifies it server-side) | a 32-byte random hex string; same value goes into the `<OUTBOUND_SIGNING_SECRET>` placeholder in flow #3 |
| `POWER_AUTOMATE_INBOUND_SECRET` | Inbound webhook → app | a 32-byte random hex string; **must be unset / empty** for #2; **must match `<INBOUND_SECRET>`** for #4 |

Leave a value blank to **disable** that auth layer. The platform
explicitly tolerates a blank `POWER_AUTOMATE_INBOUND_SECRET` and will
accept unsigned inbound payloads — that's how the unsigned listener
package #2 works.

---

## 9. Test the integration locally

### a) Smoke-test the **inbound** webhook (no Power Automate needed)

[`test-webhook.sh`](./test-webhook.sh) POSTs each of the four sample
payloads in [`sample-payloads/`](./sample-payloads/) and prints the
classified intent.

```bash
# Localhost, secret unset
./test-webhook.sh

# Against staging, with HMAC enabled
APP_URL=https://staging.example.com \
  INBOUND_SECRET=$(cat .secret) \
  ./test-webhook.sh
```

Expect:

```
→ approval reply         status=200  ok=true   intent=APPROVAL_RESPONSE
→ KNET ARN reply         status=200  ok=true   intent=KNET_ARN_REPLY
→ Aura confirmation      status=200  ok=true   intent=AURA_CONFIRMATION
→ unrelated email        status=200  ok=true   intent=IGNORED
```

On a fresh DB the approval / KNET / Aura payloads will report
`IGNORED` (with reason "unknown ... batch") — that's correct
behaviour, not a failure. To see real classification first create the
matching batches via the operations desk and update the sample
subjects.

### b) Smoke-test the **outbound** flow without sending a real email

Hit the trigger URL with `curl`:

```bash
curl -sS -X POST "$POWER_AUTOMATE_WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -H "X-Wow-Signature: $(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$OUTBOUND_SIGNING_SECRET" | awk '{print $NF}')" \
  -d "$BODY"
```

For the HMAC variant, the flow returns 401 on signature mismatch
without sending the email — flip a byte in `BODY` and re-run to
confirm.

---

## 10. Editing the flows

The JSON in `flows/` is the source of truth. To customise:

1. Open `flows/<the-flow>.json` in your editor.
2. Modify the action / trigger you care about. The
   [Logic Apps WDL reference](https://learn.microsoft.com/azure/logic-apps/logic-apps-workflow-definition-language)
   covers every supported expression / type.
3. Regenerate the zips:
   ```bash
   python3 docs/power-automate/build-packages.py
   ```
4. Re-import the zip into Power Automate (it imports as a **new** flow
   because the build script allocates a fresh `flowId` each run).
   Delete the old draft once the new one is configured.

If you want to tweak a flow that's already running in production
without re-importing, you can paste the `definition` block directly via
**Code view** in Power Automate's editor — useful for one-off fixes,
but commit the change back to `flows/` afterwards so the repo stays the
source of truth.
