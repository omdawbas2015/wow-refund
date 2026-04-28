# WOW Refund — Enterprise Refund Management Platform

Production-grade refund platform for multi-country, multi-brand operations with Power Automate email integration. Self-hosted Docker + Kubernetes ready.

## Stack

- **Framework:** Next.js 15 (App Router, RSC, Server Actions, standalone output)
- **API:** Next Route Handlers + React Server Actions (no tRPC — was evaluated and dropped as unused)
- **Database:** Prisma 6 + PostgreSQL · SQLite for local dev
- **Auth:** Auth.js v5 (credentials) with admin-approval signup flow
- **UI:** shadcn/ui + Tailwind v4 + Radix primitives
- **i18n:** next-intl (Arabic + English, full RTL support)
- **Email:** Power Automate webhooks (outbound + inbound replies)
- **Cache/Realtime:** Redis for notifications fan-out, exchange rates, rate limiting
- **Observability:** Sentry (errors + session replay) · Pino-shaped structured logs
- **Hosting:** Self-hosted Docker / Kubernetes (1 master + N workers)
- **Monorepo:** Turborepo + pnpm workspaces

## Repo Layout

```
.
├── apps/
│   └── web/                # Next.js 15 application
├── packages/
│   ├── db/                 # Prisma schemas (sqlite + postgres), client, migrations, seed
│   ├── ui/                 # Shared React components
│   ├── validators/         # Shared Zod schemas
│   └── config/             # Shared TS / ESLint / Tailwind configs
├── k8s/
│   ├── base/               # Kustomize base (namespace, configmap, postgres, redis, web, jobs)
│   └── overlays/dev/       # Example dev overlay
├── docs/
│   ├── DOCKER.md           # Operator manual: Dockerfile, compose, GHCR, schema sync
│   └── K8S.md              # Operator manual: apply order, secrets, backups, rolling deploys
├── Dockerfile              # 4-stage production build (Next.js standalone, ~283MB)
├── docker-compose.yml      # Postgres-only for local dev
├── docker-compose.full.yml # Full prod-like stack (postgres + redis + web)
└── HANDOVER.md             # Project memory: state, sprints, what's done / what's next
```

## Quick start — local development

```bash
pnpm install
pnpm db:migrate                    # Prisma migrations against local SQLite (dev.db)
SEED_DEMO_CASES=1 pnpm db:seed     # 69 currencies, 142 countries, RBAC, 5 demo cases, admin user
pnpm dev                           # Next.js on http://localhost:3000
```

Default admin: `admin@wow.local` / `admin123`

## Quick start — production-like local stack (Docker)

```bash
docker compose -f docker-compose.full.yml up -d
# postgres:16-alpine + redis:7-alpine + the production image, all wired together.
# /api/health → http://localhost:3000/api/health
```

Full Docker reference: <a href="docs/DOCKER.md"><code>docs/DOCKER.md</code></a>.

## Quick start — Kubernetes (self-hosted)

```bash
# 1. CI builds + pushes the image to ghcr.io/omdawbas2015/wow-refund on every push (see .github/workflows/docker-build.yml).

# 2. Apply manifests:
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/configmap.yaml

# 3. Create the real Secret (do NOT commit values):
kubectl -n wow-refund create secret generic wow-secrets \
  --from-literal=DATABASE_URL='postgresql://wow:STRONG@wow-postgres:5432/wow_refund?schema=public' \
  --from-literal=DIRECT_DATABASE_URL='postgresql://wow:STRONG@wow-postgres:5432/wow_refund?schema=public' \
  --from-literal=POSTGRES_PASSWORD='STRONG' \
  --from-literal=AUTH_SECRET="$(openssl rand -base64 32)" \
  --from-literal=CRON_SECRET="$(openssl rand -hex 24)" \
  --from-literal=PII_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --from-literal=POWER_AUTOMATE_SIGNING_SECRET=''

# 4. Bring up the rest:
kubectl apply -k k8s/base
kubectl -n wow-refund wait --for=condition=ready pod -l app.kubernetes.io/component=postgres --timeout=2m
kubectl -n wow-refund wait --for=condition=complete job/wow-migrate --timeout=5m
kubectl -n wow-refund rollout status deploy/wow-web
```

Full K8s reference: <a href="docs/K8S.md"><code>docs/K8S.md</code></a>.

## What's guaranteed in production

| Risk | Mitigation |
|---|---|
| Pod hang / crash | `liveness` probe on `/api/health` restarts the pod |
| Node disk failure | 3 replicas + `topologySpreadConstraints` + PDB `minAvailable=2` |
| Traffic spike | HPA 3–10 replicas, CPU 70% / mem 80% targets |
| Rolling deploys | `maxSurge=1`, `maxUnavailable=1`, 5 s `preStop` drain |
| DB data loss | Nightly `pg_dump` CronJob → 14-day retention on a separate PVC |
| Security exposure | Non-root containers (1001:1001), `drop ALL` caps, secrets in K8s `Secret` |
| Cron failure | `concurrencyPolicy: Forbid`, `backoffLimit`, history retention 3-7 |

## Test & quality

```bash
pnpm typecheck     # 4/4 packages
pnpm test          # 29 files / 257 tests
pnpm lint          # tracked separately, not a deploy blocker
```

## Source of truth

`HANDOVER.md` records every sprint, every commit, what's done, and what's next.  
Read it before starting any new work.
