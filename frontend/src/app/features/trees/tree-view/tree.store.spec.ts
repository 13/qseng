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

  it('clears a stale selection when a reload no longer contains that person', () => {
    const { store, personsApi } = setup();
    store.load('t1');
    store.select('kid');
    expect(store.selectedId()).toBe('kid');

    personsApi.personsGetByTree.mockReturnValue(of(persons.filter(p => p.id !== 'kid')));
    store.load('t1');
    expect(store.selectedId()).toBeNull();
  });
});
