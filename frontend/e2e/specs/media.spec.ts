import path from 'node:path';
import { expect, test } from '../fixtures';
import { axeCheck } from '../helpers/axe';
import { createPerson, createTree, deleteTree, login } from '../helpers/api';

const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'Demo123!';
const AVATAR_PATH = path.resolve(__dirname, '../assets/avatar.png');

test.describe('media', () => {
  let treeId: string | undefined;
  let personId: string;

  test.beforeEach(async ({ request }) => {
    const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    treeId = await createTree(request, token, `E2E Media ${Date.now()}`);
    personId = await createPerson(request, token, treeId, { firstName: 'Otto', lastName: 'Fotograf', sex: 'Male' });
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

  test('upload a photo, set it as the avatar, view it in the lightbox, then delete it with undo', async ({ demo }) => {
    const page = demo;
    await page.goto(`/persons/${personId}`);
    await page.getByRole('tab', { name: /Fotos & Dokumente|Photos & documents/ }).click();
    await axeCheck(page, 'person-media');

    await expect(page.locator('.qs-identity__hero .qs-avatar__initials')).toBeVisible();

    // The first photo a person gets becomes their avatar automatically (backend: "the first
    // photo becomes the avatar; later ones must be chosen explicitly") — the initials give way
    // to it immediately, with no "set as avatar" step.
    await page.locator('input[type="file"]').setInputFiles(AVATAR_PATH);
    await expect(page.locator('figure[data-media-id]')).toHaveCount(1);
    await expect(page.locator('.qs-identity__hero img')).toBeVisible();
    await expect(page.locator('.qs-identity__hero .qs-avatar__initials')).toHaveCount(0);
    const firstItem = page.locator('figure[data-media-id]').nth(0);
    await expect(firstItem.getByText(/Profilfoto|Avatar/)).toBeVisible();

    // A second photo is not the avatar until explicitly set as one.
    await page.locator('input[type="file"]').setInputFiles(AVATAR_PATH);
    await expect(page.locator('figure[data-media-id]')).toHaveCount(2);
    const secondItem = page.locator('figure[data-media-id]').nth(1);
    await expect(secondItem.getByText(/Profilfoto|Avatar/)).toHaveCount(0);

    await secondItem.getByRole('button', { name: /Dateiaktionen|File actions/ }).click();
    await page.getByRole('menuitem', { name: /Als Profilfoto setzen|Set as profile photo/ }).click();

    await expect(page.getByText(/Profilfoto aktualisiert\.|Profile photo updated\./).first()).toBeVisible();
    await expect(secondItem.getByText(/Profilfoto|Avatar/)).toBeVisible();
    await expect(firstItem.getByText(/Profilfoto|Avatar/)).toHaveCount(0);
    await expect(page.locator('.qs-identity__hero img')).toBeVisible();

    // Lightbox opens on click, closes with Escape.
    await firstItem.locator('.qs-media__thumb').click();
    const lightbox = page.getByRole('dialog');
    await expect(lightbox.locator('img')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden();

    // Delete the (now-avatar) second item -> undo.
    await secondItem.getByRole('button', { name: /Dateiaktionen|File actions/ }).click();
    await page.getByRole('menuitem', { name: /^(Löschen|Delete)$/ }).click();
    await expect(page.locator('figure[data-media-id]')).toHaveCount(1);

    const toast = page.locator('.mat-mdc-snack-bar-container').filter({ hasText: /gelöscht|deleted/i });
    await expect(toast).toBeVisible();
    await toast.getByRole('button', { name: /Rückgängig|Undo/ }).click();
    await expect(page.locator('figure[data-media-id]')).toHaveCount(2);
  });
});
