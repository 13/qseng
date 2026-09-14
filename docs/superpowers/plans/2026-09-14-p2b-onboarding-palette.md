# P2b Onboarding, Command Palette and Shortcut Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first-run stepper that creates a tree, "you" and optionally your parents in one dialog; contextual empty states; a global `mod+K` command palette over the current tree's people, all trees and app actions; a `?` keyboard-shortcut sheet; `mod+S` saves the person form.

**Architecture:** One `ShortcutService` owns the document `keydown` listener and a registry of combos; the shell registers `mod+k` and `?`, `PersonEditComponent` registers `mod+s`. `PaletteService` lazy-loads `CommandPaletteComponent` into a `MatDialog` anchored at the top; results come from `TreeStore` when a tree route is active, else from the last opened tree id in `sessionStorage`, plus `TreesApi` and a static, guarded action list. `OnboardingDialogComponent` is a linear `MatStepper` whose steps create the tree, the person and the parents through the generated client; it closes with ids and the trees page navigates to the tree view with `?select=`.

**Tech Stack:** Angular 21 zoneless, Angular Material 21 (`MatStepper`, `MatDialog`, `MatBottomSheet`, CDK a11y), Vitest 4, generated OpenAPI client.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-14-p2-ux-flows-design.md` §5, §6, §7, §8. Branch `feat/p2-ux-flows`; P2a merged into it first (this plan reuses `RelationshipDialogResult`, `toApiRelationship`, `ToastService.undoable`).
- Frontend contracts (P1): `ToastService.errorFrom`; dialogs own their requests and stay open on error via `setServerErrors`; `if (form.invalid) { markAllAsTouched(); return; }`; `<h2 mat-dialog-title>`; first field `cdkFocusInitial`; i18n keys in BOTH dictionaries (sorted, identical sets) + `npm run gen:i18n`; no `ngModel`; `npm run gates`, `ng lint`, `ng build` (budget 800 kB: palette, onboarding and shortcut sheet must be lazy chunks) and the suite green before every commit.
- Zoneless: no zone.js; document listeners live in services created in injection context and clean up via `DestroyRef`; state changes go through signals.
- Keyboard: `mod` = Cmd on macOS (`navigator.platform` starts with `Mac`), Ctrl elsewhere; shortcuts never fire while typing in inputs/textareas/contenteditable or inside an open CDK overlay, except `mod+k`, `Escape`, and combos registered with `allowInInputs`.
- Tooling: `cd` is broken in the sandbox shell — `npm --prefix`, `git -C`, absolute paths; `ng test --watch=false` inside `timeout 300`; stale vitest workers `ps -eo pid,args | grep "suppress-warn[i]ng" | awk '{print $1}' | xargs -r kill -9`; never `pkill -f`.
- Commit messages end with the attribution lines from the session's system reminder.

## File structure produced by this plan

```
frontend/src/app/core/ui/shortcut.service.ts (+ spec)                 keydown registry
frontend/src/app/core/ui/palette.service.ts                            lazy open of the palette / sheet
frontend/src/app/features/palette/command-palette.component.ts (+ spec)
frontend/src/app/features/palette/palette-actions.ts (+ spec)          static action list + guards
frontend/src/app/features/palette/shortcut-sheet.component.ts (+ spec)
frontend/src/app/features/onboarding/onboarding-dialog.component.ts (+ spec)
frontend/src/app/app.ts                                                search icon, menu item, shortcut registration
frontend/src/app/features/trees/tree-list.component.ts                 hero empty state → stepper
frontend/src/app/features/trees/tree-view/tree-view.component.ts       `select` input, `qs.lastTree`, 0-person empty state
frontend/src/app/features/persons/person-edit.component.ts             mod+S
frontend/public/assets/i18n/{en,de}.json                               palette.*, shortcuts.*, onb.*, nav.search, nav.shortcuts, tree.emptyAddSelf
```

---

### Task 1: ShortcutService

**Files:**
- Create: `frontend/src/app/core/ui/shortcut.service.ts`, `shortcut.service.spec.ts`
- Modify: `frontend/src/app/features/persons/person-edit.component.ts` (mod+S), `frontend/src/app/app.ts` (register `mod+k` and `?` as no-ops for now — Task 2/3 fill them)

**Interfaces:**
- Produces:
  ```ts
  export type ShortcutCombo = 'mod+k' | 'mod+s' | '?' | 'Escape';
  export interface ShortcutOptions { allowInInputs?: boolean }
  register(combo: ShortcutCombo, handler: (ev: KeyboardEvent) => void, opts?: ShortcutOptions): () => void  // returns unregister
  readonly modLabel: 'Ctrl' | '⌘'
  ```

- [ ] **Step 1: Failing spec**

`shortcut.service.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ShortcutService } from './shortcut.service';

function key(target: Element, init: KeyboardEventInit) {
  const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(ev);
  return ev;
}

describe('ShortcutService', () => {
  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    document.body.innerHTML = '<input id="i"><div id="d"></div>';
    return TestBed.inject(ShortcutService);
  }

  it('fires mod+k from the document but not plain k', () => {
    const svc = setup();
    const h = vi.fn();
    svc.register('mod+k', h);
    key(document.body, { key: 'k', ctrlKey: true });
    key(document.body, { key: 'k' });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('ignores ? typed into an input unless allowInInputs', () => {
    const svc = setup();
    const h = vi.fn(); const s = vi.fn();
    svc.register('?', h);
    svc.register('mod+s', s, { allowInInputs: true });
    const input = document.getElementById('i')!;
    key(input, { key: '?' });
    key(input, { key: 's', ctrlKey: true });
    expect(h).not.toHaveBeenCalled();
    expect(s).toHaveBeenCalledTimes(1);
  });

  it('prevents the browser default for handled combos and stops after unregister', () => {
    const svc = setup();
    const off = svc.register('mod+k', () => undefined);
    expect(key(document.body, { key: 'k', ctrlKey: true }).defaultPrevented).toBe(true);
    off();
    expect(key(document.body, { key: 'k', ctrlKey: true }).defaultPrevented).toBe(false);
  });

  it('mod+k still fires inside an input (palette is reachable while typing)', () => {
    const svc = setup();
    const h = vi.fn();
    svc.register('mod+k', h);
    key(document.getElementById('i')!, { key: 'k', ctrlKey: true });
    expect(h).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import { DestroyRef, Injectable, inject } from '@angular/core';

export type ShortcutCombo = 'mod+k' | 'mod+s' | '?' | 'Escape';
export interface ShortcutOptions { allowInInputs?: boolean }
interface Entry { handler: (ev: KeyboardEvent) => void; allowInInputs: boolean }

const ALWAYS: ReadonlySet<ShortcutCombo> = new Set(['mod+k', 'Escape']);

/** One document-level keydown listener; components register combos and get an unregister function back. */
@Injectable({ providedIn: 'root' })
export class ShortcutService {
  private readonly entries = new Map<ShortcutCombo, Entry[]>();
  readonly isMac = typeof navigator !== 'undefined' && /^Mac/i.test(navigator.platform ?? '');
  readonly modLabel: 'Ctrl' | '⌘' = this.isMac ? '⌘' : 'Ctrl';

  constructor() {
    const onKey = (ev: KeyboardEvent) => this.dispatch(ev);
    document.addEventListener('keydown', onKey);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('keydown', onKey));
  }

  register(combo: ShortcutCombo, handler: (ev: KeyboardEvent) => void, opts: ShortcutOptions = {}): () => void {
    const entry: Entry = { handler, allowInInputs: opts.allowInInputs ?? false };
    const list = this.entries.get(combo) ?? [];
    list.push(entry);
    this.entries.set(combo, list);
    return () => { const l = this.entries.get(combo) ?? []; const i = l.indexOf(entry); if (i >= 0) l.splice(i, 1); };
  }

  private comboOf(ev: KeyboardEvent): ShortcutCombo | null {
    const mod = this.isMac ? ev.metaKey : ev.ctrlKey;
    if (mod && !ev.shiftKey && !ev.altKey && ev.key.toLowerCase() === 'k') return 'mod+k';
    if (mod && !ev.shiftKey && !ev.altKey && ev.key.toLowerCase() === 's') return 'mod+s';
    if (!mod && !ev.altKey && ev.key === '?') return '?';
    if (ev.key === 'Escape') return 'Escape';
    return null;
  }

  private static inEditable(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el || !el.closest) return false;
    return !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
  }

  private dispatch(ev: KeyboardEvent) {
    const combo = this.comboOf(ev);
    if (!combo) return;
    const editable = ShortcutService.inEditable(ev.target);
    const inOverlay = !!(ev.target as HTMLElement | null)?.closest?.('.cdk-overlay-container');
    const list = (this.entries.get(combo) ?? []).slice().reverse();  // last registered wins
    for (const e of list) {
      if (editable && !e.allowInInputs && !ALWAYS.has(combo)) continue;
      if (inOverlay && !ALWAYS.has(combo) && combo !== 'mod+s') continue;
      ev.preventDefault();
      e.handler(ev);
      return;
    }
  }
}
```

- [ ] **Step 3: Wire `mod+s` in PersonEditComponent**

In the constructor: `const off = inject(ShortcutService).register('mod+s', () => { if (!this.saving()) void this.save(); }, { allowInInputs: true }); inject(DestroyRef).onDestroy(off);`. Spec: dispatching Ctrl+S on the document calls `save` (spy) once.

- [ ] **Step 4: Suite, lint, gates, commit**

```bash
timeout 300 npx --prefix /home/ben/repo/qseng/frontend ng test --watch=false --include='**/shortcut.service.spec.ts' --include='**/person-edit.component.spec.ts'
npx --prefix /home/ben/repo/qseng/frontend ng lint && npm run gates --prefix /home/ben/repo/qseng/frontend
git -C /home/ben/repo/qseng add frontend/src/app/core/ui/shortcut.service.ts frontend/src/app/core/ui/shortcut.service.spec.ts frontend/src/app/features/persons/person-edit.component.ts frontend/src/app/features/persons/person-edit.component.spec.ts
git -C /home/ben/repo/qseng commit -m "feat(ui): ShortcutService with mod+K/mod+S/? registry; mod+S saves the person form"
```

---

### Task 2: Command palette

**Files:**
- Create: `frontend/src/app/features/palette/palette-actions.ts` (+ spec), `command-palette.component.ts` (+ spec), `frontend/src/app/core/ui/palette.service.ts`
- Modify: `frontend/src/app/app.ts` (search icon button, `mod+k` registration), `frontend/src/app/features/trees/tree-view/tree-view.component.ts` (`sessionStorage.setItem('qs.lastTree', treeId)` in the load effect, guarded by try/catch), i18n

**Interfaces:**
- Produces:
  ```ts
  // palette-actions.ts
  export interface PaletteContext { treeId: string | null; isAdmin: boolean; lang: 'de' | 'en'; theme: 'light' | 'dark' | 'auto' }
  export interface PaletteAction { id: string; labelKey: TranslationKey; icon: string; run: (ctx: PaletteContext) => void; available: (ctx: PaletteContext) => boolean }
  export function paletteActions(deps: { router: Router; theme: ThemeService; i18n: I18nService; auth: AuthService; dialog: MatDialog; setLang: (l: Lang) => void }): PaletteAction[]
  // palette.service.ts
  open(): Promise<void>            // lazy-imports CommandPaletteComponent, opens MatDialog at top
  openShortcuts(): Promise<void>   // Task 3
  ```
- Consumes: `TreeStore` (optional, via `Injector` lookup when a tree route is active — the palette is opened from the shell, so it receives `{ treeId, persons }` through dialog data resolved by `PaletteService`: if `sessionStorage['qs.lastTree']` is set it calls `PersonsApi.personsGetByTree({ treeId })`; the service does not depend on route-scoped providers).

- [ ] **Step 1: i18n**

```
"nav.search": "Search and commands" / "Suche und Befehle"
"palette.placeholder": "Search people, trees, actions…" / "Personen, Stammbäume, Aktionen suchen…"
"palette.group.people": "People in __TREE__" / "Personen in __TREE__"
"palette.group.trees": "Trees" / "Stammbäume"
"palette.group.actions": "Actions" / "Aktionen"
"palette.noResults": "No results" / "Keine Treffer"
"palette.results": "__N__ results" / "__N__ Treffer"
"palette.action.addPerson": "Add person" / "Person hinzufügen"
"palette.action.addRelation": "Add relationship" / "Beziehung hinzufügen"
"palette.action.import": "Import" / "Importieren"
"palette.action.newTree": "New tree" / "Neuer Stammbaum"
"palette.action.trees": "My trees" / "Meine Stammbäume"
"palette.action.settings": "Settings" / "Einstellungen"
"palette.action.themeLight": "Theme: light" / "Design: hell"
"palette.action.themeDark": "Theme: dark" / "Design: dunkel"
"palette.action.themeAuto": "Theme: follow system" / "Design: System"
"palette.action.langDe": "Deutsch" / "Deutsch"
"palette.action.langEn": "English" / "English"
"palette.action.users": "Users" / "Benutzer"
"palette.action.logout": "Sign out" / "Abmelden"
"palette.action.shortcuts": "Keyboard shortcuts" / "Tastenkürzel"
```

- [ ] **Step 2: Actions module + spec**

`palette-actions.ts` returns the list in this order: addPerson (`available: ctx => !!ctx.treeId`, `run: navigate(['/trees', treeId, 'persons', 'new'])`), addRelation (available with tree; run opens `RelationshipDialogComponent` via dynamic import with `{ treeId, persons: [], mode: 'new' }` — persons are loaded inside the dialog opener: `PersonsApi.personsGetByTree` first), import (with tree → `/trees/:id/import`), newTree (→ `/trees` then opens the create dialog through a query flag `?new=1` that `TreeListComponent` reads once), trees (`/trees`), settings, themeLight/Dark/Auto (`theme.setMode`), langDe/langEn (`setLang`, the shell's existing method that persists via `UserApi`), users (`available: ctx => ctx.isAdmin`), shortcuts (`PaletteService.openShortcuts`), logout (`auth.logout()` + navigate `/login`).
Spec `palette-actions.spec.ts`: with `treeId: null` the tree-bound actions are unavailable; with `isAdmin: false` `users` is unavailable; `themeDark.run` calls `theme.setMode('dark')`.

- [ ] **Step 3: Failing component spec**

`command-palette.component.spec.ts` (TestBed with `MAT_DIALOG_DATA = { treeId: 't1', treeName: 'Demo', persons: [konrad, maria, otto] }`, `MatDialogRef` mock, `Router` mock, `TreesApi` mock returning two trees, `I18nService` stub, `AuthService` stub `{ isAdmin: signal(false) }`, `provideNoopAnimations`):
- empty query → only the Actions group, no people rows;
- typing `smi` → People group lists Konrad Smith and Maria Smith (limit 8), Trees group empty, Actions filtered to none; the live region text is `palette.results` with `__N__` = 2;
- `ArrowDown` twice then `Enter` → `router.navigate(['/persons', 'p2'])` and the dialog closes;
- typing `zzz` → the no-results row is rendered;
- `Escape` closes without navigation;
- the input has `role="combobox"`, `aria-expanded="true"` while results exist, and `aria-activedescendant` equals the id of the highlighted option.

- [ ] **Step 4: Implement the component**

Template skeleton:
```html
<div class="qs-palette" role="dialog" [attr.aria-label]="'nav.search' | translate">
  <mat-icon aria-hidden="true">search</mat-icon>
  <input #q class="qs-palette__input" cdkFocusInitial role="combobox" aria-autocomplete="list" [attr.aria-expanded]="rows().length > 0"
         aria-controls="qs-palette-list" [attr.aria-activedescendant]="rows().length ? 'qs-pal-' + active() : null"
         [placeholder]="'palette.placeholder' | translate" [formControl]="query" (keydown.arrowdown)="move(1, $event)" (keydown.arrowup)="move(-1, $event)" (keydown.enter)="runActive($event)" (keydown.escape)="ref.close()">
  <div class="cdk-visually-hidden" aria-live="polite">{{ liveText() }}</div>
  <ul id="qs-palette-list" role="listbox" class="qs-palette__list">
    @for (g of groups(); track g.key) {
      <li role="presentation" class="qs-palette__group">{{ g.label }}</li>
      @for (r of g.rows; track r.id) {
        <li role="option" [id]="'qs-pal-' + r.index" [attr.aria-selected]="r.index === active()" class="qs-palette__row" [class.qs-palette__row--active]="r.index === active()"
            (mousemove)="active.set(r.index)" (click)="run(r)">
          <mat-icon aria-hidden="true">{{ r.icon }}</mat-icon><span class="qs-palette__label">{{ r.label }}</span>@if (r.hint) { <span class="qs-muted">{{ r.hint }}</span> }
        </li>
      }
    }
    @if (!rows().length) { <li role="option" aria-selected="false" class="qs-palette__row qs-muted">{{ 'palette.noResults' | translate }}</li> }
  </ul>
</div>
```
Logic: `query = new FormControl('', { nonNullable: true })`; `term = toSignal(query.valueChanges.pipe(debounceTime(80)), { initialValue: '' })`; `people = computed(...)` (tokens of the term all contained in `personSearchText(p)` from `tree-graph.model.ts`, max 8, only when term non-empty); `trees = computed(...)` (from a `signal<TreeDto[]>` loaded once via `TreesApi.treesGetAll()` in the constructor, name contains term, max 5); `actions = computed(...)` (label contains term, `available(ctx)`); `groups()` builds `[people, trees, actions]` with running `index`; `rows()` flattens; `active` signal reset to 0 on term change (effect); `move`, `runActive`, `run(row)`: person → `router.navigate(['/persons', id])`, tree → `['/trees', id]`, action → `action.run(ctx)`; then `ref.close()`. `liveText = computed(() => rows().length ? t('palette.results').replace('__N__', String(rows().length)) : t('palette.noResults'))`. Styles: `.qs-palette { width: min(640px, 95vw); }`, list `max-height: 60vh; overflow: auto`, active row `background: var(--mat-sys-secondary-container)`.

`PaletteService.open()`:
```ts
async open() {
  if (this.ref) { this.ref.close(); return; }
  const treeId = read('qs.lastTree');
  const [{ CommandPaletteComponent }, persons, treeName] = await Promise.all([
    import('../../features/palette/command-palette.component'),
    treeId ? firstValueFrom(this.personsApi.personsGetByTree({ treeId })).catch(() => []) : Promise.resolve([]),
    treeId ? firstValueFrom(this.treesApi.treesGetAll()).then(ts => ts.find(t => t.id === treeId)?.name ?? '').catch(() => '') : Promise.resolve('')
  ]);
  this.ref = this.dialog.open(CommandPaletteComponent, { data: { treeId, treeName, persons }, position: { top: '10vh' }, panelClass: 'qs-palette-panel', autoFocus: '[cdkFocusInitial]', restoreFocus: true });
  this.ref.afterClosed().subscribe(() => (this.ref = null));
}
```
(`treesGetAll` is cheap; if the palette is opened often, cache the list in the service for the session.) The shell (`app.ts`): `ShortcutService.register('mod+k', () => void palette.open())` in the constructor, plus `<button matIconButton (click)="palette.open()" [matTooltip]="'nav.search' | translate" [attr.aria-label]="'nav.search' | translate"><mat-icon>search</mat-icon></button>` before the theme button; `.qs-palette-panel .mat-mdc-dialog-surface { padding: 0 }` in `_base.scss`. `TreeViewComponent` load effect: `try { sessionStorage.setItem('qs.lastTree', id); } catch {}`.

- [ ] **Step 5: Suite, lint, gates, build (palette must be a lazy chunk: `grep -l "qs-palette" dist/frontend/browser/main-*.js` → nothing), commit**

```bash
git -C /home/ben/repo/qseng add frontend/src frontend/public/assets/i18n
git -C /home/ben/repo/qseng commit -m "feat(ui): command palette (mod+K) over the current tree's people, trees and app actions"
```

---

### Task 3: Shortcut sheet

**Files:**
- Create: `frontend/src/app/features/palette/shortcut-sheet.component.ts` (+ spec)
- Modify: `frontend/src/app/core/ui/palette.service.ts` (`openShortcuts()` lazy `MatBottomSheet`), `frontend/src/app/app.ts` (`?` registration; user-menu item "Keyboard shortcuts"), i18n

- [ ] **Step 1: i18n**

```
"nav.shortcuts": "Keyboard shortcuts" / "Tastenkürzel"
"shortcuts.title": "Keyboard shortcuts" / "Tastenkürzel"
"shortcuts.palette": "Open the command palette" / "Befehlspalette öffnen"
"shortcuts.sheet": "Show this sheet" / "Diese Übersicht anzeigen"
"shortcuts.save": "Save the person form" / "Personenformular speichern"
"shortcuts.close": "Close dialogs and clear the selection" / "Dialoge schließen und Auswahl aufheben"
"shortcuts.tree": "Tree view (canvas focused)" / "Stammbaum (Grafik fokussiert)"
"shortcuts.zoom": "Zoom in / out / fit" / "Vergrößern / verkleinern / einpassen"
"shortcuts.move": "Move selection to parent / child / spouse" / "Auswahl zu Elternteil / Kind / Partner"
"shortcuts.open": "Open the selected person" / "Ausgewählte Person öffnen"
```

- [ ] **Step 2: Spec + component**

Spec: renders a `<h2>` with `shortcuts.title`, a `<dl>` containing the `modLabel` from `ShortcutService` (`Ctrl` in tests) followed by `K`, and the tree-view rows; the close button dismisses the sheet (`MatBottomSheetRef.dismiss` called).
Component: `MatBottomSheet` content, `<h2 id="qs-sc-title">`, `<dl class="qs-shortcuts">` with `<div><dt><kbd>Ctrl</kbd>+<kbd>K</kbd></dt><dd>…</dd></div>` rows (kbd styled via a small `.qs-kbd` rule in `_base.scss`), a "Close" `matButton`. `PaletteService.openShortcuts()` lazy-imports and opens it with `panelClass: ['qs-sheet', 'qs-sheet--auto']`, `ariaLabelledBy: 'qs-sc-title'`. Shell: `register('?', () => void palette.openShortcuts())`; user menu gains `<button mat-menu-item (click)="palette.openShortcuts()"><mat-icon>keyboard</mat-icon>{{ 'nav.shortcuts' | translate }}</button>` above the language items.

- [ ] **Step 3: Suite, lint, gates, build, commit** — `feat(ui): keyboard shortcut sheet (?)`.

---

### Task 4: Onboarding stepper

**Files:**
- Create: `frontend/src/app/features/onboarding/onboarding-dialog.component.ts` (+ spec)
- Modify: `frontend/src/app/features/trees/tree-list.component.ts` (+ spec) — hero empty state, `?new=1` flag from Task 2, navigation after finish; `frontend/src/app/features/trees/tree-view/tree-view.component.ts` (+ spec) — `select` route input, 0-person empty state; i18n

**Interfaces:**
- Produces: `OnboardingDialogComponent` closes with `{ treeId: string; personId: string } | undefined`; `TreeViewComponent` input `select = input<string>()` seeds `store.select` after the load (same effect as `q`).
- Consumes: `TreesApi.treesCreate({ body: { name, description } })`, `PersonsApi.personsCreate({ treeId, body })`, `RelationshipsApi.relationshipsCreate({ treeId, body: toApiRelationship('Parent', parentId, youId) })`.

- [ ] **Step 1: i18n**

```
"onb.start": "Start your family tree" / "Starte deinen Stammbaum"
"onb.hero": "Name your tree, add yourself, then your parents — three short steps." / "Benenne deinen Stammbaum, füge dich selbst und deine Eltern hinzu – drei kurze Schritte."
"onb.step.tree": "Your tree" / "Dein Stammbaum"
"onb.step.you": "You" / "Du"
"onb.step.parents": "Your parents" / "Deine Eltern"
"onb.treeName": "Tree name" / "Name des Stammbaums"
"onb.treeDescription": "Description (optional)" / "Beschreibung (optional)"
"onb.mother": "Mother" / "Mutter"
"onb.father": "Father" / "Vater"
"onb.next": "Next" / "Weiter"
"onb.finish": "Finish" / "Fertig"
"onb.skip": "Skip parents" / "Eltern überspringen"
"onb.ready": "Your tree is ready." / "Dein Stammbaum ist bereit."
"onb.importInstead": "Import from text instead" / "Stattdessen aus Text importieren"
"tree.emptyTitle": "No people yet" / "Noch keine Personen"
"tree.emptyAddSelf": "Add yourself" / "Dich selbst hinzufügen"
```

- [ ] **Step 2: Failing spec** (`onboarding-dialog.component.spec.ts`, mocks for the three APIs returning `of({ id: 't1' })`, `of({ id: 'me' })`, `of({ id: 'r1' })`; `MatDialogRef` mock; `provideNoopAnimations`):
- step 1 `next()` with an empty name marks the field touched and calls nothing;
- step 1 `next()` with a name calls `treesCreate` and moves to step 2 (`stepper.selectedIndex === 1`), step 1 becomes non-editable;
- step 2 `next()` calls `personsCreate` with `treeId 't1'` and the entered names;
- step 3 `finish()` with only the mother filled creates one person and one `Parent` relationship (`fromPersonId: 'm1', toPersonId: 'me'` — verify against `toApiRelationship`), then closes with `{ treeId: 't1', personId: 'me' }`;
- step 3 `skip()` closes without further calls;
- a failing `personsCreate` (validation problem) keeps step 2 open and shows the server error on `firstName`.

- [ ] **Step 3: Implement**

Component (imports `MatStepperModule`, `MatDialogModule`, `MatButtonModule`, `MatFormFieldModule`, `MatInputModule`, `MatButtonToggleModule`, `ReactiveFormsModule`, `PartialDateInputComponent`, `TranslatePipe`, `FormErrorsPipe`): three `FormGroup`s (`treeForm: { name: ['', required], description: [''] }`, `youForm: { firstName: ['', required], lastName: ['', required], sex: ['Unknown'], birth: [null] }`, `parentsForm: { mother: group(firstName, lastName, sex 'Female', birth), father: group(…, sex 'Male', …) }`), signals `treeId`, `youId`, `saving`, `error`; `<mat-stepper linear #stepper [orientation]="layout.handset() ? 'vertical' : 'horizontal'">` with `[completed]="!!treeId()"`/`[editable]="!treeId()"` on step 1 and the same pattern on step 2. `next()` for step 1: validate → `treesCreate` → `treeId.set(id)`, `stepper.next()`; errors via `setServerErrors(treeForm, …)` / `errorFrom`. Step 3 `finish()`: for each parent group with a non-empty `firstName` (validate `lastName` required only for filled groups): `personsCreate` then `relationshipsCreate(toApiRelationship('Parent', parentId, youId))` sequentially; on the first failure keep the dialog open with the error (already-created rows stay); on success `ref.close({ treeId, personId: youId })`. `skip()` closes the same way. Dialog opened by `TreeListComponent` with `{ width: '640px', maxWidth: '95vw', disableClose: true }` after the tree exists (set `disableClose` from step 2 on so an accidental Escape does not lose the flow — use `ref.disableClose = true` after `treesCreate` succeeds).

`TreeListComponent`: empty state becomes the hero — `onb.start` filled button (opens the stepper lazily via `import('../onboarding/onboarding-dialog.component')`), `onb.importInstead` text button (opens the existing create dialog, then navigates to `/trees/:id/import`). On stepper result: `toast.success(t('onb.ready'))`, `router.navigate(['/trees', treeId], { queryParams: { select: personId } })`. Also read `?new=1` once (Task 2's newTree action) → `openCreate()` and clear the param.

`TreeViewComponent`: `readonly select = input<string>()`; in the load effect after `q` seeding: `untracked(() => { const s = this.select(); if (s) this.onSelected(s); })` — note `onSelected` needs the persons loaded; instead set a one-shot `pendingSelect` and apply it in the existing effect that runs when `store.persons()` becomes non-empty (`if (this.pendingSelect && store.personById(this.pendingSelect)) { this.onSelected(this.pendingSelect); this.pendingSelect = null; }`). Empty state (0 persons, not loading, no error): `qs-empty` with `tree.emptyTitle`, `tree.emptyAddSelf` (routerLink `persons/new`) and the Import link.

- [ ] **Step 4: Suite, lint, gates, build (onboarding lazy: `grep -l "onb\\." dist/frontend/browser/main-*.js` → nothing), commit** — `feat(onboarding): first-run stepper creating tree, yourself and parents; contextual empty states`.

---

### Task 5: Browser verification (controller-run)

- [ ] Register a fresh user (or delete the demo user's data in Settings) → trees page shows the hero → run the stepper end to end (tree, you, one parent) → lands on the tree view with "you" selected, toast shown; the graph shows two nodes and one descent edge.
- [ ] `mod+K` from the trees page (no last tree): Actions only. Open a tree, press `mod+K`, type a surname → people rows; Enter opens the person. `?` opens the sheet; `Escape` closes both. Ctrl+S on the person form saves.
- [ ] Handset 400 px: stepper vertical, palette usable, sheet auto height.
- [ ] axe (wcag2a/2aa/21aa) on: hero empty state, stepper (each step), palette (with results), sheet — light/dark, 1400/400 → 0 violations; screenshots into `docs/superpowers/specs/assets/p2/`; zero console errors.
- [ ] Ledger, fix wave if needed, whole-plan review (opus), commit screenshots (`docs(p2b): …`), then close P2 in the ledger and memory.

## Next plan

P3 engineering hardening (own brainstorm): CI (four gate commands), Playwright e2e with axe, coverage gates, backend rate limiting/health/logging, CORS.
