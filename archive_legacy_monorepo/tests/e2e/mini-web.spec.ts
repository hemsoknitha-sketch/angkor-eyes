/**
 * E2E — Mini Web journeys (Playwright).
 *
 * Covers the owner journeys in the Mini Web dashboard:
 *   1. Open dashboard → see tasks list.
 *   2. Open an approval → see the diff → approve → task moves on.
 *   3. Check the cost tab.
 *   4. Search memory.
 *
 * These specs assume the stack is running locally
 * (`docker compose up -d`, frontend on http://localhost:8080,
 * backend on http://localhost:3000) with seed data. They use a
 * test-only owner session: set PLAYWRIGHT_TEST_SESSION (a session
 * token for the test owner) in the environment. If the stack is not
 * running, the specs fail with a clear message — they do not silently
 * pass. See tests/README.md.
 *
 * NOTE: Telegram Mini App auth (initData) cannot be fully simulated
 * here; the frontend's dev-mode session bypass (if the frontend
 * builder ships one) is what PLAYWRIGHT_TEST_SESSION exercises.
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.MINI_WEB_URL ?? 'http://localhost:8080';
const SESSION = process.env.PLAYWRIGHT_TEST_SESSION ?? '';

test.beforeEach(async ({ page }) => {
  test.skip(!SESSION, 'PLAYWRIGHT_TEST_SESSION is not set — start the stack with a test session (see tests/README.md)');
  await page.addInitScript((token) => {
    localStorage.setItem('angkor-test-session', token);
  }, SESSION);
});

test('dashboard lists tasks', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.getByRole('heading', { name: /tasks/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('task-list')).toBeVisible();
});

test('approval journey: view diff, approve, status updates', async ({ page }) => {
  await page.goto(`${BASE}/approvals`);
  await expect(page.getByTestId('approval-queue')).toBeVisible({ timeout: 15_000 });
  const first = page.getByTestId('approval-item').first();
  await expect(first).toBeVisible();
  await first.click();
  // Diff preview must be shown before the approve button is meaningful.
  await expect(page.getByTestId('approval-diff')).toBeVisible();
  await page.getByRole('button', { name: /approve/i }).click();
  await expect(page.getByText(/approved/i)).toBeVisible({ timeout: 10_000 });
});

test('cost tab shows a daily total', async ({ page }) => {
  await page.goto(`${BASE}/costs`);
  await expect(page.getByTestId('cost-summary')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/\$|USD/i)).toBeVisible();
});

test('memory search returns a result', async ({ page }) => {
  await page.goto(`${BASE}/memory`);
  await page.getByPlaceholder(/search memory/i).fill('Khmer');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('memory-results')).toBeVisible({ timeout: 15_000 });
});
