import { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { axeCheck } from '../helpers/axe';
import { createTree, deleteTree, login } from '../helpers/api';

const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'Demo123!';

/**
 * Right-clicks the centre of the tree canvas to open a node's context menu. The graph is a
 * cytoscape canvas (no per-node DOM elements), so a node must first be selected via
 * `store.select()`, which animates it to the canvas centre (~250ms) before this can land on it.
 * Retries once — the animation or a slow first paint can occasionally miss the first attempt.
 */
async function rightClickSelectedNode(page: Page): Promise<void> {
  const canvas = page.locator('[data-testid="tree-canvas"]');
  const menu = page.getByRole('menu');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('tree canvas has no bounding box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.waitForTimeout(600);
  await page.mouse.click(cx, cy, { button: 'right' });
  try {
    await expect(menu).toBeVisible({ timeout: 2000 });
  } catch {
    await page.waitForTimeout(600);
    await page.mouse.click(cx, cy, { button: 'right' });
    await expect(menu).toBeVisible();
  }
}

test.describe('person', () => {
  let treeId: string;

  test.beforeEach(async ({ request }) => {
    const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    treeId = await createTree(request, token, `E2E Person ${Date.now()}`);
  });

  test.afterEach(async ({ request }) => {
    const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    await deleteTree(request, token, treeId);
  });

  test('add via the header, edit with Ctrl+S, then delete from the context menu (undo, then let a second delete expire)', async ({ demo }) => {
    const page = demo;
    await page.goto(`/trees/${treeId}`);

    // Add person via the header
    await page.getByRole('link', { name: /Person hinzufügen|Add person/ }).click();
    await expect(page).toHaveURL(new RegExp(`/trees/${treeId}/persons/new$`));
    await page.locator('input[formcontrolname="firstName"]').fill('Erika');
    await page.locator('input[formcontrolname="lastName"]').fill('Musterfrau');
    await page.getByRole('radio', { name: /Weiblich|Female/ }).click();
    await page.getByRole('button', { name: /Person anlegen|Add person/ }).click();

    await expect(page).toHaveURL(/\/persons\/[^/]+$/);
    await expect(page.getByText(/Person gespeichert\.|Person saved\./).first()).toBeVisible();
    await axeCheck(page, 'person-detail');

    // Edit + Ctrl+S
    await page.getByRole('link', { name: /^(Person bearbeiten|Edit person)$/ }).click();
    await expect(page).toHaveURL(/\/persons\/[^/]+\/edit$/);
    await axeCheck(page, 'person-edit');
    await page.locator('textarea[formcontrolname="notes"]').fill('Added via e2e.');
    await page.keyboard.press('Control+s');

    await expect(page).toHaveURL(/\/persons\/[^/]+$/);
    await expect(page.getByText(/Person gespeichert\.|Person saved\./).first()).toBeVisible();
    await expect(page.getByText('Added via e2e.')).toBeVisible();

    // Back to the tree, select the person and delete via the context menu
    await page.goto(`/trees/${treeId}`);
    await expect(page.locator('.qs-people__row')).toHaveCount(1);
    await axeCheck(page, 'tree-view');

    await page.locator('.qs-people__row').first().click();
    await expect(page.locator('.qs-people__row[aria-current="true"]')).toHaveCount(1);

    await rightClickSelectedNode(page);
    await page.getByRole('menuitem', { name: /Person löschen|Delete person/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Löschen|Delete/ }).click();

    // Filtered on the interpolated name so a still-fading earlier toast (e.g. the "Person
    // saved." one from the edit step) is never mistaken for this delete's undo toast.
    const toast = page.locator('.mat-mdc-snack-bar-container').filter({ hasText: 'Musterfrau' });
    await expect(toast).toBeVisible();
    await expect(page.locator('.qs-people__row')).toHaveCount(0);
    await toast.getByRole('button', { name: /Rückgängig|Undo/ }).click();
    await expect(page.locator('.qs-people__row')).toHaveCount(1);

    // Second delete: let the undo toast expire instead of clicking it.
    await rightClickSelectedNode(page);
    await page.getByRole('menuitem', { name: /Person löschen|Delete person/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Löschen|Delete/ }).click();

    await expect(toast).toBeVisible();
    await expect(page.locator('.qs-people__row')).toHaveCount(0);
    await expect(toast).toBeHidden({ timeout: 8000 });
    await expect(page.locator('.qs-people__row')).toHaveCount(0);
  });
});
