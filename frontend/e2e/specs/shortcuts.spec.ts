import { expect, test } from '../fixtures';
import { axeCheck } from '../helpers/axe';

test.describe('shortcuts', () => {
  test('? opens the shortcut sheet (with the platform kbd label) and Escape closes it', async ({ demo }) => {
    const page = demo;
    await page.goto('/trees');

    // Right after goto, the shell's ShortcutService.register('?', ...) may not have run yet;
    // unlike a click (which waits for its target), a bare keyboard.press has nothing to wait
    // on and is simply lost if it lands before the shell finishes bootstrapping.
    await expect(page.locator('#qs-palette-trigger')).toBeVisible();
    await page.keyboard.press('?');
    const sheet = page.locator('mat-bottom-sheet-container');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('h2')).toHaveText(/Tastenkürzel|Keyboard shortcuts/);
    await expect(sheet.locator('kbd').filter({ hasText: 'Ctrl' }).first()).toBeVisible();
    await axeCheck(page, 'shortcut-sheet');

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('the user menu opens the same sheet', async ({ demo }) => {
    const page = demo;
    await page.goto('/trees');

    await page.locator('.qs-user').click();
    await page.getByRole('menuitem', { name: /Tastenkürzel|Keyboard shortcuts/ }).click();

    const sheet = page.locator('mat-bottom-sheet-container');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('h2')).toHaveText(/Tastenkürzel|Keyboard shortcuts/);
  });
});
