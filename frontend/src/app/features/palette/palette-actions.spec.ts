import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PaletteAction, PaletteActionDeps, PaletteContext, paletteActions } from './palette-actions';
import type { RelationshipDialogResult } from '../persons/relationship-dialog.component';

function ctx(overrides: Partial<PaletteContext> = {}): PaletteContext {
  return { treeId: 't1', isAdmin: true, lang: 'en', theme: 'light', ...overrides };
}

function setup(dialogResult?: RelationshipDialogResult) {
  const router = { navigate: vi.fn() };
  const theme = { setMode: vi.fn() };
  const i18n = { t: (k: string) => k, dynamic: (k: string) => k };
  const auth = { logout: vi.fn() };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };
  const setLang = vi.fn();
  const personsApi = { personsGetByTree: vi.fn(() => of([])) };
  const paletteService = { openShortcuts: vi.fn() };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), errorFrom: vi.fn() };
  const deps = { router, theme, i18n, auth, dialog, setLang, personsApi, paletteService, toast } as unknown as PaletteActionDeps;
  const actions = paletteActions(deps);
  const byId = (id: string): PaletteAction => actions.find(a => a.id === id)!;
  return { actions, byId, router, theme, auth, setLang, paletteService, dialog, personsApi, toast };
}

describe('paletteActions', () => {
  it('returns actions in the documented order', () => {
    const { actions } = setup();
    expect(actions.map(a => a.id)).toEqual([
      'addPerson', 'addRelation', 'import', 'newTree', 'trees', 'settings', 'trash',
      'themeLight', 'themeDark', 'themeAuto', 'langDe', 'langEn', 'users', 'shortcuts', 'logout'
    ]);
  });

  it('makes the tree-bound actions unavailable without a current tree', () => {
    const { byId } = setup();
    for (const id of ['addPerson', 'addRelation', 'import']) {
      const action = byId(id);
      expect(action.available(ctx({ treeId: null }))).toBe(false);
      expect(action.available(ctx({ treeId: 't1' }))).toBe(true);
    }
  });

  it('hides Users from non-admins', () => {
    const { byId } = setup();
    const users = byId('users');
    expect(users.available(ctx({ isAdmin: false }))).toBe(false);
    expect(users.available(ctx({ isAdmin: true }))).toBe(true);
  });

  it('themeDark.run switches the theme to dark', () => {
    const { byId, theme } = setup();
    byId('themeDark').run(ctx());
    expect(theme.setMode).toHaveBeenCalledWith('dark');
  });

  it('themeLight and themeAuto switch to their respective modes', () => {
    const { byId, theme } = setup();
    byId('themeLight').run(ctx());
    byId('themeAuto').run(ctx());
    expect(theme.setMode).toHaveBeenNthCalledWith(1, 'light');
    expect(theme.setMode).toHaveBeenNthCalledWith(2, 'auto');
  });

  it('langDe and langEn call setLang with the target language', () => {
    const { byId, setLang } = setup();
    byId('langDe').run(ctx());
    byId('langEn').run(ctx());
    expect(setLang).toHaveBeenNthCalledWith(1, 'de');
    expect(setLang).toHaveBeenNthCalledWith(2, 'en');
  });

  it('trash navigates to /settings with the trash fragment', () => {
    const { byId, router } = setup();
    byId('trash').run(ctx());
    expect(router.navigate).toHaveBeenCalledWith(['/settings'], { fragment: 'trash' });
  });

  it('trash is available without a current tree', () => {
    const { byId } = setup();
    expect(byId('trash').available(ctx({ treeId: null }))).toBe(true);
  });

  it('newTree navigates to /trees with the one-shot create flag', () => {
    const { byId, router } = setup();
    byId('newTree').run(ctx());
    expect(router.navigate).toHaveBeenCalledWith(['/trees'], { queryParams: { new: 1 } });
  });

  it('addPerson and import navigate under the current tree', () => {
    const { byId, router } = setup();
    byId('addPerson').run(ctx({ treeId: 't7' }));
    expect(router.navigate).toHaveBeenCalledWith(['/trees', 't7', 'persons', 'new']);
    byId('import').run(ctx({ treeId: 't7' }));
    expect(router.navigate).toHaveBeenCalledWith(['/trees', 't7', 'import']);
  });

  it('logout logs out and navigates to /login', () => {
    const { byId, router, auth } = setup();
    byId('logout').run(ctx());
    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('shortcuts delegates to PaletteService.openShortcuts', () => {
    const { byId, paletteService } = setup();
    byId('shortcuts').run(ctx());
    expect(paletteService.openShortcuts).toHaveBeenCalled();
  });

  it('addRelation fetches the tree\'s persons, opens the dialog, and toasts the shared "added" message for a new person', async () => {
    const created = { id: 'p9', firstName: 'Maria', lastName: 'Smith' };
    const result: RelationshipDialogResult = { relationship: { id: 'r1' }, uiType: 'Parent', created };
    const { byId, dialog, personsApi, toast } = setup(result);

    await byId('addRelation').run(ctx({ treeId: 't7' }));

    expect(personsApi.personsGetByTree).toHaveBeenCalledWith({ treeId: 't7' });
    expect(dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: expect.objectContaining({ treeId: 't7', mode: 'new' }) }));
    // The mock i18n.dynamic() resolves to the key verbatim, so this doubles as a check that
    // relationshipAddedMessage picked the created-person branch (rel.added.<type>), not the
    // plain rel.added.toast fallback.
    expect(toast.success).toHaveBeenCalledWith('rel.added.parent');
  });

  it('addRelation toasts nothing when the dialog closes without a result', async () => {
    const { byId, toast } = setup(undefined);
    await byId('addRelation').run(ctx({ treeId: 't7' }));
    expect(toast.success).not.toHaveBeenCalled();
  });
});
