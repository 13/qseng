import { expect, test } from '../fixtures';
import { axeCheck } from '../helpers/axe';
import { deleteTree, login } from '../helpers/api';

test.describe('onboarding', () => {
  // freshUser starts with zero trees, so nothing to seed via the API here — every tree in this
  // file is created through the stepper itself; afterEach sweeps whatever that user ended up with.
  test.afterEach(async ({ request, freshUser }) => {
    const token = await login(request, freshUser.username, freshUser.password);
    const res = await request.get('/api/v1/trees', { headers: { Authorization: `Bearer ${token}` } });
    const trees = (await res.json()) as { id: string }[];
    for (const t of trees) await deleteTree(request, token, t.id);
  });

  test('hero -> stepper (tree, you, one parent) lands on the tree view with two people, "you" selected', async ({ freshUser }) => {
    const page = freshUser.page;
    await expect(page).toHaveURL(/\/trees/);
    await expect(page.getByRole('button', { name: /Start your family tree|Starte deinen Stammbaum/ })).toBeVisible();
    await axeCheck(page, 'onboarding-hero');

    await page.getByRole('button', { name: /Start your family tree|Starte deinen Stammbaum/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Step 1: the tree
    const treeName = `Fresh Family ${Date.now()}`;
    await dialog.locator('input[formcontrolname="name"]').fill(treeName);
    await dialog.getByRole('button', { name: /Next|Weiter/ }).click();

    // Step 2: you
    await dialog.locator('input[formcontrolname="firstName"]:visible').fill('Fresh');
    await dialog.locator('input[formcontrolname="lastName"]:visible').fill('Person');
    // "Male"/"Männlich" is matched with `exact` since Playwright's default substring matching
    // would otherwise also pick up "Female"/"Weiblich" (it literally contains "male"/"Männlich").
    await dialog.getByRole('radio', { name: /Männlich|Male/, exact: true }).click();
    await dialog.getByRole('button', { name: /Next|Weiter/ }).click();

    // Step 3: one parent (mother only)
    const mother = dialog.locator('[formgroupname="mother"]');
    await mother.locator('input[formcontrolname="firstName"]').fill('Mom');
    await mother.locator('input[formcontrolname="lastName"]').fill('Person');
    await mother.getByRole('radio', { name: /Weiblich|Female/ }).click();
    await dialog.getByRole('button', { name: /Finish|Fertig/ }).click();

    await expect(page.getByText(/Your tree is ready\.|Dein Stammbaum ist bereit\./).first()).toBeVisible();
    await expect(page).toHaveURL(/\/trees\/[^/]+\?select=/);

    await expect(page.locator('.qs-people__row')).toHaveCount(2);
    const you = page.locator('.qs-people__row[aria-current="true"]');
    await expect(you).toHaveCount(1);
    await expect(you).toContainText('Person, Fresh');
    await axeCheck(page, 'onboarding-tree-view');
  });

  test('skip parents leaves a tree with just "you"', async ({ freshUser }) => {
    const page = freshUser.page;
    await page.getByRole('button', { name: /Start your family tree|Starte deinen Stammbaum/ }).click();
    const dialog = page.getByRole('dialog');

    await dialog.locator('input[formcontrolname="name"]').fill(`Fresh Family ${Date.now()}`);
    await dialog.getByRole('button', { name: /Next|Weiter/ }).click();

    await dialog.locator('input[formcontrolname="firstName"]:visible').fill('Solo');
    await dialog.locator('input[formcontrolname="lastName"]:visible').fill('Person');
    await dialog.getByRole('radio', { name: /Weiblich|Female/ }).click();
    await dialog.getByRole('button', { name: /Next|Weiter/ }).click();

    await dialog.getByRole('button', { name: /Skip parents|Eltern überspringen/ }).click();

    await expect(page).toHaveURL(/\/trees\/[^/]+\?select=/);
    await expect(page.locator('.qs-people__row')).toHaveCount(1);
    await expect(page.locator('.qs-people__row[aria-current="true"]')).toContainText('Person, Solo');
  });

  test('close on step 2 leaves the created tree listed (without "you")', async ({ freshUser }) => {
    const page = freshUser.page;
    await page.getByRole('button', { name: /Start your family tree|Starte deinen Stammbaum/ }).click();
    const dialog = page.getByRole('dialog');

    const treeName = `Fresh Family ${Date.now()}`;
    await dialog.locator('input[formcontrolname="name"]').fill(treeName);
    await dialog.getByRole('button', { name: /Next|Weiter/ }).click();

    // Step 2: close instead of continuing — the tree from step 1 must survive.
    await dialog.getByRole('button', { name: /Close|Schließen/ }).click();

    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/trees$/);
    await expect(page.locator('.qs-tree-card').filter({ hasText: treeName })).toBeVisible();
  });
});
