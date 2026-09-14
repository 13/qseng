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
  it('renders rows with "Last, First" and marks the selected one', async () => {
    const { fixture } = setup();
    // CdkVirtualScrollViewport measures itself and attaches its scroll strategy inside
    // ngOnInit via `Promise.resolve().then(...)`, so the virtualized rows are not yet in
    // the DOM right after the first synchronous detectChanges() — flush that microtask.
    await Promise.resolve(); await Promise.resolve();
    fixture.detectChanges();
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
