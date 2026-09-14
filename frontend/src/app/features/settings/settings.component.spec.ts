import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { SettingsComponent } from './settings.component';
import { UserApi } from '../../core/api/generated';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ThemeService } from '../../core/theme/theme.service';

function setup(confirmResult: boolean | string = 'hunter2') {
  TestBed.resetTestingModule(); // setup() runs twice in one test below
  const session = { accessToken: 'new', refreshToken: 'r2', userId: 'u', displayName: 'Demo', username: 'demo', isAdmin: false };
  const api = {
    userGetProfile: vi.fn(() => of({ id: 'u', username: 'demo', displayName: 'Demo', email: 'd@x', isAdmin: false, language: 'de', createdAt: '2026-01-01T00:00:00Z' })),
    userChangePassword: vi.fn(() => of(session)),
    userChangeLanguage: vi.fn(() => of(undefined)),
    userExport: vi.fn(() => of({ username: 'demo', exportedAt: 'now', trees: [] })),
    userDeleteData: vi.fn(() => of(undefined)),
    userDeleteAccount: vi.fn(() => of(undefined))
  };
  const auth = { adoptSession: vi.fn(), logout: vi.fn() };
  const confirm = { confirm: vi.fn(async () => confirmResult) };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const i18n = { t: (k: string) => k, dynamic: (k: string) => k, lang: () => 'en', setLang: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]), provideNoopAnimations(),
      { provide: UserApi, useValue: api }, { provide: AuthService, useValue: auth },
      { provide: ConfirmDialogService, useValue: confirm }, { provide: ToastService, useValue: toast },
      { provide: I18nService, useValue: i18n }, { provide: ThemeService, useValue: { mode: () => 'auto', setMode: vi.fn() } }
    ]
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(SettingsComponent);
  fixture.detectChanges();
  return { fixture, api, auth, navigate, confirm, toast, i18n, cmp: fixture.componentInstance };
}

describe('SettingsComponent', () => {
  it('loads the profile and applies its language', () => {
    const { fixture, i18n } = setup();
    expect(i18n.setLang).toHaveBeenCalledWith('de');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('demo');
  });

  it('changes the password and adopts the new session', () => {
    const { cmp, api, auth, toast } = setup();
    cmp.pwForm.setValue({ current: 'old', next: 'newpassword' });
    cmp.changePassword();
    expect(api.userChangePassword).toHaveBeenCalledWith({ body: { currentPassword: 'old', newPassword: 'newpassword' } });
    expect(auth.adoptSession).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('settings.password.ok');
    expect(cmp.pwForm.value).toEqual({ current: '', next: '' });
  });

  it('deletes the account only with a confirmed password, then logs out', async () => {
    const declined = setup(false);
    await declined.cmp.deleteAccount();
    expect(declined.api.userDeleteAccount).not.toHaveBeenCalled();

    const ok = setup('hunter2');
    await ok.cmp.deleteAccount();
    expect(ok.api.userDeleteAccount).toHaveBeenCalledWith({ body: { password: 'hunter2' } });
    expect(ok.auth.logout).toHaveBeenCalled();
    expect(ok.navigate).toHaveBeenCalledWith(['/login']);
  });
});
