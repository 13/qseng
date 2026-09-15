import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '../fixtures';
import { axeCheck } from '../helpers/axe';
import { createTree, deleteTree, login } from '../helpers/api';

const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'Demo123!';
const SAMPLE_PATH = path.resolve(__dirname, '../assets/sample-import.txt');

test.describe('import', () => {
  let treeId: string | undefined;

  test.beforeEach(async ({ request }) => {
    const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    treeId = await createTree(request, token, `E2E Import ${Date.now()}`);
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

  test('paste the format-guide example, preview counts, commit, and see the people in the tree', async ({ demo, api }) => {
    const page = demo;
    const text = fs.readFileSync(SAMPLE_PATH, 'utf8');

    await page.goto(`/trees/${treeId}/import`);
    await axeCheck(page, 'import');

    await page.locator('textarea.qs-import__textarea').fill(text);
    await page.getByRole('button', { name: /^(Vorschau|Preview)$/ }).click();

    // Same fixture as the "marriage line" test below: 2 persons, 1 relationship. Asserting the
    // preview stats here too (not just after commit) makes this test self-contained — it no
    // longer relies on the other test to be the one that actually checks the preview numbers.
    await expect(page.locator('.qs-import__stats')).toHaveText(/^2\s+(persons|Personen)\s+·\s+1\s+(relationships|Beziehungen)$/);

    await page.getByRole('button', { name: /Import übernehmen|Commit import/ }).click();
    await expect(page.getByRole('link', { name: /Stammbaum öffnen|Open tree/ })).toBeVisible();

    const res = await api.get(`/api/v1/trees/${treeId}/persons`);
    const persons = (await res.json()) as { firstName: string; lastName: string }[];
    expect(persons).toHaveLength(2);
    expect(persons.some(p => p.firstName === 'Max' && p.lastName === 'Mustermann')).toBe(true);
    expect(persons.some(p => p.firstName === 'Maria' && p.lastName === 'Huber')).toBe(true);

    await page.getByRole('link', { name: /Stammbaum öffnen|Open tree/ }).click();
    await expect(page).toHaveURL(new RegExp(`/trees/${treeId}$`));
    await expect(page.locator('.qs-people__row')).toHaveCount(2);
    await expect(page.locator('.qs-people__row').filter({ hasText: 'Mustermann' })).toBeVisible();
    await expect(page.locator('.qs-people__row').filter({ hasText: 'Huber' })).toBeVisible();
  });

  test(
    'marriage line links the spouses',
    async ({ demo, api }) => {
      const page = demo;
      const text = fs.readFileSync(SAMPLE_PATH, 'utf8');

      await page.goto(`/trees/${treeId}/import`);

      await page.locator('textarea.qs-import__textarea').fill(text);
      await page.getByRole('button', { name: /^(Vorschau|Preview)$/ }).click();

      // The fixture's marriage line ("... oo ...") must link the two persons it names: 1 relationship, no link warning.
      const stats = page.locator('.qs-import__stats');
      await expect(stats).toHaveText(/^2\s+(persons|Personen)\s+·\s+1\s+(relationships|Beziehungen)$/);
      await expect(page.getByText(/Could not link marriage/)).not.toBeVisible();

      await page.getByRole('button', { name: /Import übernehmen|Commit import/ }).click();
      await expect(page.getByRole('link', { name: /Stammbaum öffnen|Open tree/ })).toBeVisible();
      await expect(stats).toHaveText(/^2\s+(persons|Personen)\s+·\s+1\s+(relationships|Beziehungen)$/);

      const res = await api.get(`/api/v1/trees/${treeId}/persons`);
      const persons = (await res.json()) as { firstName: string; lastName: string }[];
      expect(persons).toHaveLength(2);
    },
  );
});
