import { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { axeCheck } from '../helpers/axe';
import { createPerson, createTree, deleteTree, login } from '../helpers/api';

const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'Demo123!';

/** The palette matches action labels against the *current* UI language (no navigator-locale
 *  detection, no server sync outside the settings page), so a language-dependent search term
 *  has to be picked at runtime rather than assumed — mirrors I18nService.initialLang(). */
async function currentLang(page: Page): Promise<'de' | 'en'> {
  const stored = await page.evaluate(() => localStorage.getItem('lang'));
  return stored === 'de' ? 'de' : 'en';
}

/**
 * Opens the palette with Control+K and returns its `.qs-palette` locator, already confirmed
 * visible. Waits for the toolbar's palette trigger first: right after `page.goto`, the shell
 * (and its `ShortcutService.register('mod+k', ...)` call in `App`'s constructor) may not have
 * bootstrapped yet, and a bare `keyboard.press` — unlike a `click`, which waits for its target
 * to be actionable — has nothing to wait on and is simply lost if it lands before then.
 */
async function openPalette(page: Page): Promise<Locator> {
  await expect(page.locator('#qs-palette-trigger')).toBeVisible();
  await page.keyboard.press('Control+k');
  const palette = page.locator('.qs-palette');
  await expect(palette).toBeVisible();
  return palette;
}

test.describe('palette', () => {
  let treeId: string;
  let personId: string;
  const lastName = 'Palettinger';

  test.beforeEach(async ({ request }) => {
    const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    treeId = await createTree(request, token, `E2E Palette ${Date.now()}`);
    personId = await createPerson(request, token, treeId, { firstName: 'Paula', lastName, sex: 'Female' });
  });

  test.afterEach(async ({ request }) => {
    const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    await deleteTree(request, token, treeId);
  });

  test('Control+K on /trees only offers the actions group', async ({ demo }) => {
    const page = demo;
    await page.goto('/trees');
    const palette = await openPalette(page);
    await axeCheck(page, 'palette');

    const groups = palette.locator('.qs-palette__group');
    await expect(groups).toHaveCount(1);
    await expect(groups.first()).toHaveText(/Aktionen|Actions/);

    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
  });

  test('in a tree, typing a surname filters to the people group and Enter opens the person', async ({ demo }) => {
    const page = demo;
    await page.goto(`/trees/${treeId}`);
    // The palette preselects a tree from sessionStorage's `qs.lastTree`, read once when it opens —
    // set by tree-view's own effect, which only runs once the tree has rendered. Opening the
    // palette before that leaves it with no tree context and it never offers a "people" group.
    await expect(page.locator('.qs-people__row')).toHaveCount(1);

    const palette = await openPalette(page);
    await palette.getByRole('combobox').fill(lastName);

    const peopleGroup = palette.locator('.qs-palette__group').filter({ hasText: /Personen in|People in/ });
    await expect(peopleGroup).toBeVisible();
    await expect(palette.locator('.qs-palette__row')).toHaveCount(1);
    // The highlighted (Enter-targeted) row, not just "some row somewhere" — confirms the list has
    // actually settled on the filtered result before Enter fires.
    await expect(palette.locator('.qs-palette__row--active')).toHaveText(new RegExp(lastName));

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/persons/${personId}$`));
  });

  test('typing the trash action and Enter lands on /settings#trash', async ({ demo }) => {
    const page = demo;
    await page.goto('/trees');
    const lang = await currentLang(page);
    const term = lang === 'de' ? 'Papierkorb' : 'Trash';

    const palette = await openPalette(page);
    await palette.getByRole('combobox').fill(term);
    await expect(palette.locator('.qs-palette__row')).toHaveCount(1);
    // The highlighted (Enter-targeted) row, not just "some row somewhere" — confirms the list has
    // actually settled on the filtered result before Enter fires.
    await expect(palette.locator('.qs-palette__row--active')).toHaveText(new RegExp(term));

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/settings#trash$/);
  });

  test('does not open while the relationship dialog is open; Escape closes the dialog', async ({ demo }) => {
    const page = demo;
    await page.goto(`/trees/${treeId}`);
    await page.locator(`.qs-people__row[data-person-id="${personId}"]`).click();

    const panel = page.locator('qs-tree-selection-panel');
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: /Beziehung hinzufügen|Add relationship/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Control+k');
    await expect(page.locator('.qs-palette')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
