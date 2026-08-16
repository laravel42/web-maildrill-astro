import { expect, test } from '@playwright/test';

test.describe('lists', () => {
  test('index renders live lists with the custom fields modal', async ({ page }) => {
    await page.goto('/dashboard/lists');
    await expect(page.getByRole('heading', { level: 1, name: 'Lists' })).toBeVisible();
    await expect(page.getByText(/1–\d+ of \d+ lists?/)).toBeVisible();

    // Workspace-wide custom fields live in a modal off the index header.
    await page.getByRole('button', { name: 'Custom fields' }).click();
    const dialog = page.getByRole('dialog', { name: 'Custom fields' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Shared across all lists')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('create → detail → settings toggle → delete round-trip', async ({ page }) => {
    const name = `e2e list ${Date.now()}`;
    await page.goto('/dashboard/lists');

    // Create via the editor modal.
    // `exact`: the cards grid also renders a "Create new list" tile, whose
    // accessible name contains this one as a substring.
    await page.getByRole('button', { name: 'New list', exact: true }).click();
    await page
      .getByLabel(/list name/i)
      .or(page.getByPlaceholder(/Autumn newsletter/))
      .fill(name);
    await page.getByRole('button', { name: 'Create list' }).click();
    await expect(page.getByText(`List “${name}” created`)).toBeVisible();

    // Resolve the new id through the same-origin BFF and open the detail page.
    // The board is keyset-paginated now, so this asks for the one list by name
    // rather than scanning a page that may not contain it.
    const res = await page.request.get(`/api/v1/lists?q=${encodeURIComponent(name)}`);
    expect(res.ok()).toBe(true);
    const lists = ((await res.json()) as { items: Array<{ id: string; name: string }> }).items;
    const created = lists.find((l) => l.name === name);
    expect(created, 'created list is returned by the API').toBeTruthy();

    await page.goto(`/dashboard/lists/${created!.id}`);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

    // The Settings card persists the double-opt-in column through PATCH.
    const optIn = page.getByRole('switch', { name: 'Double opt-in' });
    await expect(optIn).toHaveAttribute('aria-checked', 'false');
    const patched = page.waitForResponse(
      (r) => r.url().includes('/api/v1/lists/') && r.request().method() === 'PATCH',
    );
    await optIn.click();
    await expect(optIn).toHaveAttribute('aria-checked', 'true');
    expect((await patched).ok()).toBe(true);
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Double opt-in' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // Delete lives in the header overflow menu (ConfirmDialog guards it).
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menu').getByText('Delete list').click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: /^Delete/ }).click();
    await page.waitForURL(/\/dashboard\/lists\/?($|\?)/, { timeout: 10_000 });
    await page.goto('/dashboard/lists');
    await expect(page.getByText(name, { exact: true })).not.toBeVisible();
  });
});
