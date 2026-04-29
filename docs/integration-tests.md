# Integration tests

The fast unit suite (`pnpm test`) mocks out external services. The integration
suite (`pnpm --filter @wow/web test:integration`) exercises real ones and is
intended to run against a Postgres service container in CI.

## Files

- `apps/web/vitest.integration.config.ts` — picks up
  `apps/web/tests/integration/**/*.integration.test.ts`
  (and `apps/web/src/**/*.integration.test.ts` for colocated specs).
- `apps/web/tests/integration/db.integration.test.ts` — Postgres smoke
  (connection, seeded country registry, schema drift detection on the
  `customerEmailHash` column).
- `apps/web/tests/integration/upstash.integration.test.ts` — opt-in via
  `INTEGRATION_UPSTASH=1`. Stubs `globalThis.fetch` to validate the
  Upstash bridge dedupe gate and auto-reconnect loop end-to-end. Off in
  CI for now until the publish-side stub is fleshed out — the unit suite
  on `events/bus.ts` already covers both branches at the function level.

Each spec self-skips when its required env vars are absent, so
`pnpm test:integration` is safe to run locally against a SQLite dev DB.

## Suggested GitHub Actions workflow

This repo's bot identity does not carry the GitHub `workflow` OAuth scope, so
this YAML is documented here for the maintainer to commit manually as
`.github/workflows/integration.yml`:

```yaml
name: integration

on:
  push:
    branches: ['**']
  workflow_dispatch:

jobs:
  integration:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: wow
          POSTGRES_PASSWORD: wow
          POSTGRES_DB: wow_integration
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U wow -d wow_integration"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    env:
      DATABASE_URL: postgresql://wow:wow@localhost:5432/wow_integration?schema=public
      DIRECT_DATABASE_URL: postgresql://wow:wow@localhost:5432/wow_integration?schema=public
      PII_ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
      PII_HASH_KEY: deadbeefcafef00d
      INTEGRATION_UPSTASH: '0'

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.14.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @wow/db generate:pg
      - run: pnpm --filter @wow/db migrate:deploy:pg
      - run: pnpm --filter @wow/db seed
      - run: pnpm --filter @wow/web test:integration
```

Once committed, the integration job runs alongside `docker-build` on every
push and gates merges to `main` if you mark it required in branch protection.
