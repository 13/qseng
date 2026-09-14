import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';

function setup(result: 'session' | 'pending' | 'validation') {
  const auth = {
    register: vi.fn(() => result === 'validation'
      ? throwError(() => new HttpErrorResponse({ status: 400, error: { status: 400, title: 'v', errors: { username: ['Username taken.'] } } }))
      : of(result === 'session'
          ? { accessToken: 'a', userId: 'u', displayName: 'D', username: 'n', isAdmin: false }
          : { accessToken: null, refreshToken: null, userId: 'u', displayName: 'D', username: 'n', isAdmin: false, pendingActivation: true }))
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k, lang: () => 'en', setLang: vi.fn() } }
    ]
  });
  const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(RegisterComponent);
  fixture.detectChanges();
  return { fixture, auth, navigateByUrl, cmp: fixture.componentInstance };
}

describe('RegisterComponent', () => {
  it('requires username and an 8+ character password, email optional but valid', () => {
    const { cmp } = setup('session');
    cmp.form.setValue({ username: '', displayName: '', email: 'not-an-email', password: 'short' });
    expect(cmp.form.controls.username.hasError('required')).toBe(true);
    expect(cmp.form.controls.password.hasError('minlength')).toBe(true);
    expect(cmp.form.controls.email.hasError('email')).toBe(true);
  });

  it('navigates to trees when a session is returned', () => {
    const { cmp, auth, navigateByUrl } = setup('session');
    cmp.form.setValue({ username: 'newbie', displayName: 'New', email: '', password: 'password1' });
    cmp.submit();
    expect(auth.register).toHaveBeenCalledWith('newbie', 'password1', 'New', undefined);
    expect(navigateByUrl).toHaveBeenCalledWith('/trees');
  });

  it('shows the pending-activation state instead of navigating', () => {
    const { cmp, navigateByUrl, fixture } = setup('pending');
    cmp.form.setValue({ username: 'newbie', displayName: '', email: '', password: 'password1' });
    cmp.submit();
    fixture.detectChanges();
    expect(cmp.pending()).toBe(true);
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('register.pendingTitle');
  });

  it('maps validation problems onto the form', () => {
    const { cmp } = setup('validation');
    cmp.form.setValue({ username: 'taken', displayName: '', email: '', password: 'password1' });
    cmp.submit();
    expect(cmp.form.controls.username.errors).toEqual({ server: 'Username taken.' });
  });
});
