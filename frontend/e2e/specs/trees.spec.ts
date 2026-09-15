import { expect, test } from '../fixtures';
import { axeCheck } from '../helpers/axe';
import { createTree, deleteTree, login } from '../helpers/api';

const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'Demo123!';

test.describe('trees', () => {
  // A baseline tree keeps the list non-empty (avoiding the hero empty-state) and gives every
  // count assertion below a stable delta to compare against, independent of the seeded demo tree.
  let baselineTreeId: string | undefined;

  test.beforeEach(async ({ request }) => {
    const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    baselineTreeId = await createTree(request, token, `E2E Baseline ${Date.now()}`);
  });

  test.afterEach(async ({ request }) => {
    // A beforeEach failure before baselineTreeId is assigned would otherwise leave this
    // deleting the previous test's already-deleted tree, masking the real failure
    // with a 404 stacked on top of it.
    if (!baselineTreeId) return;
    const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    await deleteTree(request, token, baselineTreeId);
    baselineTreeId = undefined;
  });

  test('create via the header dialog, rename via the kebab menu, then delete with confirm', async ({ demo }) => {
    const page = demo;
    await page.goto('/trees');
    await axeCheck(page, 'trees');

    const initialCount = await page.locator('.qs-tree-card').count();

    // Create
    const treeName = `E2E Tree ${Date.now()}`;
    await page.getByRole('button', { name: /^(Neuer Stammbaum|New tree)$/ }).click();
    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible();
    await createDialog.locator('input[formcontrolname="name"]').fill(treeName);
    await createDialog.getByRole('button', { name: /Stammbaum erstellen|Create Tree/ }).click();

    await expect(page.getByText(/Stammbaum erstellt\.|Tree created\./).first()).toBeVisible();
    await expect(page.locator('.qs-tree-card')).toHaveCount(initialCount + 1);
    let card = page.locator('.qs-tree-card').filter({ hasText: treeName });
    await expect(card).toBeVisible();

    // Rename
    const renamedName = `${treeName} (renamed)`;
    await card.getByRole('button', { name: /Aktionen für Stammbaum|Tree actions/ }).click();
    await page.getByRole('menuitem', { name: /Umbenennen|Rename/ }).click();
    const renameDialog = page.getByRole('dialog');
    const nameInput = renameDialog.locator('input[formcontrolname="name"]');
    await expect(nameInput).toHaveValue(treeName);
    await nameInput.fill(renamedName);
    await renameDialog.getByRole('button', { name: /^(Speichern|Save)$/ }).click();

    await expect(page.getByText(/Stammbaum umbenannt\.|Tree renamed\./).first()).toBeVisible();
    card = page.locator('.qs-tree-card').filter({ hasText: renamedName });
    await expect(card).toBeVisible();
    await expect(page.locator('.qs-tree-card')).toHaveCount(initialCount + 1);

    // Delete with confirm
    await card.getByRole('button', { name: /Aktionen für Stammbaum|Tree actions/ }).click();
    await page.getByRole('menuitem', { name: /Löschen|Delete/ }).click();
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: /Löschen|Delete/ }).click();

    await expect(page.getByText(/Stammbaum gelöscht\.|Tree deleted\./).first()).toBeVisible();
    await expect(page.locator('.qs-tree-card')).toHaveCount(initialCount);
    await expect(page.locator('.qs-tree-card').filter({ hasText: renamedName })).toHaveCount(0);
  });
});
