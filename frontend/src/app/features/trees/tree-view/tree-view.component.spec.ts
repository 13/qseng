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
