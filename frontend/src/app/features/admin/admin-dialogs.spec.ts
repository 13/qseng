import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { UserFormDialogComponent } from './user-form-dialog.component';
import { UserPasswordDialogComponent } from './user-password-dialog.component';
import { I18nService } from '../../core/i18n/i18n.service';

const i18n = { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } };

describe('admin dialogs', () => {
  it('user form requires username and 8+ password and closes with a request body', () => {
    const ref = { close: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: MatDialogRef, useValue: ref }, { provide: MAT_DIALOG_DATA, useValue: {} }, i18n] });
    const cmp = TestBed.createComponent(UserFormDialogComponent).componentInstance;
    cmp.form.setValue({ username: 'x', displayName: '', email: '', password: 'short', isAdmin: false });
    cmp.save();
    expect(ref.close).not.toHaveBeenCalled();
    cmp.form.setValue({ username: 'newbie', displayName: '', email: 'n@x.de', password: 'password1', isAdmin: true });
    cmp.save();
    expect(ref.close).toHaveBeenCalledWith({ username: 'newbie', displayName: null, email: 'n@x.de', password: 'password1', isAdmin: true });
  });

  it('password dialog closes with the new password', () => {
    const ref = { close: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: MatDialogRef, useValue: ref }, { provide: MAT_DIALOG_DATA, useValue: { username: 'demo' } }, i18n] });
    const cmp = TestBed.createComponent(UserPasswordDialogComponent).componentInstance;
    cmp.form.setValue({ password: 'short' });
    cmp.save();
    expect(ref.close).not.toHaveBeenCalled();
    cmp.form.setValue({ password: 'longenough' });
    cmp.save();
    expect(ref.close).toHaveBeenCalledWith('longenough');
  });
});
