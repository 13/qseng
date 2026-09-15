import { expect, test } from '../fixtures';
import { axeCheck } from '../helpers/axe';
import { login } from '../helpers/api';

const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'Demo123!';

test.describe('auth', () => {
  test('login page renders and passes axe', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('input[formcontrolname="username"]')).toBeVisible();
    await expect(page.locator('input[formcontrolname="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    await axeCheck(page, 'login');
  });

  test('wrong password shows the error and stays on /login', async ({ page }) => {
    await page.goto('/login');

    await page.locator('input[formcontrolname="username"]').fill(DEMO_USERNAME);
    await page.locator('input[formcontrolname="password"]').fill('not-the-password');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('demo login (via the demo-fill button) lands on /trees', async ({ page }) => {
    await page.goto('/login');

    await page.locator('.qs-auth-demo').click();
    await expect(page.locator('input[formcontrolname="username"]')).toHaveValue(DEMO_USERNAME);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/trees/);
  });

  test('register shows a pending-activation notice; admin activation unblocks login', async ({ page, request }) => {
    const username = `e2ereg${Date.now()}`;
    const password = 'Passw0rd!';

    await page.goto('/register');
    await page.locator('input[formcontrolname="username"]').fill(username);
    await page.locator('input[formcontrolname="displayName"]').fill('E2E Registrant');
    await page.locator('input[formcontrolname="password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    // Pending-activation notice (register.pendingTitle / register.pendingHint).
    const pendingNotice = page.getByRole('status');
    await expect(pendingNotice).toBeVisible();

    // Login is refused until an admin activates the account.
    await pendingNotice.getByRole('link', { name: /sign in|anmelden/i }).click();
    await page.locator('input[formcontrolname="username"]').fill(username);
    await page.locator('input[formcontrolname="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    // Admin activates the account via the API.
    const adminToken = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    const users = await (await request.get('/api/v1/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` }
    })).json() as { id: string; username: string }[];
    const created = users.find(u => u.username === username.toLowerCase());
    expect(created).toBeTruthy();
    await request.patch(`/api/v1/admin/users/${created!.id}/active`, {
      data: { active: true },
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    // Login now succeeds.
    await page.locator('input[formcontrolname="username"]').fill(username);
    await page.locator('input[formcontrolname="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/trees/);
  });

  test('logout from the user menu returns to /login, and /trees then redirects there', async ({ demo }) => {
    const page = demo;
    await expect(page).toHaveURL(/\/trees/);

    await page.locator('button.qs-user').click();
    await page.getByRole('menuitem', { name: /sign out|abmelden/i }).click();

    await expect(page).toHaveURL(/\/login/);

    await page.goto('/trees');
    await expect(page).toHaveURL(/\/login/);
  });
});
