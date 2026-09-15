import { expect, test } from '../fixtures';
import { axeCheck } from '../helpers/axe';
import { createPerson, createTree, deletePerson, deleteTree, login } from '../helpers/api';

const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'Demo123!';

test.describe('settings', () => {
  test('about card shows the web and API versions', async ({ demo }) => {
    const page = demo;
    await page.goto('/settings');
    const card = page.locator('qs-about-card');
    await expect(card).toBeVisible();
    // ng serve serves public/version.json's dev defaults; the API reports its csproj version.
    await expect(card.locator('.qs-about__value').nth(0)).toHaveText(/^0\.0\.0-dev \(unknown\)$/);
    await expect(card.locator('.qs-about__value').nth(1)).toHaveText(/^\d+\.\d+\.\d+\S* \(\S+\)$/);
    await expect(card.getByRole('link', { name: /Release notes|Versionshinweise/ })).toHaveAttribute('href', 'https://github.com/13/qseng/releases');
  });

  test.describe('language and theme', () => {
    test('language toggle changes the heading and persists after reload', async ({ freshUser }) => {
      // Uses freshUser rather than the shared demo account: the language toggle persists
      // server-side, and mutating demo's language here — even restored in an afterEach — races
      // any other spec file's demo session once tests run under `--shard`, which executes
      // different files concurrently against the same API. A throwaway account has no such
      // neighbours to race. Both toggle labels are fixed, untranslated strings
      // ('Deutsch'/'English'), so they're clickable regardless of the fresh account's default
      // starting language.
      const page = freshUser.page;
      // The page first paints in the browser's default language, then the profile response
      // switches to the account's stored one (User.Language defaults to "de" in the backend).
      // Clicking a radio that is already selected fires no change and no "saved" toast, so wait
      // for the profile, read the language it carries, and if it is German flip to English
      // first: every click below then really changes the setting.
      const profileLoaded = page.waitForResponse(r => r.url().includes('/api/v1/user/profile') && r.ok());
      await page.goto('/settings');
      const profile = (await (await profileLoaded).json()) as { language?: string };
      if (profile.language === 'de') {
        await expect(page.getByRole('radio', { name: 'Deutsch' })).toBeChecked();
        await page.getByRole('radio', { name: 'English' }).click();
        await expect(page.getByText('Language saved.').first()).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
      } else {
        await expect(page.getByRole('radio', { name: 'English' })).toBeChecked();
      }

      await page.getByRole('radio', { name: 'Deutsch' }).click();
      await expect(page.getByText('Sprache gespeichert.').first()).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
      await axeCheck(page, 'settings');

      await page.getByRole('radio', { name: 'English' }).click();
      await expect(page.getByText('Language saved.').first()).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

      await page.getByRole('radio', { name: 'Deutsch' }).click();
      await expect(page.getByText('Sprache gespeichert.').first()).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
    });

    test('theme toggle sets color-scheme on <html>', async ({ demo }) => {
      const page = demo;
      await page.goto('/settings');

      await page.getByRole('radio', { name: /Dunkel|Dark/ }).click();
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark');

      await page.getByRole('radio', { name: /Hell|Light/ }).click();
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light');

      await page.getByRole('radio', { name: /^System$/ }).click();
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light dark');
    });
  });

  test('change password with freshUser, then sign in with the new password through the UI', async ({ freshUser }) => {
    const page = freshUser.page;
    const newPassword = 'NewPassw0rd!';

    await page.goto('/settings');
    await page.locator('input[formcontrolname="current"]').fill(freshUser.password);
    await page.locator('input[formcontrolname="next"]').fill(newPassword);
    await page.getByRole('button', { name: /Passwort speichern|Save password/ }).click();

    await expect(page.getByText(/Passwort geändert\.|Password changed\./).first()).toBeVisible();

    // Sign out and back in through the UI with the new password.
    await page.locator('.qs-user').click();
    await page.getByRole('menuitem', { name: /Abmelden|Sign out/ }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.locator('input[formcontrolname="username"]').fill(freshUser.username);
    await page.locator('input[formcontrolname="password"]').fill(newPassword);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/trees/);
  });

  test.describe('trash card', () => {
    let treeId: string | undefined;

    test.beforeEach(async ({ request }) => {
      const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
      treeId = await createTree(request, token, `E2E Settings Trash ${Date.now()}`);
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

    test('delete via API, restore it, then delete again and confirm "delete now"', async ({ demo, api, request }) => {
      const page = demo;
      const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
      const lastName = `Trashling${Date.now()}`;
      const fullName = `Trudy ${lastName}`;
      // beforeEach always assigns treeId before a test runs; the non-null assertion mirrors
      // that same invariant the afterEach guard above relies on.
      const personId = await createPerson(request, token, treeId!, { firstName: 'Trudy', lastName, sex: 'Female' });
      await deletePerson(request, token, personId);

      await page.goto('/settings#trash');
      const row = page.locator('.qs-trash-table tr').filter({ hasText: fullName });
      await expect(row).toBeVisible();

      await row.getByRole('button', { name: new RegExp(`(Wiederherstellen|Restore): ${fullName}`) }).click();
      await expect(page.getByText(new RegExp(`${fullName} (wiederhergestellt|restored)\\.`)).first()).toBeVisible();
      await expect(page.locator('.qs-trash-table tr').filter({ hasText: fullName })).toHaveCount(0);

      const livePersons = (await (await api.get(`/api/v1/trees/${treeId}/persons`)).json()) as { id: string }[];
      expect(livePersons.some(p => p.id === personId)).toBe(true);

      await deletePerson(request, token, personId);
      // A plain goto() back to the exact same URL (same path, same fragment) is a same-document
      // no-op in Chromium — TrashCardComponent is never recreated, so it never refetches and
      // still shows the post-restore (now stale) empty state. A real reload forces that refetch.
      await page.reload();
      const row2 = page.locator('.qs-trash-table tr').filter({ hasText: fullName });
      await expect(row2).toBeVisible();

      await row2.getByRole('button', { name: new RegExp(`(Jetzt löschen|Delete now): ${fullName}`) }).click();
      const confirmDialog = page.getByRole('dialog');
      await expect(confirmDialog).toBeVisible();
      await confirmDialog.getByRole('button', { name: /Löschen|Delete/ }).click();

      await expect(page.locator('.qs-trash-table tr').filter({ hasText: fullName })).toHaveCount(0);

      const trashItems = (await (await api.get('/api/v1/trash')).json()).items as { id: string }[];
      expect(trashItems.some(i => i.id === personId)).toBe(false);
    });
  });
});
