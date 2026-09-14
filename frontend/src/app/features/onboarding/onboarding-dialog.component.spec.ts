import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingDialogComponent } from './onboarding-dialog.component';
import { PersonDto, PersonsApi, RelationshipDto, RelationshipsApi, TreeDto, TreesApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { LayoutService } from '../../core/ui/layout.service';

function setup(opts: { treesFail?: boolean; personsFail?: boolean } = {}) {
  const trees = {
    treesCreate: vi.fn((): Observable<TreeDto> => opts.treesFail
      ? throwError(() => new HttpErrorResponse({ status: 409, error: { status: 409, title: 'Conflict', detail: 'Name taken' } }))
      : of({ id: 't1' }))
  };
  const persons = {
    personsCreate: vi.fn((): Observable<PersonDto> => opts.personsFail
      ? throwError(() => new HttpErrorResponse({ status: 400, error: { status: 400, title: 'Bad', errors: { firstName: ['Required'] } } }))
      : of({ id: 'me' }))
  };
  const relationships = { relationshipsCreate: vi.fn((): Observable<RelationshipDto> => of({ id: 'r1' })) };
  const ref = { close: vi.fn(), disableClose: false };
  // Reset first: several tests call setup() more than once, and TestBed forbids
  // reconfiguring after it's been instantiated.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideNoopAnimations(),
      { provide: MatDialogRef, useValue: ref },
      { provide: TreesApi, useValue: trees },
      { provide: PersonsApi, useValue: persons },
      { provide: RelationshipsApi, useValue: relationships },
      { provide: LayoutService, useValue: { handset: () => false, tablet: () => false, desktop: () => true } },
      { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k, sexLabel: (s: string) => s } }
    ]
  });
  const fixture = TestBed.createComponent(OnboardingDialogComponent);
  fixture.detectChanges();
  return { cmp: fixture.componentInstance, trees, persons, relationships, ref, fixture };
}

/** Drives step 1 (tree name) and step 2 (your name/sex) to completion so tests can focus on step 3. */
function toStep3(cmp: OnboardingDialogComponent) {
  cmp.treeForm.controls.name.setValue('Escobar');
  cmp.next();
  cmp.youForm.setValue({ firstName: 'Konrad', lastName: 'Smith', sex: 'Male', birth: null });
  cmp.next();
}

describe('OnboardingDialogComponent', () => {
  it('step 1: next() with an empty name marks the field touched and calls nothing', () => {
    const { cmp, trees } = setup();
    cmp.next();
    expect(trees.treesCreate).not.toHaveBeenCalled();
    expect(cmp.treeForm.controls.name.touched).toBe(true);
  });

  it('step 1: next() with a name calls treesCreate and moves to step 2; step 1 becomes non-editable', () => {
    const { cmp, trees, fixture } = setup();
    cmp.treeForm.controls.name.setValue('Escobar');
    cmp.next();
    expect(trees.treesCreate).toHaveBeenCalledWith({ body: { name: 'Escobar', description: null } });
    expect(cmp.treeId()).toBe('t1');
    expect(cmp.stepper().selectedIndex).toBe(1);
    fixture.detectChanges();
    expect(cmp.stepper().steps.get(0)?.editable).toBe(false);
  });

  it('step 2: next() calls personsCreate with treeId t1 and the entered names, then moves to step 3', () => {
    const { cmp, persons } = setup();
    cmp.treeForm.controls.name.setValue('Escobar');
    cmp.next();
    cmp.youForm.setValue({ firstName: 'Konrad', lastName: 'Smith', sex: 'Male', birth: null });
    cmp.next();
    expect(persons.personsCreate).toHaveBeenCalledWith({ treeId: 't1', body: expect.objectContaining({ firstName: 'Konrad', lastName: 'Smith', sex: 'Male' }) });
    expect(cmp.youId()).toBe('me');
    expect(cmp.stepper().selectedIndex).toBe(2);
  });

  it('step 3: finish() with only the mother filled creates one person and one Parent relationship, then closes', async () => {
    const { cmp, persons, relationships, ref, fixture } = setup();
    persons.personsCreate.mockReturnValueOnce(of({ id: 'me' })).mockReturnValueOnce(of({ id: 'm1' }));
    toStep3(cmp);
    cmp.parentsForm.controls.mother.patchValue({ firstName: 'Maria', lastName: 'Escobar' });
    cmp.finish();
    await fixture.whenStable();
    expect(persons.personsCreate).toHaveBeenCalledTimes(2);
    expect(persons.personsCreate).toHaveBeenLastCalledWith({ treeId: 't1', body: expect.objectContaining({ firstName: 'Maria', lastName: 'Escobar', sex: 'Female' }) });
    expect(relationships.relationshipsCreate).toHaveBeenCalledTimes(1);
    expect(relationships.relationshipsCreate).toHaveBeenCalledWith({ treeId: 't1', body: expect.objectContaining({ type: 'Parent', fromPersonId: 'm1', toPersonId: 'me' }) });
    expect(ref.close).toHaveBeenCalledWith({ treeId: 't1', personId: 'me' });
  });

  it('step 3: skip() closes without further calls', () => {
    const { cmp, persons, relationships, ref } = setup();
    toStep3(cmp);
    persons.personsCreate.mockClear();
    cmp.skip();
    expect(persons.personsCreate).not.toHaveBeenCalled();
    expect(relationships.relationshipsCreate).not.toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith({ treeId: 't1', personId: 'me' });
  });

  it('a failing personsCreate (validation problem) keeps step 2 open and shows the server error on firstName', () => {
    const { cmp, persons, ref } = setup({ personsFail: true });
    cmp.treeForm.controls.name.setValue('Escobar');
    cmp.next();
    cmp.youForm.setValue({ firstName: 'Konrad', lastName: 'Smith', sex: 'Male', birth: null });
    cmp.next();
    expect(persons.personsCreate).toHaveBeenCalled();
    expect(cmp.stepper().selectedIndex).toBe(1);
    expect(cmp.youForm.controls.firstName.errors).toEqual(expect.objectContaining({ server: 'Required' }));
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('sets ref.disableClose once the tree is created, so an accidental Escape does not lose the flow', () => {
    const { cmp, ref } = setup();
    expect(ref.disableClose).toBe(false);
    cmp.treeForm.controls.name.setValue('Escobar');
    cmp.next();
    expect(ref.disableClose).toBe(true);
  });
});
