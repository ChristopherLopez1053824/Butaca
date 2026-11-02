import { test, expect } from '@playwright/test';

test('Butaca debe mostrar sus servicios conectados', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', {
    name: 'Butaca 🎬'
  })).toBeVisible();

  await expect(page.getByText('Servicios conectados: 6/6'))
    .toBeVisible({ timeout: 30000 });

  await expect(page.getByText('Conectado').first()).toBeVisible();
});
