import fs from 'node:fs';
import path from 'node:path';
import { APIRequestContext, Page, test as base } from '@playwright/test';
import { login, registerAndActivate } from './helpers/api';

export const DEMO_USERNAME = 'demo';
export const DEMO_PASSWORD = 'Demo123!';

const STATE_DIR = path.resolve(__dirname, '.state');
const DEMO_STORAGE_STATE = path.join(STATE_DIR, 'demo.json');

interface FreshUser {
  username: string;
  password: string;
  page: Page;
}

interface Fixtures {
  /** A page already signed in as the seeded demo user, landing on /trees. */
  demo: Page;
  /** A brand-new user, registered + admin-activated via the API, then signed in through the UI. */
  freshUser: FreshUser;
  /** An API request context authenticated as the demo user. */
  api: APIRequestContext;
  /** The id of the seeded demo tree, fetched through `api`. */
  treeId: string;
}

async function fillLoginForm(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('input[formcontrolname="username"]').fill(username);
  await page.locator('input[formcontrolname="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/trees');
}

export const test = base.extend<Fixtures>({
  demo: async ({ browser }, use) => {
    fs.mkdirSync(STATE_DIR, { recursive: true });

    const hasCachedState = fs.existsSync(DEMO_STORAGE_STATE);
    const context = await browser.newContext(hasCachedState ? { storageState: DEMO_STORAGE_STATE } : {});
    const page = await context.newPage();

    if (hasCachedState) {
      // Sanity-check the cached session is still valid; a stale/expired token bounces to /login.
      await page.goto('/trees');
      if (page.url().includes('/login')) {
        await fillLoginForm(page, DEMO_USERNAME, DEMO_PASSWORD);
        await context.storageState({ path: DEMO_STORAGE_STATE });
      }
    } else {
      await fillLoginForm(page, DEMO_USERNAME, DEMO_PASSWORD);
      await context.storageState({ path: DEMO_STORAGE_STATE });
    }

    await use(page);
    await context.close();
  },

  freshUser: async ({ browser, request }, use, testInfo) => {
    const unique = `${Date.now()}${testInfo.workerIndex}`;
    const username = `e2e${unique}`;
    const password = 'Passw0rd!';

    const adminToken = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    await registerAndActivate(request, adminToken, username, password);

    const context = await browser.newContext();
    const page = await context.newPage();
    await fillLoginForm(page, username, password);

    await use({ username, password, page });
    await context.close();
  },

  api: async ({ playwright, baseURL, request }, use) => {
    const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    const context = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    await use(context);
    await context.dispose();
  },

  treeId: async ({ api }, use) => {
    const res = await api.get('/api/v1/trees');
    const trees = (await res.json()) as { id: string; name: string }[];
    if (trees.length === 0) throw new Error('Expected the seeded demo tree but /api/v1/trees returned none.');
    await use(trees[0].id);
  }
});

export { expect } from '@playwright/test';
