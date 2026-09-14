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
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';

const me = { id: 'me', treeId: 't1', firstName: 'Konrad', lastName: 'Smith', sex: 'Male' as const };
const rels = [
  { relationshipId: 'r1', type: 'Parent', direction: 'to', relatedPersonId: 'dad', relatedFirstName: 'Georg', relatedLastName: 'Smith' },
  { relationshipId: 'r2', type: 'Parent', direction: 'from', relatedPersonId: 'kid', relatedFirstName: 'Otto', relatedLastName: 'Smith' },
  { relationshipId: 'r3', type: 'Spouse', direction: 'from', relatedPersonId: 'wife', relatedFirstName: 'Maria', relatedLastName: 'Smith', startYear: 1872 }
] as const;

function setup(confirmResult = true, dialogResult: unknown = undefined) {
  const store = { person: signal(me), relations: signal(rels), treePersons: signal([me]), tree: signal({ id: 't1', name: 'F' }), reloadRelations: vi.fn(), reloadTimeline: vi.fn() };
  const api = { relationshipsDelete: vi.fn(() => of(undefined)) };
  const confirm = { confirm: vi.fn(async () => confirmResult) };
  const toast = { success: vi.fn(), errorFrom: vi.fn(), error: vi.fn(), info: vi.fn() };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideNoopAnimations(),
    { provide: PersonStore, useValue: store }, { provide: RelationshipsApi, useValue: api },
    { provide: ConfirmDialogService, useValue: confirm }, { provide: ToastService, useValue: toast }, { provide: MatDialog, useValue: dialog },
    { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }] });
  const fixture = TestBed.createComponent(PersonFamilyComponent);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, store, api, confirm, toast, dialog };
}

describe('PersonFamilyComponent', () => {
  it('groups relations into parents, spouses (with year) and children', () => {
    const { cmp, fixture } = setup();
    expect(cmp.groups().map(g => [g.key, g.items.length])).toEqual([['fam.parents', 1], ['fam.spouses', 1], ['fam.children', 1], ['fam.adoptiveParents', 0]]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1872');
  });

  it('removes a relationship after confirmation and reloads relations and timeline', async () => {
    const { cmp, api, store } = setup(true);
    await cmp.remove(rels[2]);
    expect(api.relationshipsDelete).toHaveBeenCalledWith({ treeId: 't1', id: 'r3' });
    expect(store.reloadRelations).toHaveBeenCalled();
    expect(store.reloadTimeline).toHaveBeenCalled();
  });

  it('opens the relationship dialog anchored on the person and reloads on a result', async () => {
    const { cmp, dialog, store, toast } = setup(true, { id: 'r9' });
    await cmp.openAdd();
    expect(dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: expect.objectContaining({ treeId: 't1', anchor: me }) }));
    expect(store.reloadRelations).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('rel.added.toast');
  });
});
