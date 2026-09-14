import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PersonEditComponent } from './person-edit.component';
import { PersonStore } from './person.store';
import { MediaApi, PersonsApi } from '../../core/api/generated';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { BreadcrumbService } from '../../core/ui/breadcrumb.service';
import { I18nService } from '../../core/i18n/i18n.service';

const existing = { id: 'p1', treeId: 't1', firstName: 'Konrad', lastName: 'Smith', sex: 'Male' as const, birth: { year: 1843 }, birthPlace: 'Bregenz' };

function setup(mode: 'new' | 'edit', opts: { person?: typeof existing | null } = {}) {
  const initialPerson = mode === 'edit' ? (opts.person !== undefined ? opts.person : existing) : null;
  const store = { load: vi.fn(), person: signal(initialPerson), tree: signal({ id: 't1', name: 'F' }), error: signal(''), avatarUrl: signal(null), setPerson: vi.fn(), fullName: signal('Konrad Smith'), reloadMedia: vi.fn() };
  const persons = { personsCreate: vi.fn(() => of({ ...existing, id: 'p9' })), personsUpdate: vi.fn(() => of({ ...existing, firstName: 'Kurt' })), personsDelete: vi.fn(() => of(undefined)) };
  const media = { mediaUpload: vi.fn(() => of({ id: 'm1', url: '/u/a.jpg', kind: 'Photo', isAvatar: true })), mediaSetAvatar: vi.fn(() => of(undefined)) };
  const confirm = { confirm: vi.fn(async () => true) };
  const toast = { success: vi.fn(), errorFrom: vi.fn(), error: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideNoopAnimations(),
    { provide: PersonsApi, useValue: persons }, { provide: MediaApi, useValue: media }, { provide: ConfirmDialogService, useValue: confirm },
    { provide: ToastService, useValue: toast }, { provide: BreadcrumbService, useValue: { set: vi.fn() } },
    { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k, sexLabel: (s: string) => s } }] });
  TestBed.overrideComponent(PersonEditComponent, { set: { providers: [{ provide: PersonStore, useValue: store }] } });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PersonEditComponent);
  if (mode === 'edit') fixture.componentRef.setInput('id', 'p1'); else fixture.componentRef.setInput('treeId', 't1');
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, store, persons, media, navigate, confirm, toast };
}

describe('PersonEditComponent', () => {
  it('prefills from the store in edit mode and is clean until touched', () => {
    const { cmp } = setup('edit');
    expect(cmp.form.value.firstName).toBe('Konrad');
    expect(cmp.form.value.birth).toEqual({ year: 1843 });
    expect(cmp.hasUnsavedChanges()).toBe(false);
    cmp.form.controls.firstName.setValue('Kurt');
    expect(cmp.hasUnsavedChanges()).toBe(true);
  });

  it('updates an existing person and navigates to the detail page', () => {
    const { cmp, persons, store, navigate } = setup('edit');
    cmp.form.controls.firstName.setValue('Kurt');
    cmp.save();
    expect(persons.personsUpdate).toHaveBeenCalledWith({ id: 'p1', body: expect.objectContaining({ firstName: 'Kurt', lastName: 'Smith', birth: { year: 1843 }, birthPlace: 'Bregenz' }) });
    expect(store.setPerson).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/persons', 'p1']);
    expect(cmp.hasUnsavedChanges()).toBe(false);
  });

  it('creates a new person, uploads the pending avatar, then navigates', async () => {
    const { cmp, persons, media, navigate } = setup('new');
    cmp.form.patchValue({ firstName: 'Anna', lastName: 'Huber', sex: 'Female' });
    cmp.onAvatarPicked(new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    await cmp.save();
    expect(persons.personsCreate).toHaveBeenCalledWith({ treeId: 't1', body: expect.objectContaining({ firstName: 'Anna', sex: 'Female' }) });
    expect(media.mediaUpload).toHaveBeenCalledWith({ personId: 'p9', body: { file: expect.any(File), kind: 'Photo' } });
    expect(navigate).toHaveBeenCalledWith(['/persons', 'p9']);
  });

  it('requires first and last name', () => {
    const { cmp, persons } = setup('new');
    cmp.save();
    expect(persons.personsCreate).not.toHaveBeenCalled();
    expect(cmp.form.controls.lastName.touched).toBe(true);
  });

  it('deletes after confirm and returns to the tree', async () => {
    const { cmp, persons, navigate } = setup('edit');
    await cmp.remove();
    expect(persons.personsDelete).toHaveBeenCalledWith({ id: 'p1' });
    expect(navigate).toHaveBeenCalledWith(['/trees', 't1']);
  });

  it('shows a progress bar and no form until the person loads, then prefills', () => {
    const { fixture, store } = setup('edit', { person: null });
    let el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('mat-progress-bar')).not.toBeNull();
    store.person.set(existing);
    fixture.detectChanges();
    el = fixture.nativeElement;
    expect(el.querySelector('form')).not.toBeNull();
    expect(el.querySelector('input[formcontrolname="firstName"]')).not.toBeNull();
  });

  it('shows the retry block and no form when the store has an error', () => {
    const { fixture, store } = setup('edit', { person: null });
    store.error.set('boom');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('form')).toBeNull();
    expect(el.textContent).toContain('boom');
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('reports unsaved changes when only a pending avatar exists', () => {
    const { cmp } = setup('new');
    expect(cmp.hasUnsavedChanges()).toBe(false);
    cmp.onAvatarPicked(new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    expect(cmp.hasUnsavedChanges()).toBe(true);
  });

  it('keeps unsaved changes true when save fails', () => {
    const { cmp, persons } = setup('edit');
    persons.personsUpdate.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    cmp.form.controls.firstName.setValue('Kurt');
    cmp.save();
    expect(cmp.hasUnsavedChanges()).toBe(true);
  });

  it('sets the uploaded avatar as the profile photo in edit mode', () => {
    const { cmp, media } = setup('edit');
    cmp.onAvatarPicked(new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    expect(media.mediaUpload).toHaveBeenCalledWith({ personId: 'p1', body: { file: expect.any(File), kind: 'Photo' } });
    expect(media.mediaSetAvatar).toHaveBeenCalledWith({ personId: 'p1', mediaId: 'm1' });
  });
});
