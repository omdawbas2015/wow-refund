import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Integration test runner.
 *
 * Picks up every `*.integration.test.ts` under `src/` and `tests/`. The
 * runner expects external services to be reachable (Postgres for sure;
 * Upstash mock + OTel collector are optional and skip themselves when
 * the corresponding env vars are unset).
 *
 * Wire into CI via `pnpm test:integration`. The default `pnpm test`
 * config (vitest.config.ts) excludes these so unit-test runs stay
 * hermetic.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.integration.test.ts',
      'tests/integration/**/*.test.ts',
    ],
    globals: false,
    clearMocks: true,
    // Integration suites talk to real services so they're slower than unit tests.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
