# P1d Tree View and Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the tree view on Material with a route-scoped `TreeStore`, readable SVG card nodes in the Cytoscape graph, responsive sidenav / bottom-sheet layout, a selection panel, context menu, and the shared relationship dialog. Retire the separate search route.

**Architecture:** `TreeStore` (provided on `trees/:treeId`) owns persons, relationships, selection, filter and sort. `TreeGraphService` keeps the Cytoscape lifecycle but reads colors from CSS custom properties, renders each person node as an SVG data-URI (`renderNodeSvg`, pure and tested), swaps to a compact variant below zoom 0.45, and exposes `onContext` for right-click/long-press. `TreeViewComponent` composes `mat-sidenav` (people list) + canvas + `TreeSelectionPanelComponent` (side panel on desktop, `MatBottomSheet` on handset) and reuses `RelationshipDialogComponent` (P1c-A) with or without an anchor.

**Tech Stack:** Angular 21.2 zoneless, Material 21.2.14 (`MatSidenav`, `MatBottomSheet`, `MatMenu`, `cdk-virtual-scroll`), Cytoscape + dagre (existing), Vitest, generated client.

## Global Constraints

- Spec §3 (tree view layout table), §5 (graph), §4 Tree view checklist. Prerequisites: P1c-A (`RelationshipDialogComponent`, `PartialDate` helpers, `person-helpers`) and P1c-B merged.
- Branch `feat/material-rewrite`. Do not touch `core/api/api-client.service.ts` (P1e deletes it after this plan removes its last consumers: `tree-view.component.ts`, `tree-graph.service.ts`, `tree-graph.model.ts`, `tree-search.component.ts`).
- P1b contracts: `ToastService.errorFrom`; dialogs own requests; `<h1 tabindex="-1">`; shared classes in `_base.scss` (`.qs-page-header*`, `.qs-form-error`, `.qs-dialog-form`, `.qs-empty*`, `.qs-section-header`, `.qs-sex-male|female|unknown` backgrounds) — reuse them instead of redefining; `takeUntilDestroyed()` on store loads. No `ngModel`, emoji, native `confirm()`, `autofocus`; i18n keys in both dictionaries (sorted) + `gen:i18n`.
- Tokens available: `--qs-graph-node-bg`, `--qs-graph-node-border`, `--qs-graph-marriage`, `--qs-graph-descent`, `--qs-graph-selected`, `--qs-sex-male`, `--qs-sex-female`, `--qs-sex-unknown`, `--mat-sys-on-surface`, `--mat-sys-on-surface-variant`, `--mat-sys-surface`, `--mat-sys-outline`, `--mat-sys-tertiary`, `--mat-sys-primary`. Fonts: `'Fraunces Variable'` (names), `'Inter Variable'` (lifespan). Breakpoints via `LayoutService`.
- Node design: 180×72 card, sex-hued 4px left stripe, 36px avatar circle (photo or initials), name Fraunces 14px, lifespan Inter 11px; compact variant (avatar + surname, 120×40) below zoom 0.45; selected: 2px primary border + glow; lineage emphasis retained (`.dimmed` 0.15). Edges: marriage tertiary 1.5px + 8px dot; descent outline 1.5px taxi; adoptive dashed. Zoom min 0.2 / max 2.5; fit padding 40.
- Generated shapes: `PersonsApi.personsGetByTree({ treeId })`, `personsDelete({ id })`; `RelationshipsApi.relationshipsGetByTree({ treeId })`, `relationshipsDelete({ treeId, id })`; `TreesApi.treesGetAll()`. `PersonDto.avatarUrl?: string | null`.
- Route `trees/:treeId` already carries `data: { fullBleed: true }` (shell drops the page container). Route `trees/:treeId/search` becomes a redirect to the tree view.
- `cd` broken in the sandbox shell; `--prefix`, `-C`, absolute paths; `ng test --watch=false` inside `timeout 180`; stale workers: `ps -eo pid,args | grep "suppress-warn[i]ng" | awk '{print $1}' | xargs -r kill -9`; never `pkill -f` a pattern in your own command line.
- Commit messages end with the attribution lines from the session's system reminder.

## File structure produced by this plan

```
frontend/src/app/features/trees/tree-view/tree.store.ts               new + spec
frontend/src/app/features/trees/tree-view/node-svg.ts                 new + spec (pure renderer)
frontend/src/app/features/trees/tree-view/tree-graph.model.ts         generated types, no label text
frontend/src/app/features/trees/tree-view/tree-graph.service.ts       tokens, SVG nodes, compact zoom, context hook
frontend/src/app/features/trees/tree-view/tree-selection-panel.component.ts  new + spec
frontend/src/app/features/trees/tree-view/tree-people-list.component.ts      new + spec
frontend/src/app/features/trees/tree-view/tree-view.component.ts      rewrite + spec
frontend/src/app/features/trees/tree-search.component.ts              DELETED
frontend/src/app/app.routes.ts                                        search redirect, providers: [TreeStore]
frontend/public/assets/i18n/{en,de}.json, core/i18n/translation-keys.ts
```

---

### Task 1: TreeStore

**Files:**
- Create: `frontend/src/app/features/trees/tree-view/tree.store.ts` + `tree.store.spec.ts`
- Modify: `frontend/src/app/app.routes.ts` (`providers: [TreeStore]` on `trees/:treeId`)

**Interfaces:**
```ts
export type PeopleSort = 'name' | 'birth';
@Injectable()
export class TreeStore {
  readonly tree: Signal<TreeDto | null>; readonly persons: Signal<PersonDto[]>; readonly relationships: Signal<RelationshipDto[]>;
  readonly loading: Signal<boolean>; readonly error: Signal<string>;
  readonly selectedId: Signal<string | null>; readonly filter: Signal<string>; readonly sort: Signal<PeopleSort>;
  readonly filteredPersons: Signal<PersonDto[]>;   // filter over first/last/maiden/birthPlace, then sorted
  readonly selectedPerson: Signal<PersonDto | null>;
  readonly lineage: Signal<LineageIndex>;           // indexLineage(relationships)
  load(treeId: string): void; reload(): void;
  select(id: string | null): void; setFilter(text: string): void; setSort(sort: PeopleSort): void;
  personById(id: string): PersonDto | undefined;
  relativesOf(id: string): { parents: PersonDto[]; spouses: PersonDto[]; children: PersonDto[] };
}
```

- [ ] **Step 1: Spec (failing)**

`tree.store.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TreeStore } from './tree.store';
import { PersonsApi, RelationshipsApi, TreesApi } from '../../../core/api/generated';
import { I18nService } from '../../../core/i18n/i18n.service';

const persons = [
  { id: 'gp', treeId: 't1', firstName: 'Georg', lastName: 'Smith', sex: 'Male' as const, birth: { year: 1810 } },
  { id: 'me', treeId: 't1', firstName: 'Konrad', lastName: 'Smith', sex: 'Male' as const, birth: { year: 1843 }, birthPlace: 'Bregenz' },
  { id: 'wife', treeId: 't1', firstName: 'Maria', lastName: 'Smith', maidenName: 'Escobar', sex: 'Female' as const, birth: { year: 1850 } },
  { id: 'kid', treeId: 't1', firstName: 'Otto', lastName: 'Smith', sex: 'Male' as const }
];
const rels = [
  { id: 'r1', treeId: 't1', type: 'Parent' as const, fromPersonId: 'gp', toPersonId: 'me' },
  { id: 'r2', treeId: 't1', type: 'Spouse' as const, fromPersonId: 'me', toPersonId: 'wife' },
  { id: 'r3', treeId: 't1', type: 'Parent' as const, fromPersonId: 'me', toPersonId: 'kid' }
];

function setup(fail = false) {
  const personsApi = { personsGetByTree: vi.fn(() => fail ? throwError(() => new HttpErrorResponse({ status: 500, error: { status: 500, title: 'x' } })) : of(persons)) };
  const relsApi = { relationshipsGetByTree: vi.fn(() => of(rels)) };
  const treesApi = { treesGetAll: vi.fn(() => of([{ id: 't1', name: 'Familie' }])) };
  TestBed.configureTestingModule({ providers: [TreeStore,
    { provide: PersonsApi, useValue: personsApi }, { provide: RelationshipsApi, useValue: relsApi }, { provide: TreesApi, useValue: treesApi },
    { provide: I18nService, useValue: { t: (k: string) => k } }] });
  return { store: TestBed.inject(TreeStore), personsApi };
}

describe('TreeStore', () => {
  it('loads tree, persons (sorted by birth then name) and relationships', () => {
    const { store } = setup();
    store.load('t1');
    expect(store.tree()?.name).toBe('Familie');
    expect(store.persons().map(p => p.id)).toEqual(['gp', 'me', 'wife', 'kid']);
    expect(store.relationships().length).toBe(3);
    expect(store.loading()).toBe(false);
  });

  it('filters by name, maiden name and birthplace, and sorts by name', () => {
    const { store } = setup();
    store.load('t1');
    store.setFilter('esco');
    expect(store.filteredPersons().map(p => p.id)).toEqual(['wife']);
    store.setFilter('breg');
    expect(store.filteredPersons().map(p => p.id)).toEqual(['me']);
    store.setFilter('');
    store.setSort('name');
    expect(store.filteredPersons().map(p => p.firstName)).toEqual(['Georg', 'Konrad', 'Maria', 'Otto']);
  });

  it('exposes selection and relatives', () => {
    const { store } = setup();
    store.load('t1');
    store.select('me');
    expect(store.selectedPerson()?.firstName).toBe('Konrad');
    const rel = store.relativesOf('me');
    expect(rel.parents.map(p => p.id)).toEqual(['gp']);
    expect(rel.spouses.map(p => p.id)).toEqual(['wife']);
    expect(rel.children.map(p => p.id)).toEqual(['kid']);
  });

  it('surfaces a load error', () => {
    const { store } = setup(true);
    store.load('t1');
    expect(store.error()).toBe('err.load');
    expect(store.loading()).toBe(false);
  });
});
```

- [ ] **Step 2: Store**

`tree.store.ts`:
```ts
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PersonDto, PersonsApi, RelationshipDto, RelationshipsApi, TreeDto, TreesApi } from '../../../core/api/generated';
import { I18nService } from '../../../core/i18n/i18n.service';
import { problemMessage } from '../../../core/api/problem-details';
import { LineageIndex, indexLineage, personSearchText } from './tree-graph.model';

export type PeopleSort = 'name' | 'birth';

const byBirth = (a: PersonDto, b: PersonDto) =>
  (a.birth?.year ?? 9999) - (b.birth?.year ?? 9999) || byName(a, b);
const byName = (a: PersonDto, b: PersonDto) =>
  `${a.lastName ?? ''} ${a.firstName ?? ''}`.localeCompare(`${b.lastName ?? ''} ${b.firstName ?? ''}`);

/** One source of truth for the tree view; provided on the `trees/:treeId` route. */
@Injectable()
export class TreeStore {
  private readonly personsApi = inject(PersonsApi);
  private readonly relsApi = inject(RelationshipsApi);
  private readonly treesApi = inject(TreesApi);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private treeId = '';

  private readonly _tree = signal<TreeDto | null>(null);
  private readonly _persons = signal<PersonDto[]>([]);
  private readonly _relationships = signal<RelationshipDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal('');
  private readonly _selectedId = signal<string | null>(null);
  private readonly _filter = signal('');
  private readonly _sort = signal<PeopleSort>('birth');

  readonly tree = this._tree.asReadonly();
  readonly persons = this._persons.asReadonly();
  readonly relationships = this._relationships.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selectedId = this._selectedId.asReadonly();
  readonly filter = this._filter.asReadonly();
  readonly sort = this._sort.asReadonly();

  readonly lineage = computed<LineageIndex>(() => indexLineage(this._relationships()));
  readonly filteredPersons = computed(() => {
    const q = this._filter().trim().toLowerCase();
    const list = q ? this._persons().filter(p => personSearchText(p).includes(q)) : [...this._persons()];
    return list.sort(this._sort() === 'name' ? byName : byBirth);
  });
  readonly selectedPerson = computed(() => { const id = this._selectedId(); return id ? this.personById(id) ?? null : null; });

  load(treeId: string) {
    this.treeId = treeId;
    this._loading.set(true);
    this._error.set('');
    forkJoin({
      trees: this.treesApi.treesGetAll().pipe(catchError(() => of([] as TreeDto[]))),
      persons: this.personsApi.personsGetByTree({ treeId }),
      rels: this.relsApi.relationshipsGetByTree({ treeId }).pipe(catchError(() => of([] as RelationshipDto[])))
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => {
        this._tree.set(r.trees.find(t => t.id === treeId) ?? null);
        this._persons.set([...r.persons].sort(byBirth));
        this._relationships.set(r.rels);
        this._loading.set(false);
      },
      error: e => { this._error.set(problemMessage(e, this.i18n.t('err.load'))); this._loading.set(false); }
    });
  }
  reload() { if (this.treeId) this.load(this.treeId); }

  select(id: string | null) { this._selectedId.set(id); }
  setFilter(text: string) { this._filter.set(text); }
  setSort(sort: PeopleSort) { this._sort.set(sort); }
  personById(id: string): PersonDto | undefined { return this._persons().find(p => p.id === id); }

  relativesOf(id: string) {
    const idx = this.lineage();
    const pick = (ids: Set<string> | undefined) => [...(ids ?? [])].map(x => this.personById(x)).filter((p): p is PersonDto => !!p);
    return { parents: pick(idx.parentsOf.get(id)), spouses: pick(idx.spousesOf.get(id)), children: pick(idx.childrenOf.get(id)) };
  }
}
```
`tree-graph.model.ts` currently imports `Person`, `Relationship` from `api-client.service`; Task 2 switches it to generated types, but `personSearchText(p: PersonDto)` must accept the generated type now: in this task change the model's imports to `import { PersonDto as Person, RelationshipDto as Relationship, RelationshipType } from '../../../core/api/generated';` and make `personSearchText` null-safe (`p.firstName ?? ''` etc.). The legacy `tree-view.component.ts`/`tree-graph.service.ts` keep compiling because the generated `PersonDto` is structurally compatible where they read `firstName`/`lastName` (they may need `?? ''` in two places; adjust minimally and list).

Routes: `{ path: 'trees/:treeId', canActivate: [authGuard], data: { fullBleed: true }, providers: [TreeStore], loadComponent: … }`.

- [ ] **Step 3: Run spec (4/4), model spec (26/26), suite, build; commit**

```bash
git add frontend/src/app/features/trees/tree-view/tree.store.ts frontend/src/app/features/trees/tree-view/tree.store.spec.ts frontend/src/app/features/trees/tree-view/tree-graph.model.ts frontend/src/app/app.routes.ts frontend/src/app/features/trees/tree-view/tree-view.component.ts frontend/src/app/features/trees/tree-view/tree-graph.service.ts
git commit -m "feat(tree): route-scoped TreeStore with filter/sort/selection; graph model on generated types"
```

---

### Task 2: SVG node renderer and graph service rework

**Files:**
- Create: `frontend/src/app/features/trees/tree-view/node-svg.ts` + `node-svg.spec.ts`
- Modify: `tree-graph.model.ts` (`buildElements` emits `image`, `imageCompact`, `w`, `h` per person node; drop `label` text), `tree-graph.model.spec.ts` (label tests → image tests)
- Modify: `tree-graph.service.ts` (tokens, SVG nodes, compact zoom, context hook, zoom limits, export bg)

**Interfaces:**
- `export interface NodeTheme { bg: string; border: string; text: string; muted: string; male: string; female: string; unknown: string; nameFont: string; textFont: string }`
- `readNodeTheme(): NodeTheme` reads the CSS custom properties from `document.documentElement` (fallback literals for tests).
- `renderNodeSvg(p: PersonDto, theme: NodeTheme): string` → `data:image/svg+xml;utf8,<encoded svg>` 180×72; `renderCompactNodeSvg(p, theme)` → 120×40.
- `buildElements(persons, rels, theme)` → nodes carry `data: { id, sex, search, image, imageCompact, avatarUrl }`.
- `TreeGraphService.build(container, persons, rels, callbacks)` where `GraphCallbacks { onSelect(id); onOpen(id); onContext(id, clientX, clientY) }`; `select(id)`, `fit()`, `zoomIn()`, `zoomOut()`, `toggleLayout()`, `resetLayout()`, `exportPng(name)`, `refreshTheme()` (rebuild stylesheet + node images), signals `layoutMode`, `loading`, `selectedId`, `searchTerm`, `hasCustomLayout`, `compact`.

- [ ] **Step 1: Renderer spec (failing)**

`node-svg.spec.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { renderCompactNodeSvg, renderNodeSvg, NodeTheme } from './node-svg';

const theme: NodeTheme = { bg: '#fff', border: '#ccc', text: '#111', muted: '#666', male: '#5b7a99', female: '#b5636f', unknown: '#999', nameFont: 'Fraunces Variable', textFont: 'Inter Variable' };
const decode = (uri: string) => decodeURIComponent(uri.replace('data:image/svg+xml;utf8,', ''));

describe('renderNodeSvg', () => {
  it('draws name, lifespan, initials and a sex stripe', () => {
    const svg = decode(renderNodeSvg({ firstName: 'Konrad', lastName: 'Smith', sex: 'Male', birth: { year: 1843 }, death: { year: 1909 } }, theme));
    expect(svg).toContain('width="180"');
    expect(svg).toContain('Konrad Smith');
    expect(svg).toContain('1843 – 1909');
    expect(svg).toContain('>KS<');
    expect(svg).toContain(theme.male);
  });
  it('escapes markup in names and uses the avatar when present', () => {
    const svg = decode(renderNodeSvg({ firstName: 'A<b>', lastName: '&Co', sex: 'Female', avatarUrl: '/u/x.jpg' }, theme));
    expect(svg).toContain('A&lt;b&gt; &amp;Co');
    expect(svg).toContain('href="/u/x.jpg"');
    expect(svg).not.toContain('<b>');
  });
  it('compact variant is 120x40 and shows surname only', () => {
    const svg = decode(renderCompactNodeSvg({ firstName: 'Konrad', lastName: 'Smith', sex: 'Male' }, theme));
    expect(svg).toContain('width="120"');
    expect(svg).toContain('>Smith<');
    expect(svg).not.toContain('Konrad');
  });
});
```

- [ ] **Step 2: Renderer**

`node-svg.ts`:
```ts
import { PersonDto } from '../../../core/api/generated';
import { initials, lifespan } from '../../../core/models/person-helpers';

export interface NodeTheme {
  bg: string; border: string; text: string; muted: string;
  male: string; female: string; unknown: string; nameFont: string; textFont: string;
}

export const NODE_W = 180; export const NODE_H = 72; export const COMPACT_W = 120; export const COMPACT_H = 40;

function cssVar(name: string, fallback: string): string {
  if (typeof getComputedStyle !== 'function') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Resolve the graph palette from the active theme's custom properties. */
export function readNodeTheme(): NodeTheme {
  return {
    bg: cssVar('--qs-graph-node-bg', '#fffaf5'), border: cssVar('--qs-graph-node-border', '#c9c2b8'),
    text: cssVar('--mat-sys-on-surface', '#1c1a17'), muted: cssVar('--mat-sys-on-surface-variant', '#5f5a53'),
    male: cssVar('--qs-sex-male', '#5b7a99'), female: cssVar('--qs-sex-female', '#b5636f'), unknown: cssVar('--qs-sex-unknown', '#8a8177'),
    nameFont: 'Fraunces Variable, Georgia, serif', textFont: 'Inter Variable, system-ui, sans-serif'
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hue = (p: PersonDto, t: NodeTheme) => (p.sex === 'Male' ? t.male : p.sex === 'Female' ? t.female : t.unknown);
const truncate = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s);
const toUri = (svg: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

function avatar(p: PersonDto, t: NodeTheme, cx: number, cy: number, r: number, font: number): string {
  if (p.avatarUrl) {
    return `<clipPath id="c"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><image href="${esc(p.avatarUrl)}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#c)"/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${hue(p, t)}"/><text x="${cx}" y="${cy + font * 0.36}" text-anchor="middle" font-family="${t.textFont}" font-size="${font}" font-weight="600" fill="#fff">${esc(initials({ firstName: p.firstName ?? '', lastName: p.lastName ?? '' }))}</text>`;
}

/** 180×72 card: stripe, avatar, name (display face), lifespan. */
export function renderNodeSvg(p: PersonDto, t: NodeTheme): string {
  const name = truncate(`${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(), 22);
  const span = lifespan({ firstName: '', lastName: '', birth: p.birth, death: p.death });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${NODE_W}" height="${NODE_H}" viewBox="0 0 ${NODE_W} ${NODE_H}">
<rect x="0.5" y="0.5" width="${NODE_W - 1}" height="${NODE_H - 1}" rx="12" fill="${t.bg}" stroke="${t.border}"/>
<rect x="0.5" y="0.5" width="4" height="${NODE_H - 1}" rx="2" fill="${hue(p, t)}"/>
${avatar(p, t, 30, 36, 18, 13)}
<text x="58" y="33" font-family="${t.nameFont}" font-size="14" font-weight="500" fill="${t.text}">${esc(name)}</text>
<text x="58" y="51" font-family="${t.textFont}" font-size="11" fill="${t.muted}">${esc(span)}</text>
</svg>`;
  return toUri(svg);
}

/** 120×40 compact variant for far-out zoom: avatar + surname. */
export function renderCompactNodeSvg(p: PersonDto, t: NodeTheme): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${COMPACT_W}" height="${COMPACT_H}" viewBox="0 0 ${COMPACT_W} ${COMPACT_H}">
<rect x="0.5" y="0.5" width="${COMPACT_W - 1}" height="${COMPACT_H - 1}" rx="10" fill="${t.bg}" stroke="${t.border}"/>
<rect x="0.5" y="0.5" width="4" height="${COMPACT_H - 1}" rx="2" fill="${hue(p, t)}"/>
${avatar(p, t, 22, 20, 12, 10)}
<text x="42" y="25" font-family="${t.nameFont}" font-size="13" font-weight="500" fill="${t.text}">${esc(truncate(p.lastName ?? '', 12))}</text>
</svg>`;
  return toUri(svg);
}
```
Note the `clipPath id="c"` is scoped per image (each node is its own SVG document), so ids do not collide.

- [ ] **Step 3: Model changes**

In `tree-graph.model.ts`: import `NodeTheme, renderNodeSvg, renderCompactNodeSvg` from `./node-svg`; change `buildElements(persons, rels, theme: NodeTheme)`; remove `personLabel`; person nodes become
```ts
  const personNodes: NodeDefinition[] = persons.map(p => ({
    data: { id: p.id ?? '', sex: p.sex ?? '', avatarUrl: p.avatarUrl ?? '', search: personSearchText(p), image: renderNodeSvg(p, theme), imageCompact: renderCompactNodeSvg(p, theme) }
  }));
```
Update `tree-graph.model.spec.ts`: pass a fixed `theme` to every `buildElements` call; replace the three `labels …` tests with `it('renders node images for full and compact variants', …)` asserting `node.data['image']` starts with `data:image/svg+xml` and contains the encoded name, and `imageCompact` contains the encoded surname.

- [ ] **Step 4: Service changes** (exact edits to `tree-graph.service.ts`)

1. Imports: `PersonDto as Person, RelationshipDto as Relationship` from generated; `readNodeTheme, NodeTheme, NODE_W, NODE_H, COMPACT_W, COMPACT_H` from `./node-svg`.
2. `GraphCallbacks` gains `onContext: (personId: string, clientX: number, clientY: number) => void`.
3. New signal `readonly compact = signal(false)`; `private theme: NodeTheme = readNodeTheme();`.
4. `build()`: `this.theme = readNodeTheme();` before `buildElements(persons, rels, this.theme)`; cytoscape options `minZoom: 0.2, maxZoom: 2.5`; add
```ts
    this.cy.on('cxttap', 'node', evt => {
      if (evt.target.data('coupleNode')) return;
      const { x, y } = evt.renderedPosition ?? { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      this.callbacks?.onContext(evt.target.id(), rect.left + x, rect.top + y);
    });
    this.cy.on('zoom', () => this.compact.set((this.cy?.zoom() ?? 1) < 0.45));
```
and after building: `this.compact.set(this.cy.zoom() < 0.45)`.
5. Theme effect: replace the `this.cy?.style(stylesheet(dark))` effect body with a call to `this.refreshTheme()` reading `this.theme.isDark()`; implement
```ts
  refreshTheme() {
    if (!this.cy) return;
    this.theme = readNodeTheme();
    const cy = this.cy;
    cy.batch(() => {
      cy.nodes('[!coupleNode]').forEach(n => {
        const p = this.personsById.get(n.id());
        if (p) { n.data('image', renderNodeSvg(p, this.theme)); n.data('imageCompact', renderCompactNodeSvg(p, this.theme)); }
      });
    });
    cy.style(this.stylesheet());
  }
```
with `private personsById = new Map<string, Person>()` filled in `build()`. Also an effect on `compact()` that calls `this.cy?.style(this.stylesheet())` (the stylesheet picks image/size by the flag).
6. `stylesheet()` becomes a method using `this.theme` and `this.compact()`; node style: `shape: 'roundrectangle', width: compact ? COMPACT_W : NODE_W, height: compact ? COMPACT_H : NODE_H, 'background-image': compact ? 'data(imageCompact)' : 'data(image)', 'background-fit': 'contain', 'background-clip': 'none', 'background-opacity': 0, 'border-width': 0, label: ''`; `node:selected`: `'border-width': 2, 'border-color': cssVar('--qs-graph-selected'), 'overlay-color': same, 'overlay-opacity': 0.12, 'overlay-padding': 6`; drop the `[sex]` and `[?avatarUrl]` rules; couple node `background-color: --qs-graph-marriage`, 8×8; marriage edge `line-color: --qs-graph-marriage`; descent edge `line-color: --qs-graph-descent`, `'taxi-turn': '-40px'`; adoptive `'line-style': 'dashed'`; `.dimmed { opacity: 0.15 }`; `.lineage` keeps a 2px border in `--qs-graph-selected` at 60% via `'border-opacity': 0.6`. Read token values with the same `cssVar` helper (export it from `node-svg.ts`).
7. `fit()` padding 40; `exportPng` background `cssVar('--mat-sys-surface', '#ffffff')`.
8. `select(id)` unchanged; add `neighborsOf` not needed (store has it).

- [ ] **Step 5: Run specs (renderer 3/3, model 26/26), suite, build; commit**

```bash
git add frontend/src/app/features/trees/tree-view
git commit -m "feat(graph): SVG card nodes from theme tokens, compact zoom variant, context-menu hook, token-driven stylesheet"
```

---

### Task 3: People list and selection panel components

**Files:**
- Create: `tree-people-list.component.ts` + spec, `tree-selection-panel.component.ts` + spec (both under `features/trees/tree-view/`)
- Modify: i18n, regenerate

**Interfaces:**
- `TreePeopleListComponent` (`qs-tree-people-list`): reads `TreeStore`; filter `mat-form-field` with clear button; sort `mat-button-toggle-group` (name/birth); `cdk-virtual-scroll-viewport` (itemSize 56) of rows (avatar/initials, `Last, First`, lifespan); row click → `store.select(id)` + output `picked` (so the handset sheet can close); double-click → output `open(id)`; active row styled; empty state text.
- `TreeSelectionPanelComponent` (`qs-tree-selection-panel`): input `person: PersonDto`; reads `TreeStore.relativesOf`; avatar, name (display face), maiden name, lifespan, birth/death place; Parents/Spouses/Children chips → `store.select(id)` + output `navigate(id)`; buttons "Open profile" (routerLink), "Edit" (routerLink), "Add relation" (output `addRelation(person)`), "Focus lineage" (already implied by selection), close (output `closed`).

- [ ] **Step 1: i18n**

Change values: `"tree.addPerson": "Add person"` / `"Person hinzufügen"`, `"tree.back": "Trees"` / `"Stammbäume"`, `"tree.import": "Import"` / `"Importieren"`, `"tree.search": "Search"` / `"Suchen"`, `"tree.addRel": "Add relationship"` / `"Beziehung hinzufügen"`.
Add (`en` / `de`):
```json
"tree.people": "People",
"tree.sort": "Sort",
"tree.sort.birth": "By birth year",
"tree.sort.name": "By name",
"tree.edit": "Edit",
"tree.ctx.addParent": "Add parent",
"tree.ctx.addChild": "Add child",
"tree.ctx.addSpouse": "Add spouse",
"tree.ctx.remove": "Delete person",
"tree.ctx.focus": "Focus lineage",
"tree.closePanel": "Close panel",
"tree.showPeople": "Show people",
"tree.deleted.toast": "Person deleted.",
"tree.parents": "Parents",
"tree.spouses": "Spouses",
"tree.children": "Children"
```
```json
"tree.people": "Personen",
"tree.sort": "Sortieren",
"tree.sort.birth": "Nach Geburtsjahr",
"tree.sort.name": "Nach Name",
"tree.edit": "Bearbeiten",
"tree.ctx.addParent": "Elternteil hinzufügen",
"tree.ctx.addChild": "Kind hinzufügen",
"tree.ctx.addSpouse": "Partner hinzufügen",
"tree.ctx.remove": "Person löschen",
"tree.ctx.focus": "Linie hervorheben",
"tree.closePanel": "Panel schließen",
"tree.showPeople": "Personen anzeigen",
"tree.deleted.toast": "Person gelöscht.",
"tree.parents": "Eltern",
"tree.spouses": "Partner",
"tree.children": "Kinder"
```

- [ ] **Step 2: Specs (failing)**

`tree-people-list.component.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { TreePeopleListComponent } from './tree-people-list.component';
import { TreeStore } from './tree.store';
import { I18nService } from '../../../core/i18n/i18n.service';

const people = [
  { id: 'a', firstName: 'Konrad', lastName: 'Smith', sex: 'Male' as const, birth: { year: 1843 } },
  { id: 'b', firstName: 'Maria', lastName: 'Escobar', sex: 'Female' as const }
];

function setup() {
  const store = { filteredPersons: signal(people), selectedId: signal<string | null>('a'), filter: signal(''), sort: signal('birth'), select: vi.fn(), setFilter: vi.fn(), setSort: vi.fn() };
  TestBed.configureTestingModule({ providers: [provideNoopAnimations(), { provide: TreeStore, useValue: store }, { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }] });
  const fixture = TestBed.createComponent(TreePeopleListComponent);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, store };
}

describe('TreePeopleListComponent', () => {
  it('renders rows with "Last, First" and marks the selected one', () => {
    const { fixture } = setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Smith, Konrad');
    expect(el.querySelector('[data-person-id="a"]')?.getAttribute('aria-selected')).toBe('true');
  });
  it('selects on click and emits open on double click', () => {
    const { cmp, store } = setup();
    const opened = vi.fn(); cmp.open.subscribe(opened);
    cmp.pick(people[1]); expect(store.select).toHaveBeenCalledWith('b');
    cmp.openPerson(people[1]); expect(opened).toHaveBeenCalledWith('b');
  });
  it('forwards filter and sort changes to the store', () => {
    const { cmp, store } = setup();
    cmp.filterCtrl.setValue('kon'); expect(store.setFilter).toHaveBeenCalledWith('kon');
    cmp.setSort('name'); expect(store.setSort).toHaveBeenCalledWith('name');
  });
});
```

`tree-selection-panel.component.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, expect, it, vi } from 'vitest';
import { TreeSelectionPanelComponent } from './tree-selection-panel.component';
import { TreeStore } from './tree.store';
import { I18nService } from '../../../core/i18n/i18n.service';

const me = { id: 'me', firstName: 'Konrad', lastName: 'Smith', sex: 'Male' as const, birth: { year: 1843, month: 11, day: 5 }, birthPlace: 'Bregenz', death: { year: 1909 } };
const wife = { id: 'wife', firstName: 'Maria', lastName: 'Smith', sex: 'Female' as const };

function setup() {
  const store = { relativesOf: vi.fn(() => ({ parents: [], spouses: [wife], children: [] })), select: vi.fn() };
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideNoopAnimations(), { provide: TreeStore, useValue: store }, { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }] });
  const fixture = TestBed.createComponent(TreeSelectionPanelComponent);
  fixture.componentRef.setInput('person', me);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, store };
}

describe('TreeSelectionPanelComponent', () => {
  it('shows identity, lifespan, places and relative chips', () => {
    const { fixture } = setup();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Konrad Smith');
    expect(text).toContain('1843 – 1909');
    expect(text).toContain('Bregenz');
    expect(text).toContain('Maria Smith');
  });
  it('selecting a relative chip selects it in the store and emits navigate', () => {
    const { cmp, store } = setup();
    const nav = vi.fn(); cmp.navigate.subscribe(nav);
    cmp.goTo(wife);
    expect(store.select).toHaveBeenCalledWith('wife');
    expect(nav).toHaveBeenCalledWith('wife');
  });
});
```

- [ ] **Step 3: Components**

`tree-people-list.component.ts`:
```ts
import { Component, inject, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime } from 'rxjs';
import { PersonDto } from '../../../core/api/generated';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { initials, lifespan, sexClass } from '../../../core/models/person-helpers';
import { PeopleSort, TreeStore } from './tree.store';

@Component({
  selector: 'qs-tree-people-list',
  imports: [ReactiveFormsModule, ScrollingModule, MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule, MatButtonToggleModule, MatTooltipModule, TranslatePipe],
  template: `
    <div class="qs-people">
      <div class="qs-people__tools">
        <mat-form-field class="qs-people__filter" subscriptSizing="dynamic">
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [formControl]="filterCtrl" [placeholder]="'tree.filter' | translate" [attr.aria-label]="'tree.filter' | translate">
          @if (filterCtrl.value) { <button matIconButton matSuffix type="button" (click)="filterCtrl.setValue('')" [attr.aria-label]="'cancel' | translate"><mat-icon>close</mat-icon></button> }
        </mat-form-field>
        <mat-button-toggle-group hideSingleSelectionIndicator [value]="store.sort()" (change)="setSort($event.value)" [attr.aria-label]="'tree.sort' | translate">
          <mat-button-toggle value="birth" [matTooltip]="'tree.sort.birth' | translate"><mat-icon>cake</mat-icon></mat-button-toggle>
          <mat-button-toggle value="name" [matTooltip]="'tree.sort.name' | translate"><mat-icon>sort_by_alpha</mat-icon></mat-button-toggle>
        </mat-button-toggle-group>
      </div>
      <cdk-virtual-scroll-viewport itemSize="56" class="qs-people__viewport" role="listbox" [attr.aria-label]="'tree.peopleList' | translate">
        <button *cdkVirtualFor="let p of store.filteredPersons(); trackBy: trackId" type="button" class="qs-people__row" role="option"
                [attr.data-person-id]="p.id" [attr.aria-selected]="store.selectedId() === p.id" [class.qs-people__row--active]="store.selectedId() === p.id"
                (click)="pick(p)" (dblclick)="openPerson(p)">
          @if (p.avatarUrl) { <img class="qs-people__avatar" [src]="p.avatarUrl" alt="" loading="lazy"> }
          @else { <span [class]="'qs-people__avatar qs-people__initials qs-sex-' + sexClass(p.sex)" aria-hidden="true">{{ initials({ firstName: p.firstName ?? '', lastName: p.lastName ?? '' }) }}</span> }
          <span class="qs-people__name">{{ p.lastName }}, {{ p.firstName }}</span>
          <span class="qs-muted qs-people__span">{{ lifespan({ firstName: '', lastName: '', birth: p.birth, death: p.death }) }}</span>
        </button>
        @if (!store.filteredPersons().length) { <p class="qs-muted qs-people__empty">{{ 'tree.noResults' | translate }}</p> }
      </cdk-virtual-scroll-viewport>
    </div>
  `,
  styles: [`
    :host, .qs-people { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .qs-people__tools { display: flex; align-items: center; gap: 8px; padding: 12px 12px 4px; }
    .qs-people__filter { flex: 1; }
    .qs-people__viewport { flex: 1; min-height: 0; }
    .qs-people__row { display: flex; align-items: center; gap: 10px; width: 100%; height: 56px; padding: 0 12px; border: 0; background: transparent; text-align: left; font: inherit; color: var(--mat-sys-on-surface); cursor: pointer; border-radius: var(--mat-sys-corner-small); }
    .qs-people__row:hover { background: var(--mat-sys-surface-container); }
    .qs-people__row--active { background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container); }
    .qs-people__avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex: 0 0 auto; }
    .qs-people__initials { display: grid; place-items: center; font-size: .75rem; font-weight: 600; color: #fff; }
    .qs-sex-male { background: var(--qs-sex-male); } .qs-sex-female { background: var(--qs-sex-female); } .qs-sex-unknown { background: var(--qs-sex-unknown); }
    .qs-people__name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .qs-people__span { font-size: .8rem; }
    .qs-people__empty { padding: 12px; }
  `]
})
export class TreePeopleListComponent {
  readonly store = inject(TreeStore);
  readonly open = output<string>();
  readonly picked = output<string>();
  readonly filterCtrl = new FormControl(this.store.filter(), { nonNullable: true });
  readonly initials = initials; readonly lifespan = lifespan; readonly sexClass = sexClass;
  private readonly filterValue = toSignal(this.filterCtrl.valueChanges.pipe(debounceTime(120)), { initialValue: '' });

  constructor() { this.filterCtrl.valueChanges.subscribe(v => this.store.setFilter(v)); }

  trackId = (_: number, p: PersonDto) => p.id ?? '';
  pick(p: PersonDto) { if (p.id) { this.store.select(p.id); this.picked.emit(p.id); } }
  openPerson(p: PersonDto) { if (p.id) this.open.emit(p.id); }
  setSort(v: string) { if (v === 'name' || v === 'birth') this.store.setSort(v as PeopleSort); }
}
```
(Remove the unused `filterValue`/`toSignal`/`debounceTime` if the store already debounces nothing — keep the immediate `valueChanges` forwarding; the graph dimming debounce lives in the view component.)

`tree-selection-panel.component.ts`:
```ts
import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { PersonDto } from '../../../core/api/generated';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { PartialDatePipe } from '../../../shared/pipes/partial-date.pipe';
import { fullName, initials, lifespan, sexClass } from '../../../core/models/person-helpers';
import { TreeStore } from './tree.store';

@Component({
  selector: 'qs-tree-selection-panel',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatChipsModule, TranslatePipe, PartialDatePipe],
  template: `
    <div class="qs-sel">
      <div class="qs-sel__head">
        @if (person().avatarUrl) { <img class="qs-sel__avatar" [src]="person().avatarUrl" alt=""> }
        @else { <span [class]="'qs-sel__avatar qs-sel__initials qs-sex-' + sexClass(person().sex)" aria-hidden="true">{{ initials({ firstName: person().firstName ?? '', lastName: person().lastName ?? '' }) }}</span> }
        <div class="qs-sel__id">
          <div class="qs-display qs-sel__name">{{ name() }}</div>
          @if (person().maidenName) { <div class="qs-muted">{{ 'pd.maiden' | translate }} {{ person().maidenName }}</div> }
          @if (span()) { <div class="qs-muted">{{ span() }}</div> }
        </div>
        <button matIconButton (click)="closed.emit()" [attr.aria-label]="'tree.closePanel' | translate"><mat-icon>close</mat-icon></button>
      </div>
      <dl class="qs-sel__dl">
        @if (person().birth?.year) { <dt>{{ 'pd.birth' | translate }}</dt><dd>{{ person().birth | partialDate }}@if (person().birthPlace) { · {{ person().birthPlace }} }</dd> }
        @if (person().death?.year) { <dt>{{ 'pd.death' | translate }}</dt><dd>{{ person().death | partialDate }}@if (person().deathPlace) { · {{ person().deathPlace }} }</dd> }
      </dl>
      @for (g of groups(); track g.key) {
        @if (g.items.length) {
          <p class="qs-sel__label">{{ g.key | translate }}</p>
          <mat-chip-set>@for (r of g.items; track r.id) { <mat-chip (click)="goTo(r)" (keydown.enter)="goTo(r)" tabindex="0" role="button">{{ fullName({ firstName: r.firstName ?? '', lastName: r.lastName ?? '' }) }}</mat-chip> }</mat-chip-set>
        }
      }
      <div class="qs-sel__actions">
        <a matButton="filled" [routerLink]="['/persons', person().id]">{{ 'tree.openProfile' | translate }}</a>
        <a matButton="outlined" [routerLink]="['/persons', person().id, 'edit']">{{ 'tree.edit' | translate }}</a>
        <button matButton (click)="addRelation.emit(person())"><mat-icon>person_add</mat-icon>{{ 'tree.addRel' | translate }}</button>
      </div>
    </div>
  `,
  styles: [`
    .qs-sel { display: flex; flex-direction: column; gap: 10px; padding: 16px; }
    .qs-sel__head { display: flex; align-items: center; gap: 12px; }
    .qs-sel__avatar { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; flex: 0 0 auto; }
    .qs-sel__initials { display: grid; place-items: center; font-weight: 600; color: #fff; }
    .qs-sex-male { background: var(--qs-sex-male); } .qs-sex-female { background: var(--qs-sex-female); } .qs-sex-unknown { background: var(--qs-sex-unknown); }
    .qs-sel__id { flex: 1; min-width: 0; }
    .qs-sel__name { font-size: 1.25rem; }
    .qs-sel__dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 10px; margin: 0; }
    .qs-sel__dl dt { color: var(--mat-sys-on-surface-variant); }
    .qs-sel__dl dd { margin: 0; }
    .qs-sel__label { margin: 4px 0 2px; font-size: .75rem; letter-spacing: .06em; text-transform: uppercase; color: var(--mat-sys-on-surface-variant); }
    .qs-sel__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
  `]
})
export class TreeSelectionPanelComponent {
  readonly person = input.required<PersonDto>();
  readonly closed = output<void>();
  readonly navigate = output<string>();
  readonly addRelation = output<PersonDto>();
  private readonly store = inject(TreeStore);
  readonly initials = initials; readonly fullName = fullName; readonly sexClass = sexClass;

  readonly name = computed(() => fullName({ firstName: this.person().firstName ?? '', lastName: this.person().lastName ?? '' }));
  readonly span = computed(() => lifespan({ firstName: '', lastName: '', birth: this.person().birth, death: this.person().death }));
  readonly groups = computed(() => {
    const r = this.store.relativesOf(this.person().id ?? '');
    return [{ key: 'tree.parents' as const, items: r.parents }, { key: 'tree.spouses' as const, items: r.spouses }, { key: 'tree.children' as const, items: r.children }];
  });

  goTo(p: PersonDto) { if (p.id) { this.store.select(p.id); this.navigate.emit(p.id); } }
}
```

- [ ] **Step 4: Run specs (3/3, 2/2), suite, build; commit**

```bash
git add frontend/src/app/features/trees/tree-view frontend/public/assets/i18n frontend/src/app/core/i18n/translation-keys.ts
git commit -m "feat(tree): people list (virtual scroll, filter, sort) and selection panel components"
```

---

### Task 4: Tree view composition

**Files:**
- Modify: `tree-view.component.ts` (rewrite) + create spec
- Delete: `frontend/src/app/features/trees/tree-search.component.ts`
- Modify: `frontend/src/app/app.routes.ts` (search redirect)

**Interfaces:**
- Layout per spec §3: desktop `mat-sidenav-container` with left sidenav (side, 300px, toggle button in header) + canvas + right panel (`qs-tree-selection-panel`, 320px, shown when selected); tablet: sidenav `over`; handset: no sidenav, FAB opens the people list in a `MatBottomSheet` (component `TreePeopleListComponent` wrapped), selection opens the panel in a `MatBottomSheet` (`TreeSelectionPanelComponent` wrapped) — pass the store via the bottom sheet's injector (`injector: this.injector`).
- Header (inside the full-bleed page): back link crumbs handled by `BreadcrumbService` (`Trees › <name>`), `h1` tree name, actions: sidenav toggle (icon), Import (link), Add person (filled). Canvas overlay states: loading skeleton (six faint rounded rects), empty (`qs-empty` with Add person + Import), error (message + Retry).
- Mini-FAB cluster (top-right of the canvas): fit, zoom in, zoom out, layout toggle (icon `account_tree` / `auto_awesome_motion`), reset layout (only when `hasCustomLayout`), export PNG.
- Context menu: hidden `mat-menu` trigger positioned at (clientX, clientY) on `onContext`; items: Open, Edit, Add parent / child / spouse (opens `RelationshipDialogComponent` with `anchor` and `presetType`), Focus lineage (`store.select`), Delete person (confirm → `personsDelete` → toast → `store.reload()` + rebuild graph).
- Keyboard on the canvas host (`tabindex=0`): `+`/`-`/`0`, `Escape` clears, arrows move selection among relatives (Up → first parent, Down → first child, Left/Right → spouses), `Enter` opens profile.
- Query param `q` (route input `q`) seeds `store.setFilter(q)` once.
- Graph rebuild: `effect` on `store.persons()`/`store.relationships()` → `graph.build(...)` when non-empty; `store.selectedId` → `graph.select`; filter → `graph.searchTerm` (debounced 150ms); `graph.selectedId` changes (canvas tap/clear) → `store.select`.

- [ ] **Step 1: Spec (failing)**

`tree-view.component.spec.ts` (focus on wiring; the graph service is mocked):
```ts
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TreeViewComponent } from './tree-view.component';
import { TreeStore } from './tree.store';
import { TreeGraphService } from './tree-graph.service';
import { PersonsApi } from '../../../core/api/generated';
import { LayoutService } from '../../../core/ui/layout.service';
import { ConfirmDialogService } from '../../../core/ui/confirm-dialog.service';
import { ToastService } from '../../../core/ui/toast.service';
import { BreadcrumbService } from '../../../core/ui/breadcrumb.service';
import { I18nService } from '../../../core/i18n/i18n.service';

const people = [{ id: 'a', treeId: 't1', firstName: 'Konrad', lastName: 'Smith', sex: 'Male' as const }];

function setup(handset = false, withPeople = true) {
  const store = {
    load: vi.fn(), reload: vi.fn(), tree: signal({ id: 't1', name: 'Familie' }), persons: signal(withPeople ? people : []), relationships: signal([]),
    loading: signal(false), error: signal(''), selectedId: signal<string | null>(null), filter: signal(''), sort: signal('birth'),
    filteredPersons: signal(withPeople ? people : []), selectedPerson: signal(null), select: vi.fn(), setFilter: vi.fn(), setSort: vi.fn(),
    personById: vi.fn(() => people[0]), relativesOf: vi.fn(() => ({ parents: [], spouses: [], children: [] }))
  };
  const graph = { build: vi.fn(async () => undefined), select: vi.fn(), fit: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), toggleLayout: vi.fn(), resetLayout: vi.fn(), exportPng: vi.fn(),
    layoutMode: signal('tree'), loading: signal(false), selectedId: signal<string | null>(null), searchTerm: signal(''), hasCustomLayout: signal(false), compact: signal(false), destroy: vi.fn() };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(undefined) })) };
  const sheet = { open: vi.fn(() => ({ afterDismissed: () => of(undefined), dismiss: vi.fn() })) };
  const persons = { personsDelete: vi.fn(() => of(undefined)) };
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideNoopAnimations(),
    { provide: PersonsApi, useValue: persons }, { provide: LayoutService, useValue: { handset: () => handset, tablet: () => false, desktop: () => !handset } },
    { provide: MatDialog, useValue: dialog }, { provide: MatBottomSheet, useValue: sheet },
    { provide: ConfirmDialogService, useValue: { confirm: vi.fn(async () => true) } }, { provide: ToastService, useValue: { success: vi.fn(), errorFrom: vi.fn(), error: vi.fn(), info: vi.fn() } },
    { provide: BreadcrumbService, useValue: { set: vi.fn() } }, { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }] });
  TestBed.overrideComponent(TreeViewComponent, { set: { providers: [{ provide: TreeStore, useValue: store }, { provide: TreeGraphService, useValue: graph }] } });
  const fixture = TestBed.createComponent(TreeViewComponent);
  fixture.componentRef.setInput('treeId', 't1');
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, store, graph, dialog, sheet, persons };
}

describe('TreeViewComponent', () => {
  it('loads the store for the route and builds the graph when people exist', async () => {
    const { store, graph, fixture } = setup();
    expect(store.load).toHaveBeenCalledWith('t1');
    await fixture.whenStable();
    expect(graph.build).toHaveBeenCalled();
  });
  it('shows the empty state without building', async () => {
    const { graph, fixture } = setup(false, false);
    await fixture.whenStable();
    expect(graph.build).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('tree.emptyTitle');
  });
  it('opens the relationship dialog anchored on the context person', async () => {
    const { cmp, dialog } = setup();
    await cmp.addRelationFor(people[0], 'Parent');
    expect(dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: expect.objectContaining({ treeId: 't1', anchor: people[0], presetType: 'Parent' }) }));
  });
  it('on handset, selecting a node opens the bottom sheet instead of the side panel', () => {
    const { cmp, sheet, store } = setup(true);
    cmp.onSelected('a');
    expect(store.select).toHaveBeenCalledWith('a');
    expect(sheet.open).toHaveBeenCalled();
  });
  it('deletes the context person after confirmation and reloads', async () => {
    const { cmp, persons, store } = setup();
    await cmp.deletePerson(people[0]);
    expect(persons.personsDelete).toHaveBeenCalledWith({ id: 'a' });
    expect(store.reload).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Component**

`tree-view.component.ts` — write it in full; the outline below is the required structure and every named member must exist:
```ts
@Component({
  selector: 'qs-tree-view',
  providers: [TreeGraphService],
  imports: [RouterLink, MatSidenavModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, MatProgressBarModule,
            TranslatePipe, TreePeopleListComponent, TreeSelectionPanelComponent],
  template: `
    <div class="qs-tv">
      <header class="qs-tv__header">
        @if (!layout.handset()) {
          <button matIconButton (click)="sidenavOpen.set(!sidenavOpen())" [attr.aria-label]="'tree.showPeople' | translate"><mat-icon>{{ sidenavOpen() ? 'left_panel_close' : 'left_panel_open' }}</mat-icon></button>
        }
        <h1 tabindex="-1" class="qs-display qs-tv__title">{{ store.tree()?.name ?? '…' }}</h1>
        <span class="qs-tv__spacer"></span>
        <a matButton [routerLink]="['/trees', treeId(), 'import']"><mat-icon>upload_file</mat-icon><span class="qs-tv__label">{{ 'tree.import' | translate }}</span></a>
        <a matButton="filled" [routerLink]="['/trees', treeId(), 'persons', 'new']"><mat-icon>person_add</mat-icon><span class="qs-tv__label">{{ 'tree.addPerson' | translate }}</span></a>
      </header>

      <mat-sidenav-container class="qs-tv__body" [hasBackdrop]="layout.tablet()">
        @if (!layout.handset()) {
          <mat-sidenav [mode]="layout.tablet() ? 'over' : 'side'" [opened]="sidenavOpen()" (closedStart)="sidenavOpen.set(false)" class="qs-tv__people">
            <qs-tree-people-list (open)="open($event)" (picked)="onSelected($event)" />
          </mat-sidenav>
        }
        <mat-sidenav-content class="qs-tv__content">
          <div class="qs-tv__canvas-wrap">
            <div #cyHost class="qs-tv__canvas" tabindex="0" role="application" [attr.aria-label]="'tree.graphLabel' | translate" (keydown)="onKey($event)"></div>
            <!-- overlays: error / loading skeleton / empty -->
            <!-- mini-fab cluster -->
            <!-- hidden context menu trigger -->
            @if (layout.handset()) { <button matFab class="qs-tv__fab" (click)="openPeopleSheet()" [attr.aria-label]="'tree.showPeople' | translate"><mat-icon>group</mat-icon></button> }
          </div>
          @if (!layout.handset() && store.selectedPerson(); as p) {
            <aside class="qs-tv__panel"><qs-tree-selection-panel [person]="p" (closed)="onSelected(null)" (navigate)="onSelected($event)" (addRelation)="addRelationFor($event)" /></aside>
          }
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `
})
export class TreeViewComponent implements OnInit {
  readonly treeId = input.required<string>();
  readonly q = input<string>();               // ?q= seeds the filter
  readonly store = inject(TreeStore); readonly graph = inject(TreeGraphService); readonly layout = inject(LayoutService);
  readonly sidenavOpen = signal(true);
  ngOnInit(): void;                            // breadcrumbs, store.load(treeId), seed filter from q
  onSelected(id: string | null): void;         // store.select + graph.select; handset → open selection bottom sheet
  open(id: string): void;                      // router.navigate(['/persons', id])
  openPeopleSheet(): void;                     // MatBottomSheet with TreePeopleListComponent; dismiss on picked
  onContext(id: string, x: number, y: number): void;   // position + open mat-menu
  addRelationFor(person: PersonDto, presetType?: UiRelType): Promise<void>;  // RelationshipDialogComponent with anchor → toast + store.reload()
  addRelationFree(): Promise<void>;            // dialog without anchor (from header overflow or empty selection)
  deletePerson(person: PersonDto): Promise<void>;
  onKey(e: KeyboardEvent): void;
  exportPng(): void;
}
```
Graph wiring in the constructor:
```ts
    effect(() => {
      const persons = this.store.persons(); const rels = this.store.relationships();
      const host = this.cyHost()?.nativeElement;
      if (!host || !persons.length) { this.graph.loading.set(false); return; }
      void this.graph.build(host, persons, rels, {
        onSelect: id => this.onSelected(id), onOpen: id => this.open(id), onContext: (id, x, y) => this.onContext(id, x, y)
      }).then(() => { const sel = this.store.selectedId(); if (sel) this.graph.select(sel); });
    });
    effect(() => { const id = this.graph.selectedId(); if (id !== this.store.selectedId()) this.store.select(id); });
    this.filter$.pipe(debounceTime(150), takeUntilDestroyed()).subscribe(t => this.graph.searchTerm.set(t));
    effect(() => this.filter$.next(this.store.filter()));
```
Bottom sheets: `this.sheet.open(TreePeopleSheetComponent, { injector: this.injector, panelClass: 'qs-sheet' })` where `TreePeopleSheetComponent`/`TreeSelectionSheetComponent` are two tiny wrapper components declared in the same file that render the list/panel and call `MatBottomSheetRef.dismiss()` on `picked`/`closed`/`navigate`. Context menu: a `<div class="qs-tv__ctx" [style.left.px]="ctx().x" [style.top.px]="ctx().y" [matMenuTriggerFor]="ctxMenu"></div>` positioned absolutely inside the canvas wrap; `onContext` sets `ctx` and calls `this.ctxTrigger().openMenu()` via `viewChild(MatMenuTrigger)`.
Overlays and mini-FAB cluster use `qs-empty`, `matMiniFab`, tooltips with the existing `tree.fit`, `tree.zoomIn`, `tree.zoomOut`, `tree.layoutToggle`, `tree.resetLayout`, `tree.export` keys. Styles: full-bleed `.qs-tv { height: calc(100dvh - var(--qs-toolbar-h)); display: flex; flex-direction: column; }`, canvas `flex: 1`, panel `width: 320px; border-left: 1px solid var(--mat-sys-outline-variant); overflow: auto`, people sidenav `width: 300px`, FAB bottom-right 16px, ctx trigger `position: absolute; width: 0; height: 0`.

Relationship dialog fix (carry-over from the P1c-A review): in `features/persons/relationship-dialog.component.ts`, when there is no anchor and the "from" pick is missing, set `{ required: true }` on `form.controls.from` (not on `person`) and add a `<mat-error>{{ form.controls.from.errors | formErrors }}</mat-error>` to the from field; extend `relationship-dialog.component.spec.ts` with a no-anchor case asserting the error lands on `from` and that a full from/to pick creates `toApiRelationship(type, fromId, toId)`.

Routes: replace the search route with
```ts
  { path: 'trees/:treeId/search', redirectTo: ({ params }) => `/trees/${params['treeId']}` },
```
and delete `tree-search.component.ts`. Remove the `tree.search` header button (the filter replaces it).

- [ ] **Step 3: Run spec (5/5), suite, build; visual check; commit**

Visual: 1400 (sidenav + canvas + panel after clicking a node), 400 (FAB → sheet, node tap → sheet), light + dark; right-click a node → context menu; Add parent → dialog; check node cards are readable at fit zoom for the 42-person demo tree (screenshot); compact variant appears when zooming out. Zero console errors.
```bash
git add frontend/src/app
git commit -m "feat(tree): Material tree view with sidenav people list, selection panel/bottom sheet, context menu, relationship dialog; search route redirects"
```

---

### Task 5: Lint, gates, visual verification

- [ ] `ng lint` → zero errors anywhere except `core/api/api-client.service.ts` consumers that no longer exist (expect zero errors overall; if `api-client.service.ts` itself has lint errors, leave it for P1e).
- [ ] `grep -rn "api-client.service" frontend/src/app --include=*.ts` → only `core/api/api-client.service.ts` itself and `core/i18n`? (no; P1a repointed it) → expected: nothing outside the file itself.
- [ ] Build: `Initial total` reported; Cytoscape must still be a lazy chunk (`grep -c cytoscape dist/frontend/browser/main-*.js` → 0).
- [ ] Screenshots to `scratchpad/shots/p1d/`; nothing stray in the repo.

## Next plan

P1e: delete `ApiClient`, `_legacy.scss`, remaining legacy CSS classes, `ConfirmDialogComponent` `ngModel`, unused i18n keys, `tree.emptyImport` decision; grep gates; Lighthouse; bundle budget (lazy-load Material table/sort only where used, verify `Initial total` ≤ 600 kB or raise the budget with justification); final screenshots at both widths and themes for every screen.
