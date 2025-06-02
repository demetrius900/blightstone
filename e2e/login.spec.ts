import { test, expect } from '@playwright/test';
test('login page loads', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
});
