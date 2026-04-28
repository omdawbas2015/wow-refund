# CI

The only workflow today is [`.github/workflows/docker-build.yml`](../.github/workflows/docker-build.yml):

1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @wow/db generate`
3. `pnpm typecheck`
4. `pnpm test`
5. Build + push the Docker image to GHCR.

## Recommended follow-ups (owner must apply — GitHub OAuth scope blocks `.github/workflows` edits)

### 1. Cancel stale runs

Add a concurrency block so a new push to a branch cancels the previous run. Tags and `main` should never cancel:

```yaml
concurrency:
  group: docker-build-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' && !startsWith(github.ref, 'refs/tags/') }}
```

Place it at the top level, alongside `on:` / `permissions:`.

### 2. Run Playwright smoke in CI

The repo has three Playwright specs today (`tests/auth.spec.ts`, `tests/case-list.spec.ts`, `tests/a11y.spec.ts`) plus the new `tests/route-walk.spec.ts`. They do not run in CI yet. A follow-up job should:

1. Boot Postgres + run migrations + seed `SEED_DEMO_CASES=1`.
2. Start `pnpm --filter @wow/web dev` (or `start` after build) in the background.
3. Run `pnpm --filter @wow/web test:e2e -- --grep-invert @route-walk` on every PR.
4. Run `pnpm --filter @wow/web test:e2e -- --grep @route-walk` on a nightly schedule only — the walk is slow and noisy for PR feedback.

### 3. Lint gate

`pnpm --filter @wow/web lint` (next-lint) is defined but not run in CI. Add it between `typecheck` and `test` once the existing code passes a clean run — it currently has a small number of warnings we haven't triaged.
