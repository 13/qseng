import { expect, test } from '../fixtures';
import { axeCheck } from '../helpers/axe';
import { createPerson, createTree, deleteTree, login } from '../helpers/api';

const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'Demo123!';

test.describe('relationships', () => {
  let treeId: string | undefined;
  let anchorId: string;

  test.beforeEach(async ({ request }) => {
    const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    treeId = await createTree(request, token, `E2E Relationships ${Date.now()}`);
    anchorId = await createPerson(request, token, treeId, { firstName: 'Anna', lastName: 'Testperson', sex: 'Female' });
    // Bert isn't referenced by id — the "existing person" test finds him by name in the autocomplete.
    await createPerson(request, token, treeId, { firstName: 'Bert', lastName: 'Beispiel', sex: 'Male' });
  });

  test.afterEach(async ({ request }) => {
    // A beforeEach failure before treeId is assigned would otherwise leave this
    // deleting the previous test's already-deleted tree, masking the real failure
    // with a 404 stacked on top of it.
    if (!treeId) return;
    const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    await deleteTree(request, token, treeId);
    treeId = undefined;
  });

  test('existing-person mode from the family section, then chip remove with undo', async ({ demo }) => {
    const page = demo;
    await page.goto(`/persons/${anchorId}`);
    await axeCheck(page, 'person-family');

    await page.getByRole('button', { name: /^(Hinzufügen|Add)$/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Type defaults to "Parent" — switch to "Child".
    await dialog.getByRole('combobox', { name: /Beziehung|Relationship/ }).click();
    await page.getByRole('option', { name: /^(Kind|Child)$/ }).click();

    // "Existing person" is the default mode; pick Bert from the autocomplete.
    await dialog.locator('input[formcontrolname="person"]').fill('Bert');
    await page.getByRole('option', { name: /Bert Beispiel/ }).click();
    await dialog.getByRole('button', { name: /^(Hinzufügen|Add)$/ }).click();

    await expect(page.getByText(/Beziehung hinzugefügt\.|Relationship added\./).first()).toBeVisible();
    const chip = page.locator('qs-person-family mat-chip').filter({ hasText: 'Bert Beispiel' });
    await expect(chip).toBeVisible();

    // Remove the relationship, then undo it.
    await chip.locator('[matChipRemove]').click();
    await expect(page.getByText(/Beziehung entfernt\.|Relationship removed\./).first()).toBeVisible();
    await expect(page.locator('qs-person-family mat-chip').filter({ hasText: 'Bert Beispiel' })).toHaveCount(0);

    const toast = page.locator('.mat-mdc-snack-bar-container').filter({ hasText: /entfernt|removed/i });
    await toast.getByRole('button', { name: /Rückgängig|Undo/ }).click();
    await expect(page.locator('qs-person-family mat-chip').filter({ hasText: 'Bert Beispiel' })).toBeVisible();
  });

  test('inline "new person" from the tree-view selection panel names the relation in the toast', async ({ demo }) => {
    const page = demo;
    await page.goto(`/trees/${treeId}`);
    await page.locator(`.qs-people__row[data-person-id="${anchorId}"]`).click();

    const panel = page.locator('qs-tree-selection-panel');
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: /Beziehung hinzufügen|Add relationship/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('radio', { name: /Neue Person|New person/ }).click();

    await dialog.locator('input[formcontrolname="firstName"]').fill('Clara');
    // lastName is pre-filled from the anchor (relation type defaults to "Parent").
    await dialog.getByRole('radio', { name: /Weiblich|Female/ }).click();
    await dialog.getByRole('button', { name: /^(Hinzufügen|Add)$/ }).click();

    await expect(page.getByText(/Clara Testperson als Elternteil hinzugefügt\.|Clara Testperson added as parent\./).first()).toBeVisible();
  });
});
