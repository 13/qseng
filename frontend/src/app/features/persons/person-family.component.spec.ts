import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PersonFamilyComponent } from './person-family.component';
import { PersonStore } from './person.store';
import { RelationshipsApi } from '../../core/api/generated';
import { ToastService } from '../../core/ui/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';

const me = { id: 'me', treeId: 't1', firstName: 'Konrad', lastName: 'Smith', sex: 'Male' as const };
const rels = [
  { relationshipId: 'r1', type: 'Parent', direction: 'to', relatedPersonId: 'dad', relatedFirstName: 'Georg', relatedLastName: 'Smith' },
  { relationshipId: 'r2', type: 'Parent', direction: 'from', relatedPersonId: 'kid', relatedFirstName: 'Otto', relatedLastName: 'Smith' },
  { relationshipId: 'r3', type: 'Spouse', direction: 'from', relatedPersonId: 'wife', relatedFirstName: 'Maria', relatedLastName: 'Smith', startYear: 1872 }
] as const;

function setup(dialogResult: unknown = undefined) {
  const store = { person: signal(me), relations: signal(rels), treePersons: signal([me]), tree: signal({ id: 't1', name: 'F' }), reloadRelations: vi.fn(), reloadTimeline: vi.fn() };
  const api = { relationshipsDelete: vi.fn(() => of(undefined)), relationshipsRestore: vi.fn(() => of(undefined)) };
  const toast = { success: vi.fn(), errorFrom: vi.fn(), error: vi.fn(), info: vi.fn(), undoable: vi.fn() };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideNoopAnimations(),
    { provide: PersonStore, useValue: store }, { provide: RelationshipsApi, useValue: api },
    { provide: ToastService, useValue: toast }, { provide: MatDialog, useValue: dialog },
    { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }] });
  const fixture = TestBed.createComponent(PersonFamilyComponent);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, store, api, toast, dialog };
}

describe('PersonFamilyComponent', () => {
  it('groups relations into parents, spouses (with year), children and adoptive groups, with a real chip link', () => {
    const { cmp, fixture } = setup();
    expect(cmp.groups().map(g => [g.key, g.items.length])).toEqual([['fam.parents', 1], ['fam.spouses', 1], ['fam.children', 1], ['fam.adoptiveParents', 0], ['fam.adoptiveChildren', 0]]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1872');
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/persons/wife"]')).not.toBeNull();
  });

  it('removes a relationship, reloads relations and timeline, and offers an undo toast', () => {
    const { cmp, api, store, toast } = setup();
    cmp.remove(rels[2]);
    expect(api.relationshipsDelete).toHaveBeenCalledWith({ treeId: 't1', id: 'r3' });
    expect(store.reloadRelations).toHaveBeenCalledTimes(1);
    expect(store.reloadTimeline).toHaveBeenCalledTimes(1);
    expect(toast.undoable).toHaveBeenCalledWith('fam.removed.undo', expect.any(Function));
  });

  it('restores the relationship and reloads relations and timeline when undo is invoked', async () => {
    const { cmp, api, store, toast } = setup();
    cmp.remove(rels[2]);
    const onUndo = toast.undoable.mock.calls[0][1];
    await onUndo();
    expect(api.relationshipsRestore).toHaveBeenCalledWith({ treeId: 't1', id: 'r3' });
    expect(store.reloadRelations).toHaveBeenCalledTimes(2);
    expect(store.reloadTimeline).toHaveBeenCalledTimes(2);
  });

  it('opens the relationship dialog anchored on the person and reloads on a result', async () => {
    const { cmp, dialog, store, toast } = setup({ id: 'r9' });
    await cmp.openAdd();
    expect(dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: expect.objectContaining({ treeId: 't1', anchor: me }) }));
    expect(store.reloadRelations).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('rel.added.toast');
  });

  it('addNew opens the dialog preset to new-person mode and toasts an "Open" action for the created person', async () => {
    const { cmp, dialog, store, toast } = setup({ relationship: { id: 'r9', type: 'Parent' }, uiType: 'Child', created: { id: 'n1', firstName: 'Anna', lastName: 'Ray' } });
    await cmp.addNew('Child');
    expect(dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: expect.objectContaining({ treeId: 't1', anchor: me, presetType: 'Child', mode: 'new' }) }));
    expect(store.reloadRelations).toHaveBeenCalled();
    expect(store.reloadTimeline).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('rel.added.child', expect.objectContaining({ action: 'rel.open', onAction: expect.any(Function) }));
  });
});
