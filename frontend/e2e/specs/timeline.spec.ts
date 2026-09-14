import { expect, test } from '../fixtures';
import { axeCheck } from '../helpers/axe';
import { createPerson, createTree, deleteTree, login } from '../helpers/api';

const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'Demo123!';

test.describe('timeline', () => {
  let treeId: string;
  let personId: string;

  test.beforeEach(async ({ request }) => {
    const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    treeId = await createTree(request, token, `E2E Timeline ${Date.now()}`);
    personId = await createPerson(request, token, treeId, { firstName: 'Lena', lastName: 'Zeitler', sex: 'Female' });
  });

  test.afterEach(async ({ request }) => {
    const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    await deleteTree(request, token, treeId);
  });

  test('add an event, edit it, then delete it with undo', async ({ demo }) => {
    const page = demo;
    await page.goto(`/persons/${personId}`);
    await axeCheck(page, 'timeline');

    // Add
    await page.getByRole('button', { name: /Ereignis hinzufügen|Add event/ }).click();
    const addDialog = page.getByRole('dialog');
    await expect(addDialog).toBeVisible();
    await addDialog.locator('input[formcontrolname="title"]').fill('Erste Reise');
    await addDialog.getByRole('button', { name: /^(Speichern|Save)$/ }).click();

    await expect(page.getByText(/Ereignis gespeichert\.|Event saved\./).first()).toBeVisible();
    let item = page.locator('.qs-tl__item').filter({ hasText: 'Erste Reise' });
    await expect(item).toBeVisible();

    // Edit
    await item.getByRole('button', { name: /^(Bearbeiten|Edit)$/ }).click();
    const editDialog = page.getByRole('dialog');
    const titleInput = editDialog.locator('input[formcontrolname="title"]');
    await expect(titleInput).toHaveValue('Erste Reise');
    await titleInput.fill('Erste große Reise');
    await editDialog.getByRole('button', { name: /^(Speichern|Save)$/ }).click();

    await expect(page.getByText(/Ereignis gespeichert\.|Event saved\./).first()).toBeVisible();
    item = page.locator('.qs-tl__item').filter({ hasText: 'Erste große Reise' });
    await expect(item).toBeVisible();

    // Delete -> undo
    await item.getByRole('button', { name: /^(Löschen|Delete)$/ }).click();
    await expect(page.locator('.qs-tl__item').filter({ hasText: 'Erste große Reise' })).toHaveCount(0);

    // Filtered to the delete-undo message specifically: the earlier "Event saved." toast from
    // the edit step can still be fading out when this one opens (both remain in the DOM at once).
    const toast = page.locator('.mat-mdc-snack-bar-container').filter({ hasText: /gelöscht|deleted/i });
    await expect(toast).toBeVisible();
    await toast.getByRole('button', { name: /Rückgängig|Undo/ }).click();
    await expect(page.locator('.qs-tl__item').filter({ hasText: 'Erste große Reise' })).toBeVisible();
  });
});
