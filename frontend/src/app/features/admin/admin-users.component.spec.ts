import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AdminUsersComponent } from './admin-users.component';
import { AdminApi } from '../../core/api/generated';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { LayoutService } from '../../core/ui/layout.service';
import { I18nService } from '../../core/i18n/i18n.service';

const users = [
  { id: 'me', username: 'demo', displayName: 'Demo Admin', email: 'd@x', isAdmin: true, isActive: true, language: 'en', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'u2', username: 'anna', displayName: 'Anna', email: null, isAdmin: false, isActive: false, language: 'de', createdAt: '2026-02-01T00:00:00Z' }
];

function setup(handset = false, confirmResult = true, dialogResult: unknown = undefined) {
  TestBed.resetTestingModule(); // setup() runs twice in one test below
  const api = {
    adminListUsers: vi.fn(() => of(users)),
    adminGetSettings: vi.fn(() => of({ registrationEnabled: true })),
    adminSetRegistration: vi.fn(() => of(undefined)),
    adminCreateUser: vi.fn(() => of(users[1])),
    adminSetActive: vi.fn(() => of(undefined)),
    adminSetAdmin: vi.fn(() => of(undefined)),
    adminChangePassword: vi.fn(() => of(undefined)),
    adminDeleteUser: vi.fn(() => of(undefined))
  };
  const confirm = { confirm: vi.fn(async () => confirmResult) };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), errorFrom: vi.fn() };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]), provideNoopAnimations(),
      { provide: AdminApi, useValue: api }, { provide: AuthService, useValue: { userId: () => 'me' } },
      { provide: ConfirmDialogService, useValue: confirm }, { provide: ToastService, useValue: toast },
      { provide: MatDialog, useValue: dialog }, { provide: LayoutService, useValue: { handset: () => handset } },
      { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k, lang: () => 'en' } }
    ]
  });
  const fixture = TestBed.createComponent(AdminUsersComponent);
  fixture.detectChanges();
  return { fixture, api, confirm, toast, dialog, cmp: fixture.componentInstance };
}

describe('AdminUsersComponent', () => {
  it('renders a table on desktop and cards on handset', () => {
    const desktop = setup(false);
    expect((desktop.fixture.nativeElement as HTMLElement).querySelector('table')).not.toBeNull();
    const handset = setup(true);
    expect((handset.fixture.nativeElement as HTMLElement).querySelector('table')).toBeNull();
    expect((handset.fixture.nativeElement as HTMLElement).querySelectorAll('mat-card').length).toBe(2);
  });

  it('toggles registration and reflects the new state', () => {
    const { cmp, api } = setup();
    cmp.toggleRegistration(false);
    expect(api.adminSetRegistration).toHaveBeenCalledWith({ body: { enabled: false } });
    expect(cmp.registrationEnabled()).toBe(false);
  });

  it('never offers destructive actions on the current user and confirms before deleting others', async () => {
    const { cmp, api, confirm } = setup(false, true);
    expect(cmp.isMe(users[0])).toBe(true);
    await cmp.deleteUser(users[1]);
    expect(confirm.confirm).toHaveBeenCalled();
    expect(api.adminDeleteUser).toHaveBeenCalledWith({ id: 'u2' });
  });

  it('reloads and toasts success when the dialog closes with the created user, without calling the API itself', async () => {
    const { cmp, api, toast } = setup(false, true, { id: 'u9', username: 'x', password: 'password1', isAdmin: false, displayName: null, email: null });
    await cmp.openCreate();
    expect(api.adminCreateUser).not.toHaveBeenCalled();
    expect(api.adminListUsers).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('admin.created.toast');
  });

  it('ignores activate/admin toggles and the password dialog on the current user even if invoked directly', async () => {
    const { cmp, api, dialog } = setup();
    cmp.toggleActive(users[0]);
    await cmp.toggleAdmin(users[0]);
    expect(api.adminSetActive).not.toHaveBeenCalled();
    expect(api.adminSetAdmin).not.toHaveBeenCalled();
    await cmp.changePassword(users[0]);
    expect(dialog.open).not.toHaveBeenCalled();
  });
});
