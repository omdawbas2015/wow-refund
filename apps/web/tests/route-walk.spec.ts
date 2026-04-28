import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * Full route-walk regression. Logs in once as ADMIN, then visits every
 * top-level page under `[locale]/(dashboard)`. Each visit asserts:
 *
 *   1. The response status is < 400.
 *   2. No unexpected `console.error` fires during the load.
 *   3. A `<h1>` lands in the DOM (proxy for "the page rendered").
 *
 * The goal is a cheap regression net: if a server action crashes during
 * RSC render, or a missing translation throws, this test catches it
 * without needing per-feature assertions.
 *
 * Tagged `@route-walk` so CI can skip it on every PR and schedule it
 * nightly (the full walk takes ~1 minute against a seeded DB).
 */

const ROUTES = [
  '/',
  '/cases',
  '/cases/new',
  '/promo',
  '/promo/allocate',
  '/promo/pools',
  '/customers',
  '/reports',
  '/operations/bulk-cases',
  '/operations/aura/new',
  '/operations/knet/new',
  '/operations/approvals/new',
  '/help-desk',
  '/notifications',
  '/profile',
  '/search',
  '/changelog',
  '/admin',
  '/admin/audit-log',
  '/admin/automation-rules',
  '/admin/backup',
  '/admin/batch-schedules',
  '/admin/branches',
  '/admin/brands',
  '/admin/countries',
  '/admin/cron-status',
  '/admin/currencies',
  '/admin/design-tokens',
  '/admin/email-log',
  '/admin/email-templates',
  '/admin/fraud-signals',
  '/admin/modules',
  '/admin/payment-methods',
  '/admin/pending-approvals',
  '/admin/root-causes',
  '/admin/scheduled-reports',
  '/admin/settings',
  '/admin/sla-rules',
  '/admin/store-templates',
  '/admin/system-info',
  '/admin/users',
];

// Noise filters: these show up on some pages for reasons outside the
// scope of this walk (third-party scripts, expected 404s for optional
// icons). Extend sparingly — each entry is one more thing we won't catch.
const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
  /favicon/i,
  /net::ERR_ABORTED/i,
  /Download the React DevTools/i,
];

function collectConsoleErrors(page: Page): () => string[] {
  const errors: string[] = [];
  const handler = (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE_PATTERNS.some((rx) => rx.test(text))) return;
    errors.push(text);
  };
  page.on('console', handler);
  return () => {
    page.off('console', handler);
    return errors;
  };
}

test.describe('@route-walk full dashboard regression', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@wow.local');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(en|ar)?\/?$/);
  });

  for (const path of ROUTES) {
    test(`GET ${path}`, async ({ page }) => {
      const drain = collectConsoleErrors(page);
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response, `no response for ${path}`).not.toBeNull();
      expect(response!.status(), `${path} returned ${response!.status()}`).toBeLessThan(400);

      // The dashboard layout always renders at least one h1 for the
      // current page. If this ever turns into "not every page has an
      // h1", turn the assertion into a body-visible check instead.
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });

      const errors = drain();
      expect(errors, `console.error on ${path}:\n${errors.join('\n')}`).toEqual([]);
    });
  }
});
