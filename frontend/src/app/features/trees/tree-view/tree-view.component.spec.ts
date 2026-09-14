import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TreeViewComponent } from './tree-view.component';
import { TreeStore } from './tree.store';
import { TreeGraphService } from './tree-graph.service';
import { PersonDto, PersonsApi, RelationshipsApi, TreesApi } from '../../../core/api/generated';
import { LayoutService } from '../../../core/ui/layout.service';
import { ConfirmDialogService } from '../../../core/ui/confirm-dialog.service';
import { ToastService } from '../../../core/ui/toast.service';
import { BreadcrumbService } from '../../../core/ui/breadcrumb.service';
import { I18nService } from '../../../core/i18n/i18n.service';

const people = [{ id: 'a', treeId: 't1', firstName: 'Konrad', lastName: 'Smith', sex: 'Male' as const }];

function setup(handset = false, withPeople = true) {
  const selectedId = signal<string | null>(null);
  const store = {
    load: vi.fn(), reload: vi.fn(), tree: signal({ id: 't1', name: 'Familie' }), persons: signal(withPeople ? people : []), relationships: signal([]),
    loading: signal(false), error: signal(''), selectedId, filter: signal(''), sort: signal('birth'),
    filteredPersons: signal(withPeople ? people : []), selectedPerson: signal(null),
    // Wired to the signal (not a bare spy) so tests can tell a real revert from a no-op call.
    select: vi.fn((id: string | null) => selectedId.set(id)), setFilter: vi.fn(), setSort: vi.fn(),
    personById: vi.fn(() => people[0]),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- id kept so tests can reassign relativesOf to an id-aware mock
    relativesOf: vi.fn((id: string): { parents: PersonDto[]; spouses: PersonDto[]; children: PersonDto[] } => ({ parents: [], spouses: [], children: [] }))
  };
  const graph = { build: vi.fn(async () => undefined), select: vi.fn(), fit: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), toggleLayout: vi.fn(), resetLayout: vi.fn(), exportPng: vi.fn(),
    layoutMode: signal('tree'), loading: signal(false), selectedId: signal<string | null>(null), searchTerm: signal(''), hasCustomLayout: signal(false), compact: signal(false), destroy: vi.fn() };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(undefined) })) };
  const sheet = { open: vi.fn(() => ({ afterDismissed: () => of(undefined), dismiss: vi.fn() })) };
  const persons = { personsDelete: vi.fn(() => of(undefined)), personsRestore: vi.fn(() => of(undefined)) };
  const toast = { success: vi.fn(), errorFrom: vi.fn(), error: vi.fn(), info: vi.fn(), undoable: vi.fn() };
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideNoopAnimations(),
    { provide: PersonsApi, useValue: persons }, { provide: LayoutService, useValue: { handset: () => handset, tablet: () => false, desktop: () => !handset } },
    { provide: MatDialog, useValue: dialog }, { provide: MatBottomSheet, useValue: sheet },
    { provide: ConfirmDialogService, useValue: { confirm: vi.fn(async () => true) } }, { provide: ToastService, useValue: toast },
    { provide: BreadcrumbService, useValue: { set: vi.fn() } }, { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }] });
  TestBed.overrideComponent(TreeViewComponent, { set: { providers: [{ provide: TreeStore, useValue: store }, { provide: TreeGraphService, useValue: graph }] } });
  const fixture = TestBed.createComponent(TreeViewComponent);
  fixture.componentRef.setInput('treeId', 't1');
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, store, graph, dialog, sheet, persons, toast };
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
  it('when the dialog creates a new person, reloads, selects it and toasts an "Open" action', async () => {
    const { cmp, dialog, store, toast } = setup();
    dialog.open.mockReturnValueOnce({ afterClosed: () => of({ relationship: { id: 'r9', type: 'Parent' }, created: { id: 'n1', firstName: 'Anna', lastName: 'Ray' } }) } as unknown as ReturnType<typeof dialog.open>);
    await cmp.addRelationFor(people[0], 'Child');
    expect(store.reload).toHaveBeenCalled();
    expect(store.select).toHaveBeenCalledWith('n1');
    expect(toast.success).toHaveBeenCalledWith('rel.added.child', expect.objectContaining({ action: 'rel.open', onAction: expect.any(Function) }));
  });
  it('on handset, selecting a node opens the bottom sheet instead of the side panel', () => {
    const { cmp, sheet, store } = setup(true);
    cmp.onSelected('a');
    expect(store.select).toHaveBeenCalledWith('a');
    expect(sheet.open).toHaveBeenCalled();
  });
  it('deletes the context person after confirmation, reloads, and offers an undo toast', async () => {
    const { cmp, persons, store, toast } = setup();
    await cmp.deletePerson(people[0]);
    expect(persons.personsDelete).toHaveBeenCalledWith({ id: 'a' });
    expect(store.reload).toHaveBeenCalledTimes(1);
    expect(toast.undoable).toHaveBeenCalledWith('tree.deleted.undo', expect.any(Function));
  });

  it('restores the person, reloads and re-selects it when undo is invoked', async () => {
    const { cmp, persons, store, toast } = setup();
    await cmp.deletePerson(people[0]);
    const onUndo = toast.undoable.mock.calls[0][1];
    await onUndo();
    expect(persons.personsRestore).toHaveBeenCalledWith({ id: 'a' });
    expect(store.reload).toHaveBeenCalledTimes(2);
    expect(store.select).toHaveBeenCalledWith('a');
  });

  it('reloads the store when the route treeId changes', () => {
    const { fixture, store } = setup();
    expect(store.load).toHaveBeenCalledWith('t1');
    fixture.componentRef.setInput('treeId', 't2');
    fixture.detectChanges();
    expect(store.load).toHaveBeenCalledWith('t2');
    expect(store.load).toHaveBeenCalledTimes(2);
  });

  it('a store-driven selection is not reverted by the graph→store sync effect', () => {
    const { store, fixture } = setup();
    // Select via the store directly, as the sidebar list / "focus lineage" do —
    // the graph mock's selectedId is left at null throughout. The buggy effect
    // read store.selectedId() as part of its own condition, so it re-ran on
    // this write and wrote the graph's stale null straight back.
    store.select('a');
    fixture.detectChanges();
    expect(store.selectedId()).toBe('a');
  });

  it('"focus lineage" in the context menu selects in both store and graph', () => {
    const { cmp, store, graph } = setup();
    cmp.onSelected('a');
    expect(store.select).toHaveBeenCalledWith('a');
    expect(graph.select).toHaveBeenCalledWith('a');
  });

  it('ArrowRight cycles the ring a→s1→s2→a (anchor included) for a person with two spouses', () => {
    const { cmp, store } = setup();
    const personA = people[0];
    const s1 = { id: 's1', treeId: 't1', firstName: 'Bea', lastName: 'Smith', sex: 'Female' as const };
    const s2 = { id: 's2', treeId: 't1', firstName: 'Cleo', lastName: 'Smith', sex: 'Female' as const };
    // Faithful to the real TreeStore.indexLineage, which is symmetric per edge: s1 and s2
    // each have personA in their spouses (the a–s1 and a–s2 edges) but not each other,
    // since there is no s1–s2 edge.
    store.relativesOf = vi.fn((id: string) => ({ parents: [], children: [], spouses: id === 'a' ? [s1, s2] : (id === 's1' || id === 's2') ? [personA] : [] }));
    store.select('a');

    cmp.onKey({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as KeyboardEvent);
    expect(store.selectedId()).toBe('s1');

    cmp.onKey({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as KeyboardEvent);
    expect(store.selectedId()).toBe('s2');

    cmp.onKey({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as KeyboardEvent);
    expect(store.selectedId()).toBe('a');
  });

  it('ArrowLeft from the anchor wraps to the last spouse', () => {
    const { cmp, store } = setup();
    const personA = people[0];
    const s1 = { id: 's1', treeId: 't1', firstName: 'Bea', lastName: 'Smith', sex: 'Female' as const };
    const s2 = { id: 's2', treeId: 't1', firstName: 'Cleo', lastName: 'Smith', sex: 'Female' as const };
    store.relativesOf = vi.fn((id: string) => ({ parents: [], children: [], spouses: id === 'a' ? [s1, s2] : (id === 's1' || id === 's2') ? [personA] : [] }));
    store.select('a');

    cmp.onKey({ key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as KeyboardEvent);
    expect(store.selectedId()).toBe('s2');
  });

  it('ArrowRight twice toggles a monogamous couple a/s1 back to the anchor', () => {
    const { cmp, store } = setup();
    const personA = people[0];
    const s1 = { id: 's1', treeId: 't1', firstName: 'Bea', lastName: 'Smith', sex: 'Female' as const };
    store.relativesOf = vi.fn((id: string) => ({ parents: [], children: [], spouses: id === 'a' ? [s1] : id === 's1' ? [personA] : [] }));
    store.select('a');

    cmp.onKey({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as KeyboardEvent);
    expect(store.selectedId()).toBe('s1');

    cmp.onKey({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as KeyboardEvent);
    expect(store.selectedId()).toBe('a');
  });

  // Regression: the seeding effect used to run in ngOnInit, before the constructor's
  // `load()` effect had a chance to fire — and load() resets the filter on a treeId
  // change — so a `?q=` deep link was wiped out. Uses the real TreeStore (rather than
  // the mocked one above) so `load()`'s filter reset actually happens.
  it('seeds the filter from ?q after the store load, with the real TreeStore', async () => {
    const personsApi = { personsGetByTree: vi.fn(() => of(people)) };
    const relsApi = { relationshipsGetByTree: vi.fn(() => of([])) };
    const treesApi = { treesGetAll: vi.fn(() => of([{ id: 't1', name: 'Familie' }])) };
    const graph = { build: vi.fn(async () => undefined), select: vi.fn(), fit: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), toggleLayout: vi.fn(), resetLayout: vi.fn(), exportPng: vi.fn(),
      layoutMode: signal('tree'), loading: signal(false), selectedId: signal<string | null>(null), searchTerm: signal(''), hasCustomLayout: signal(false), compact: signal(false), destroy: vi.fn() };
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideNoopAnimations(),
      { provide: PersonsApi, useValue: personsApi }, { provide: RelationshipsApi, useValue: relsApi }, { provide: TreesApi, useValue: treesApi },
      { provide: LayoutService, useValue: { handset: () => false, tablet: () => false, desktop: () => true } },
      { provide: MatDialog, useValue: { open: vi.fn() } }, { provide: MatBottomSheet, useValue: { open: vi.fn() } },
      { provide: ConfirmDialogService, useValue: { confirm: vi.fn(async () => true) } }, { provide: ToastService, useValue: { success: vi.fn(), errorFrom: vi.fn(), error: vi.fn(), info: vi.fn() } },
      { provide: BreadcrumbService, useValue: { set: vi.fn() } }, { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }] });
    TestBed.overrideComponent(TreeViewComponent, { set: { providers: [TreeStore, { provide: TreeGraphService, useValue: graph }] } });
    const fixture = TestBed.createComponent(TreeViewComponent);
    fixture.componentRef.setInput('treeId', 't1');
    fixture.componentRef.setInput('q', 'konrad');
    fixture.detectChanges();
    await fixture.whenStable();
    const store = fixture.debugElement.injector.get(TreeStore);
    expect(store.filter()).toBe('konrad');
  });
});
