import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { SettingsComponent } from './settings.component';
import { PersonsApi, TrashApi, UserApi } from '../../core/api/generated';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ThemeService } from '../../core/theme/theme.service';

function setup(confirmResult: boolean | string = 'hunter2', fragment: string | null = null) {
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
  const trashApi = { trashList: vi.fn(() => of({ retentionDays: 30, items: [] })), trashPurge: vi.fn(() => of(undefined)) };
  const personsApi = { personsRestore: vi.fn(() => of({})) };
  const auth = { adoptSession: vi.fn(), logout: vi.fn() };
  const confirm = { confirm: vi.fn(async () => confirmResult) };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), errorFrom: vi.fn() };
  const i18n = { t: (k: string) => k, dynamic: (k: string) => k, lang: () => 'en', setLang: vi.fn() };
  const route = { fragment: of(fragment) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]), provideNoopAnimations(),
      { provide: UserApi, useValue: api }, { provide: TrashApi, useValue: trashApi }, { provide: PersonsApi, useValue: personsApi },
      { provide: AuthService, useValue: auth }, { provide: ActivatedRoute, useValue: route },
      { provide: ConfirmDialogService, useValue: confirm }, { provide: ToastService, useValue: toast },
      { provide: I18nService, useValue: i18n }, { provide: ThemeService, useValue: { mode: () => 'auto', setMode: vi.fn() } }
    ]
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(SettingsComponent);
  fixture.detectChanges();
  return { fixture, api, trashApi, personsApi, auth, navigate, confirm, toast, i18n, cmp: fixture.componentInstance };
}

describe('SettingsComponent', () => {
  it('loads the profile and applies its language', () => {
    const { fixture, i18n } = setup();
    expect(i18n.setLang).toHaveBeenCalledWith('de');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('demo');
  });

  it('shows the display name above the username', () => {
    const { fixture } = setup();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Demo');
  });

  it('sets the language and calls userChangeLanguage', () => {
    const { cmp, api } = setup();
    cmp.setLang('en');
    expect(api.userChangeLanguage).toHaveBeenCalledWith({ body: { language: 'en' } });
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

  it('embeds the trash card', () => {
    const { fixture } = setup();
    expect((fixture.nativeElement as HTMLElement).querySelector('qs-trash-card#trash')).not.toBeNull();
  });

  it('scrolls the #trash card into view when arriving with the "trash" fragment', async () => {
    // The scroll runs in a queueMicrotask inside a viewChild-driven effect; flush microtasks before asserting.
    const original = Element.prototype.scrollIntoView;
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    const { fixture } = setup('hunter2', 'trash');
    try {
      document.body.appendChild(fixture.nativeElement);
      fixture.autoDetectChanges();
      await new Promise(r => setTimeout(r, 20));
      expect(scrollSpy).toHaveBeenCalledWith({ block: 'start' });
    } finally {
      Element.prototype.scrollIntoView = original;
      fixture.nativeElement.remove();
    }
  });
});
