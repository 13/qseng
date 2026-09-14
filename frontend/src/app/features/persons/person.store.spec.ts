import { TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it, vi } from 'vitest';
import { PersonStore } from './person.store';
import { MediaApi, PersonsApi, TimelineApi, TreesApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { ToastService } from '../../core/ui/toast.service';

const person = { id: 'p1', treeId: 't1', firstName: 'Konrad', lastName: 'Smith', sex: 'Male' as const, avatarUrl: null };
const personB = { id: 'p2', treeId: 't1', firstName: 'Maria', lastName: 'Smith', sex: 'Female' as const, avatarUrl: null };

function setup(fail = false, personsGetByIdImpl?: (params: { id: string }) => unknown) {
  const persons = {
    personsGetById: vi.fn(personsGetByIdImpl ?? (() => fail ? throwError(() => new HttpErrorResponse({ status: 404, error: { status: 404, title: 'Not Found', detail: 'gone' } })) : of(person))),
    personsGetRelations: vi.fn(() => of([{ relationshipId: 'r1', type: 'Spouse', direction: 'from', relatedPersonId: 'p2', relatedFirstName: 'Maria', relatedLastName: 'Smith', startYear: 1872 }])),
    personsGetByTree: vi.fn(() => of([person, { id: 'p2', treeId: 't1', firstName: 'Maria', lastName: 'Smith', sex: 'Female' }]))
  };
  const trees = { treesGetAll: vi.fn(() => of([{ id: 't1', name: 'Familie' }])) };
  const timeline = { timelineGet: vi.fn(() => of([{ id: 'e1', type: 'Marriage', title: 'x', start: { year: 1872 } }])) };
  const media = { mediaGetMedia: vi.fn(() => of([{ id: 'm1', personId: 'p1', url: '/u/1.jpg', kind: 'Photo', isAvatar: false }, { id: 'm2', personId: 'p1', url: '/u/2.jpg', kind: 'Photo', isAvatar: true }])) };
  const toast = { errorFrom: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({
    providers: [PersonStore,
      { provide: PersonsApi, useValue: persons }, { provide: TreesApi, useValue: trees },
      { provide: TimelineApi, useValue: timeline }, { provide: MediaApi, useValue: media },
      { provide: ToastService, useValue: toast },
      { provide: I18nService, useValue: { t: (k: string) => k } }]
  });
  return { store: TestBed.inject(PersonStore), persons, trees, timeline, media, toast };
}

describe('PersonStore', () => {
  it('loads the person and its dependants', () => {
    const { store, persons, trees } = setup();
    store.load('p1');
    expect(store.person()?.firstName).toBe('Konrad');
    expect(store.tree()?.name).toBe('Familie');
    expect(store.relations().length).toBe(1);
    expect(store.timeline().length).toBe(1);
    expect(store.media().length).toBe(2);
    expect(store.treePersons().length).toBe(2);
    expect(store.avatarUrl()).toBe('/u/2.jpg');
    expect(store.fullName()).toBe('Konrad Smith');
    expect(store.loading()).toBe(false);
    expect(persons.personsGetByTree).toHaveBeenCalledWith({ treeId: 't1' });
    expect(trees.treesGetAll).toHaveBeenCalledTimes(1);
  });

  it('re-entering load cancels the stale pipeline and settles on the newest id', () => {
    const { store, persons } = setup(false, params => of(params.id === 'p2' ? personB : person));
    store.load('p1');
    store.load('p2');
    expect(store.person()?.id).toBe('p2');
    expect(persons.personsGetByTree).toHaveBeenCalledTimes(2);
  });

  it('resets the person and stays loading while a new load is in flight', () => {
    const { store } = setup(false, () => NEVER);
    store.load('p1');
    store.load('p2');
    expect(store.person()).toBeNull();
    expect(store.loading()).toBe(true);
  });

  it('exposes a load error and stops loading', () => {
    const { store } = setup(true);
    store.load('p1');
    expect(store.person()).toBeNull();
    expect(store.error()).toBe('gone');
    expect(store.loading()).toBe(false);
  });

  it('applies local mutations', () => {
    const { store } = setup();
    store.load('p1');
    store.upsertEvent({ id: 'e2', type: 'Custom', title: 'new' });
    expect(store.timeline().length).toBe(2);
    store.removeEvent('e1');
    expect(store.timeline().map(e => e.id)).toEqual(['e2']);
    store.setAvatar('m1');
    expect(store.avatarUrl()).toBe('/u/1.jpg');
    store.removeMedia('m1');
    expect(store.media().length).toBe(1);
    store.setPerson({ ...person, firstName: 'Kurt' });
    expect(store.fullName()).toBe('Kurt Smith');
  });
});
