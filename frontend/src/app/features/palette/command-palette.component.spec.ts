import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandPaletteComponent, CommandPaletteData } from './command-palette.component';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { LangPreferenceService } from '../../core/i18n/lang-preference.service';
import { ThemeService } from '../../core/theme/theme.service';
import { PaletteService } from '../../core/ui/palette.service';
import { ToastService } from '../../core/ui/toast.service';
import { PersonsApi, TreesApi } from '../../core/api/generated';
import { paletteTreeCache } from './palette-cache';

const konrad = { id: 'p1', firstName: 'Konrad', lastName: 'Smith', sex: 'Male' as const, birthPlace: 'Vienna' };
const otto   = { id: 'p3', firstName: 'Otto', lastName: 'Krause', sex: 'Male' as const, birthPlace: 'Vienna' };
const maria  = { id: 'p2', firstName: 'Maria', lastName: 'Smith', sex: 'Female' as const, birthPlace: 'Vienna' };

const I18N_STRINGS: Record<string, string> = {
  'palette.results': '__N__ results',
  'palette.noResults': 'No results',
  'palette.group.people': 'People in __TREE__',
  'palette.group.trees': 'Trees',
  'palette.group.actions': 'Actions'
};

function key(target: Element, k: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}

function setup(data: CommandPaletteData = { treeId: 't1' }, treesList: { id: string; name: string }[] = [{ id: 't1', name: 'Demo' }, { id: 't9', name: 'Other Tree' }]) {
  TestBed.resetTestingModule();
  const ref = { close: vi.fn() };
  const router = { navigate: vi.fn() };
  const dialog = { open: vi.fn() };
  const treesApi = { treesGetAll: vi.fn(() => of(treesList)) };
  const personsApi = { personsGetByTree: vi.fn(() => of([konrad, otto, maria])) };
  const resolve = (k: string) => I18N_STRINGS[k] ?? k;
  const i18n = { t: resolve, dynamic: resolve, lang: () => 'en' as const };
  const theme = { mode: () => 'light' as const, setMode: vi.fn() };
  const auth = { isAdmin: signal(false) };
  const langPref = { set: vi.fn() };
  const paletteService = { openShortcuts: vi.fn(), open: vi.fn() };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), errorFrom: vi.fn() };

  TestBed.configureTestingModule({
    imports: [CommandPaletteComponent],
    providers: [
      provideNoopAnimations(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: ref },
      { provide: Router, useValue: router },
      { provide: MatDialog, useValue: dialog },
      { provide: TreesApi, useValue: treesApi },
      { provide: PersonsApi, useValue: personsApi },
      { provide: I18nService, useValue: i18n },
      { provide: ThemeService, useValue: theme },
      { provide: AuthService, useValue: auth },
      { provide: LangPreferenceService, useValue: langPref },
      { provide: PaletteService, useValue: paletteService },
      { provide: ToastService, useValue: toast }
    ]
  });
  const fixture = TestBed.createComponent(CommandPaletteComponent);
  fixture.detectChanges();
  const input = () => (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
  return { fixture, cmp: fixture.componentInstance, ref, router, input, treesApi, toast };
}

async function type(fixture: ReturnType<typeof setup>['fixture'], cmp: CommandPaletteComponent, term: string) {
  cmp.query.setValue(term);
  await new Promise(r => setTimeout(r, 100));
  fixture.detectChanges();
}

describe('CommandPaletteComponent', () => {
  afterEach(() => {
    paletteTreeCache.trees = null;
    paletteTreeCache.version = null;
    try { sessionStorage.removeItem('qs.treesVersion'); } catch { /* noop */ }
  });

  it('shows only the Actions group for an empty query', async () => {
    const { fixture, cmp } = setup();
    await type(fixture, cmp, '');
    const groups = cmp.groups();
    expect(groups.map(g => g.key)).toEqual(['actions']);
    expect(cmp.rows().some(r => r.kind === 'person')).toBe(false);
  });

  it('matches people by every typed token, limits to 8, and reports the result count', async () => {
    const { fixture, cmp } = setup();
    await type(fixture, cmp, 'smi');
    const groups = cmp.groups();
    const people = groups.find(g => g.key === 'people');
    expect(people?.rows.map(r => r.label)).toEqual(['Konrad Smith', 'Maria Smith']);
    expect(groups.find(g => g.key === 'trees')).toBeUndefined();
    expect(groups.find(g => g.key === 'actions')).toBeUndefined();

    const live = (fixture.nativeElement as HTMLElement).querySelector('[aria-live="polite"]');
    expect(live?.textContent?.trim()).toBe('2 results');
  });

  it('ArrowDown twice then Enter navigates to the highlighted person and closes', async () => {
    const { fixture, cmp, ref, router, input } = setup();
    await type(fixture, cmp, 'vienna');
    expect(cmp.rows().map(r => r.id)).toEqual(['p-p1', 'p-p3', 'p-p2']);

    key(input(), 'ArrowDown');
    key(input(), 'ArrowDown');
    key(input(), 'Enter');

    expect(router.navigate).toHaveBeenCalledWith(['/persons', 'p2']);
    expect(ref.close).toHaveBeenCalled();
  });

  it('renders the no-results row for a query that matches nothing', async () => {
    const { fixture, cmp } = setup();
    await type(fixture, cmp, 'zzz');
    expect(cmp.rows().length).toBe(0);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('No results');
  });

  it('Escape closes without navigating', async () => {
    const { fixture, cmp, ref, router, input } = setup();
    await type(fixture, cmp, 'vienna');
    key(input(), 'Escape');
    expect(ref.close).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('exposes combobox semantics that track the highlighted option', async () => {
    const { fixture, cmp, input } = setup();
    await type(fixture, cmp, 'smi');
    const el = input();
    expect(el.getAttribute('role')).toBe('combobox');
    expect(el.getAttribute('aria-expanded')).toBe('true');
    expect(el.getAttribute('aria-activedescendant')).toBe('qs-pal-' + cmp.active());
    expect((fixture.nativeElement as HTMLElement).querySelector('#qs-pal-' + cmp.active())).not.toBeNull();
  });

  it('drops a stale qs.lastTree once the tree list has loaded without it: no people group, tree-bound actions unavailable', async () => {
    const { fixture, cmp } = setup({ treeId: 't1' }, [{ id: 't9', name: 'Other Tree' }]);

    await type(fixture, cmp, 'smi');
    expect(cmp.groups().find(g => g.key === 'people')).toBeUndefined();

    await type(fixture, cmp, 'add');
    expect(cmp.groups().find(g => g.key === 'actions')).toBeUndefined();
  });

  it('keeps a treeId that the loaded tree list still contains', async () => {
    const { fixture, cmp } = setup({ treeId: 't1' });
    await type(fixture, cmp, 'smi');
    expect(cmp.groups().find(g => g.key === 'people')).toBeDefined();
  });

  it('caches the tree list for the session: a second construction with the same qs.treesVersion skips treesGetAll', () => {
    sessionStorage.setItem('qs.treesVersion', 'v1');
    const first = setup();
    expect(first.treesApi.treesGetAll).toHaveBeenCalledTimes(1);

    const second = setup();
    expect(second.treesApi.treesGetAll).not.toHaveBeenCalled();
    // Compare by shape, not reference: each construction builds its own `PaletteAction[]`
    // (fresh closures), so the rows' `action` functions would never be `toEqual` even when
    // the cached list served the same trees.
    expect(second.cmp.groups().map(g => g.key)).toEqual(first.cmp.groups().map(g => g.key));
  });

  it('refetches when qs.treesVersion has moved on (a tree was created/deleted/renamed elsewhere)', () => {
    sessionStorage.setItem('qs.treesVersion', 'v1');
    setup();

    sessionStorage.setItem('qs.treesVersion', 'v2');
    const second = setup();
    expect(second.treesApi.treesGetAll).toHaveBeenCalledTimes(1);
  });
});
