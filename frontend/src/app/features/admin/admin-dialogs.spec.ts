import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { UserFormDialogComponent } from './user-form-dialog.component';
import { UserPasswordDialogComponent } from './user-password-dialog.component';
import { AdminApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { ToastService } from '../../core/ui/toast.service';

const i18n = { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } };

describe('admin dialogs', () => {
  it('user form requires username and 8+ password and calls adminCreateUser, closing with the created user', () => {
    const ref = { close: vi.fn() };
    const api = { adminCreateUser: vi.fn(() => of({ id: 'u9', username: 'newbie', displayName: null, email: 'n@x.de', isAdmin: true, isActive: true, language: 'en', createdAt: '2026-01-01T00:00:00Z' })) };
    const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), errorFrom: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: MatDialogRef, useValue: ref }, { provide: MAT_DIALOG_DATA, useValue: {} }, { provide: AdminApi, useValue: api }, { provide: ToastService, useValue: toast }, i18n] });
    const cmp = TestBed.createComponent(UserFormDialogComponent).componentInstance;
    cmp.form.setValue({ username: 'x', displayName: '', email: '', password: 'short', isAdmin: false });
    cmp.save();
    expect(ref.close).not.toHaveBeenCalled();
    expect(api.adminCreateUser).not.toHaveBeenCalled();

    cmp.form.setValue({ username: 'newbie', displayName: '', email: 'n@x.de', password: 'password1', isAdmin: true });
    cmp.save();
    expect(api.adminCreateUser).toHaveBeenCalledWith({ body: { username: 'newbie', displayName: null, email: 'n@x.de', password: 'password1', isAdmin: true } });
    expect(ref.close).toHaveBeenCalledWith(expect.objectContaining({ id: 'u9', username: 'newbie' }));
  });

  it('user form maps a validation problem onto the form without closing', () => {
    const ref = { close: vi.fn() };
    const error = new HttpErrorResponse({ status: 400, error: { status: 400, title: 'Bad Request', errors: { username: ['Taken.'] } } });
    const api = { adminCreateUser: vi.fn(() => throwError(() => error)) };
    const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), errorFrom: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: MatDialogRef, useValue: ref }, { provide: MAT_DIALOG_DATA, useValue: {} }, { provide: AdminApi, useValue: api }, { provide: ToastService, useValue: toast }, i18n] });
    const cmp = TestBed.createComponent(UserFormDialogComponent).componentInstance;
    cmp.form.setValue({ username: 'newbie', displayName: '', email: '', password: 'password1', isAdmin: false });
    cmp.save();
    expect(ref.close).not.toHaveBeenCalled();
    expect(cmp.form.controls.username.errors).toEqual({ server: 'Taken.' });
    expect(toast.errorFrom).not.toHaveBeenCalled();
  });

  it('password dialog requires 8+ chars, calls adminChangePassword, and closes with true', () => {
    const ref = { close: vi.fn() };
    const api = { adminChangePassword: vi.fn(() => of(undefined)) };
    const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), errorFrom: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: MatDialogRef, useValue: ref }, { provide: MAT_DIALOG_DATA, useValue: { id: 'u2', username: 'demo' } }, { provide: AdminApi, useValue: api }, { provide: ToastService, useValue: toast }, i18n] });
    const cmp = TestBed.createComponent(UserPasswordDialogComponent).componentInstance;
    cmp.form.setValue({ password: 'short' });
    cmp.save();
    expect(ref.close).not.toHaveBeenCalled();
    expect(api.adminChangePassword).not.toHaveBeenCalled();

    cmp.form.setValue({ password: 'longenough' });
    cmp.save();
    expect(api.adminChangePassword).toHaveBeenCalledWith({ id: 'u2', body: { newPassword: 'longenough' } });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('password dialog toasts other failures via errorFrom and stays open', () => {
    const ref = { close: vi.fn() };
    const error = new HttpErrorResponse({ status: 500 });
    const api = { adminChangePassword: vi.fn(() => throwError(() => error)) };
    const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), errorFrom: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: MatDialogRef, useValue: ref }, { provide: MAT_DIALOG_DATA, useValue: { id: 'u2', username: 'demo' } }, { provide: AdminApi, useValue: api }, { provide: ToastService, useValue: toast }, i18n] });
    const cmp = TestBed.createComponent(UserPasswordDialogComponent).componentInstance;
    cmp.form.setValue({ password: 'longenough' });
    cmp.save();
    expect(ref.close).not.toHaveBeenCalled();
    expect(toast.errorFrom).toHaveBeenCalledWith(error, 'err.save');
  });
});
