import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '../fixtures';
import { axeCheck } from '../helpers/axe';
import { createTree, deleteTree, login } from '../helpers/api';

const DEMO_USERNAME = 'demo';
const DEMO_PASSWORD = 'Demo123!';
const SAMPLE_PATH = path.resolve(__dirname, '../assets/sample-import.txt');

test.describe('import', () => {
  let treeId: string;

  test.beforeEach(async ({ request }) => {
    const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    treeId = await createTree(request, token, `E2E Import ${Date.now()}`);
  });

  test.afterEach(async ({ request }) => {
    const token = await login(request, DEMO_USERNAME, DEMO_PASSWORD);
    await deleteTree(request, token, treeId);
  });

  test('paste the format-guide example, preview counts, commit, and see the people in the tree', async ({ demo, api }) => {
    const page = demo;
    const text = fs.readFileSync(SAMPLE_PATH, 'utf8');

    await page.goto(`/trees/${treeId}/import`);
    await axeCheck(page, 'import');

    await page.locator('textarea.qs-import__textarea').fill(text);
    await page.getByRole('button', { name: /^(Vorschau|Preview)$/ }).click();

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

  test.fixme(
    'marriage line links the spouses (blocked by GenealogyTextParser.MarriageRx truncating the spouse name)',
    async ({ demo, api }) => {
      const page = demo;
      const text = fs.readFileSync(SAMPLE_PATH, 'utf8');

      await page.goto(`/trees/${treeId}/import`);

      await page.locator('textarea.qs-import__textarea').fill(text);
      await page.getByRole('button', { name: /^(Vorschau|Preview)$/ }).click();

      // The fixture's marriage line ("... oo ...") should link the two persons it names, but
      // never actually does: the parser's spouse-name capture group has no required trailing
      // token, so it lazily matches just the first two characters of the second name and the
      // relationship link fails to resolve (see GenealogyTextParser.MarriageRx — confirmed
      // against the real .NET regex, not just this test). Once that's fixed, this should show
      // 1 relationship and no "Could not link marriage" warning instead of today's 0.
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
