import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility smoke. Runs axe-core against the public login page and
 * a curated set of post-login surfaces, asserting no WCAG 2.0 / 2.1 A
 * or AA violations on each.
 *
 * The covered set is a representative sample of the UI patterns the
 * app relies on:
 *   - Login form (only public surface).
 *   - Dashboard home (KPI cards + charts).
 *   - Cases list (data table + filters).
 *   - Admin users (CRUD-style list).
 *   - Admin email log (read-only log table).
 *   - Admin settings (form-heavy page).
 *
 * Full per-page coverage belongs in a dedicated a11y job, but a hard
 * floor on these six catches regressions like missing labels and
 * contrast drift on the most-trafficked routes fast.
 */

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('admin@wow.local');
  await page.getByLabel(/password/i).fill('admin123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(en|ar)?\/?$/);
}

async function expectClean(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

test.describe('a11y smoke', () => {
  test('/login is WCAG 2.1 AA clean', async ({ page }) => {
    await page.goto('/login');
    await expectClean(page);
  });

  test('dashboard (post-login) is WCAG 2.1 AA clean', async ({ page }) => {
    await login(page);
    await expectClean(page);
  });

  test('/cases list is WCAG 2.1 AA clean', async ({ page }) => {
    await login(page);
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    await expectClean(page);
  });

  test('/admin/users list is WCAG 2.1 AA clean', async ({ page }) => {
    await login(page);
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await expectClean(page);
  });

  test('/admin/email-log list is WCAG 2.1 AA clean', async ({ page }) => {
    await login(page);
    await page.goto('/admin/email-log');
    await page.waitForLoadState('networkidle');
    await expectClean(page);
  });

  test('/admin/settings is WCAG 2.1 AA clean', async ({ page }) => {
    await login(page);
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');
    await expectClean(page);
  });
});
