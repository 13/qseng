import { expect, test } from '../fixtures';
import { axeCheck } from '../helpers/axe';
import { register } from '../helpers/api';

test.describe('admin', () => {
  test('register via API shows as pending, then activate, grant admin, set password, and delete; the "me" row stays protected', async ({ demo, request }) => {
    const page = demo;
    const username = `e2eadmin${Date.now()}`;
    const password = 'Passw0rd!';
    await register(request, username, password);

    await page.goto('/admin/users');
    await axeCheck(page, 'admin-users');

    const row = page.locator('.qs-users-table tr').filter({ hasText: `@${username}` });
    await expect(row).toBeVisible();
    await expect(row.getByText(/^(Inaktiv|Inactive)$/)).toBeVisible();

    // Activate
    await row.getByRole('button', { name: /Benutzeraktionen|User actions/ }).click();
    await page.getByRole('menuitem', { name: /Aktivieren|Activate/ }).click();
    await expect(page.getByText(/Gespeichert\.|Saved\./).first()).toBeVisible();
    await expect(row.getByText(/^(Aktiv|Active)$/)).toBeVisible();

    // Grant admin
    await row.getByRole('button', { name: /Benutzeraktionen|User actions/ }).click();
    await page.getByRole('menuitem', { name: /Zum Admin machen|Make admin/ }).click();
    const adminConfirm = page.getByRole('dialog');
    await expect(adminConfirm).toBeVisible();
    await adminConfirm.getByRole('button', { name: /^(Speichern|Save)$/ }).click();
    await expect(row.getByText('Admin', { exact: true })).toBeVisible();

    // Set password
    await row.getByRole('button', { name: /Benutzeraktionen|User actions/ }).click();
    await page.getByRole('menuitem', { name: /^(Passwort|Password)$/ }).click();
    const pwDialog = page.getByRole('dialog');
    await expect(pwDialog).toBeVisible();
    await pwDialog.locator('input[formcontrolname="password"]').fill('AdminSet0Pass!');
    await pwDialog.getByRole('button', { name: /^(Speichern|Save)$/ }).click();
    await expect(page.getByText(/Passwort geändert\.|Password changed\./).first()).toBeVisible();

    // The "me" row (signed-in demo user) keeps its destructive/self-affecting actions disabled.
    const meRow = page.locator('.qs-users-table tr').filter({ hasText: '@demo' });
    await meRow.getByRole('button', { name: /Benutzeraktionen|User actions/ }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: /Aktivieren|Deaktivieren|Activate|Deactivate/ })).toBeDisabled();
    await expect(menu.getByRole('menuitem', { name: /Zum Admin machen|Admin entfernen|Make admin|Remove admin/ })).toBeDisabled();
    await expect(menu.getByRole('menuitem', { name: /^(Passwort|Password)$/ })).toBeDisabled();
    await expect(menu.getByRole('menuitem', { name: /^(Löschen|Delete)$/ })).toBeDisabled();
    await page.keyboard.press('Escape');

    // Delete the user created for this test (cleanup, and exercises the delete action).
    await row.getByRole('button', { name: /Benutzeraktionen|User actions/ }).click();
    await page.getByRole('menuitem', { name: /^(Löschen|Delete)$/ }).click();
    const deleteConfirm = page.getByRole('dialog');
    await expect(deleteConfirm).toBeVisible();
    await deleteConfirm.getByRole('button', { name: /Löschen|Delete/ }).click();
    await expect(page.getByText(/Benutzer gelöscht\.|User deleted\./).first()).toBeVisible();
    await expect(page.locator('.qs-users-table tr').filter({ hasText: `@${username}` })).toHaveCount(0);
  });
});
