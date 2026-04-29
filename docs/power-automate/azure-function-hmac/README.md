# Azure Function — HMAC helper for Power Automate

Power Automate's workflow language has no built-in HMAC primitive. This
folder ships a tiny **Azure Functions** app (Node.js v20) that exposes
`/api/sign` and `/api/verify` endpoints. The HMAC-secured Power Automate
flow variants (`outbound-flow-definition.hmac.json`,
`inbound-flow-definition.hmac.json`) call these endpoints over HTTPS so
they can compute the same HMAC-SHA256 hex digest the WOW Refund app
expects on `X-Wow-Signature`.

## Endpoints

| Method | Path | Body | Returns |
| ------ | ---- | ---- | ------- |
| POST | `/api/sign` | `{ "body": "<raw json>", "secret": "<shared secret>" }` | `{ "signature": "<hex>" }` |
| POST | `/api/verify` | `{ "body": "<raw json>", "signature": "<hex>", "secret": "<shared secret>" }` | `{ "valid": true \| false }` |

Both endpoints are protected by the Function App's **function key** (set
in the request via `?code=<key>` or `x-functions-key` header). The
function key is what authenticates Power Automate; treat it as a real
secret.

## Deploy

Prerequisite: Azure CLI + Functions Core Tools v4 + an Azure subscription.

```bash
# 1. From the repo root
cd docs/power-automate/azure-function-hmac
npm install

# 2. Create the Azure resources (one-time, ~3 minutes)
RG=wow-refund-pa-hmac-rg
LOC=westeurope          # pick your region
STORAGE=wowrefundpahmac # must be globally unique, lowercase, < 24 chars
APP=wow-refund-pa-hmac  # must be globally unique

az group create --name "$RG" --location "$LOC"
az storage account create --name "$STORAGE" --resource-group "$RG" \
  --location "$LOC" --sku Standard_LRS
az functionapp create --consumption-plan-location "$LOC" \
  --name "$APP" --resource-group "$RG" \
  --runtime node --runtime-version 20 --functions-version 4 \
  --storage-account "$STORAGE"

# 3. Publish the code
func azure functionapp publish "$APP"

# 4. Grab the function key (Power Automate uses this)
az functionapp keys list --name "$APP" --resource-group "$RG" \
  --query 'functionKeys.default' -o tsv
```

You'll end up with a base URL like
`https://wow-refund-pa-hmac.azurewebsites.net/api/` and a function key
that you'll plug into the HMAC-secured Power Automate flow variants.

## Cost

Consumption plan: free for the first 1 million executions per month, then
$0.20 per million. The WOW Refund integration calls these endpoints once
per email sent and once per inbound reply received — well inside the free
tier for normal operation.

## Run locally for testing

```bash
npm install
func start
```

Then:

```bash
curl -s -X POST http://localhost:7071/api/sign \
  -H "Content-Type: application/json" \
  -d '{"body":"hello","secret":"shh"}'
# → {"signature":"5a96c3f04f1e8ec9..."}
```

Locally there's no function key (auth is disabled). Production
deployments enforce the key automatically.

## Why a separate function?

- **Power Automate has no HMAC primitive.** All native expression
  attempts to implement HMAC-SHA256 with `hash`, `dataUriToBinary`,
  `base64ToBinary`, etc. require byte-level XOR — which WDL doesn't
  expose. We tried.
- **The premium "Inline Code" connector** would work but requires a
  Power Automate Per-User-with-Attended-RPA license per flow user.
- **An Azure Function** is a one-time 5-minute deploy on a free tier
  and works for every flow in every tenant.
