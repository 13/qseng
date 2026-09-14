import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { RelationshipDialogComponent } from './relationship-dialog.component';
import { PersonsApi, RelationshipDto, RelationshipsApi } from '../../core/api/generated';
import { ToastService } from '../../core/ui/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';

const anchor = { id: 'me', treeId: 't1', firstName: 'Konrad', lastName: 'Smith', sex: 'Male' as const };
const other = { id: 'p2', treeId: 't1', firstName: 'Maria', lastName: 'Escobar', sex: 'Female' as const, birth: { year: 1850 } };

function setup(fail = false, data: object = { treeId: 't1', persons: [anchor, other], anchor }) {
  const api = { relationshipsCreate: vi.fn((): Observable<RelationshipDto> => fail
    ? throwError(() => new HttpErrorResponse({ status: 409, error: { status: 409, title: 'Conflict', detail: 'Already related' } }))
    : of({ id: 'r1', treeId: 't1', type: 'Parent', fromPersonId: 'p2', toPersonId: 'me' })) };
  const persons = { personsCreate: vi.fn(), personsDelete: vi.fn(() => of(true)) };
  const ref = { close: vi.fn() };
  const toast = { errorFrom: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({ providers: [provideNoopAnimations(),
    { provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: ref },
    { provide: RelationshipsApi, useValue: api }, { provide: PersonsApi, useValue: persons }, { provide: ToastService, useValue: toast },
    { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k, relLabel: (t: string) => t, sexLabel: (s: string) => s } }] });
  const fixture = TestBed.createComponent(RelationshipDialogComponent);
  fixture.detectChanges();
  return { cmp: fixture.componentInstance, api, persons, ref, toast, fixture };
}

describe('RelationshipDialogComponent', () => {
  it('filters candidates by name and never offers the anchor itself', () => {
    const { cmp } = setup();
    cmp.form.controls.person.setValue('esc');
    expect(cmp.candidates().map(p => p.id)).toEqual(['p2']);
    cmp.form.controls.person.setValue('kon');
    expect(cmp.candidates()).toEqual([]);
  });

  it('creates a Parent edge from the picked person to the anchor and closes with the DTO', () => {
    const { cmp, api, ref } = setup();
    cmp.form.controls.type.setValue('Parent');
    cmp.pick(other);
    cmp.save();
    expect(api.relationshipsCreate).toHaveBeenCalledWith({ treeId: 't1', body: expect.objectContaining({ type: 'Parent', fromPersonId: 'p2', toPersonId: 'me' }) });
    expect(ref.close).toHaveBeenCalledWith(expect.objectContaining({ relationship: expect.objectContaining({ id: 'r1' }) }));
  });

  it('sends date and place for a spouse and maps Child to a reversed Parent edge', () => {
    const { cmp, api } = setup();
    cmp.form.controls.type.setValue('Spouse');
    cmp.pick(other);
    cmp.form.controls.startDate.setValue({ year: 1872, month: 5 });
    cmp.form.controls.place.setValue('Bregenz');
    cmp.save();
    expect(api.relationshipsCreate).toHaveBeenLastCalledWith({ treeId: 't1', body: { type: 'Spouse', fromPersonId: 'p2', toPersonId: 'me', startYear: 1872, startMonth: 5, startDay: null, notes: 'Bregenz' } });
    cmp.form.controls.type.setValue('Child');
    cmp.save();
    expect(api.relationshipsCreate).toHaveBeenLastCalledWith({ treeId: 't1', body: expect.objectContaining({ type: 'Parent', fromPersonId: 'me', toPersonId: 'p2' }) });
  });

  it('stays open and shows the problem detail on failure; requires a picked person', () => {
    const { cmp, api, ref, toast } = setup(true);
    cmp.save();
    expect(api.relationshipsCreate).not.toHaveBeenCalled();
    cmp.pick(other);
    cmp.save();
    expect(ref.close).not.toHaveBeenCalled();
    expect(toast.errorFrom).toHaveBeenCalled();
  });

  it('picking then retyping the person field clears the pick so save() does not call the API', () => {
    const { cmp, api } = setup();
    cmp.form.controls.type.setValue('Parent');
    cmp.pick(other);
    cmp.form.controls.person.setValue('something else');
    cmp.save();
    expect(api.relationshipsCreate).not.toHaveBeenCalled();
  });

  it('blocks save() when the start date control is invalid', () => {
    const { cmp, api } = setup();
    cmp.form.controls.type.setValue('Spouse');
    cmp.pick(other);
    cmp.form.controls.startDate.setErrors({ partialDate: true });
    cmp.save();
    expect(api.relationshipsCreate).not.toHaveBeenCalled();
  });

  it('requires the from person when there is no anchor, then creates the edge once both are picked', () => {
    const { cmp, api } = setup(false, { treeId: 't1', persons: [anchor, other] });
    cmp.form.controls.type.setValue('Parent');
    cmp.pick(other);
    cmp.save();
    expect(cmp.form.controls.from.errors).toEqual({ required: true });
    expect(api.relationshipsCreate).not.toHaveBeenCalled();
    cmp.pickFromPerson(anchor);
    cmp.save();
    expect(api.relationshipsCreate).toHaveBeenCalledWith({ treeId: 't1', body: expect.objectContaining({ type: 'Parent', fromPersonId: 'me', toPersonId: 'p2' }) });
  });

  it('new-person mode creates the person, links it and closes with both', async () => {
    const { cmp, api, persons, ref, fixture } = setup(false, { treeId: 't1', persons: [anchor, other], anchor, presetType: 'Child', mode: 'new' });
    persons.personsCreate.mockReturnValue(of({ id: 'n1', firstName: 'Anna', lastName: 'Smith', treeId: 't1' }));
    api.relationshipsCreate.mockReturnValue(of({ id: 'r1' }));
    cmp.newForm.patchValue({ firstName: 'Anna', sex: 'Female' });
    cmp.save();
    await fixture.whenStable();
    expect(persons.personsCreate).toHaveBeenCalledWith({ treeId: 't1', body: expect.objectContaining({ firstName: 'Anna', lastName: 'Smith' }) });
    expect(api.relationshipsCreate).toHaveBeenCalledWith({ treeId: 't1', body: expect.objectContaining({ fromPersonId: 'me', toPersonId: 'n1', type: 'Parent' }) });
    expect(ref.close).toHaveBeenCalledWith({ relationship: { id: 'r1' }, uiType: 'Child', created: expect.objectContaining({ id: 'n1' }) });
  });

  it('rolls the created person back when linking fails and stays open', async () => {
    const { cmp, api, persons, ref, fixture } = setup(false, { treeId: 't1', persons: [anchor, other], anchor, presetType: 'Spouse', mode: 'new' });
    persons.personsCreate.mockReturnValue(of({ id: 'n1', firstName: 'Anna', lastName: 'Ray', treeId: 't1' }));
    api.relationshipsCreate.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { title: 'Conflict', detail: 'Already spouses.', status: 409 } })));
    cmp.newForm.patchValue({ firstName: 'Anna', lastName: 'Ray', sex: 'Female' });
    cmp.save();
    await fixture.whenStable();
    expect(persons.personsDelete).toHaveBeenCalledWith({ id: 'n1' });
    expect(ref.close).not.toHaveBeenCalled();
    expect(cmp.error()).toContain('Already spouses.');
  });

  it('new-person mode requires first and last name', () => {
    const { cmp, persons } = setup(false, { treeId: 't1', persons: [anchor, other], anchor, presetType: 'Child', mode: 'new' });
    cmp.save();
    expect(persons.personsCreate).not.toHaveBeenCalled();
    expect(cmp.newForm.controls.firstName.touched).toBe(true);
  });

  it('falls back to existing mode when sessionStorage.getItem throws (private browsing etc.)', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    try {
      const { cmp } = setup();
      expect(cmp.mode()).toBe('existing');
    } finally {
      spy.mockRestore();
    }
  });
});
