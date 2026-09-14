import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { LoginComponent } from './login.component';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';

function setup(returnUrl: string | null, loginResult: 'ok' | 'fail') {
  const auth = {
    login: vi.fn(() => loginResult === 'ok'
      ? of({ accessToken: 'a', userId: 'u', displayName: 'D', username: 'demo', isAdmin: false })
      : throwError(() => new HttpErrorResponse({ status: 401, error: { status: 401, title: 'Unauthorized', detail: 'Bad credentials' } })))
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k, lang: () => 'en', setLang: vi.fn() } }
    ]
  });
  const router = TestBed.inject(Router);
  const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(LoginComponent);
  if (returnUrl !== null) fixture.componentRef.setInput('returnUrl', returnUrl);
  fixture.detectChanges();
  return { fixture, auth, navigateByUrl, cmp: fixture.componentInstance };
}

describe('LoginComponent', () => {
  it('does not submit an invalid form', () => {
    const { cmp, auth } = setup(null, 'ok');
    cmp.submit();
    expect(auth.login).not.toHaveBeenCalled();
    expect(cmp.form.controls.username.touched).toBe(true);
  });

  it('logs in and follows a safe returnUrl', () => {
    const { cmp, auth, navigateByUrl } = setup('/persons/42', 'ok');
    cmp.form.setValue({ username: 'demo', password: 'Demo123!' });
    cmp.submit();
    expect(auth.login).toHaveBeenCalledWith('demo', 'Demo123!');
    expect(navigateByUrl).toHaveBeenCalledWith('/persons/42');
  });

  it('ignores an unsafe returnUrl and shows the server error on failure', () => {
    const { cmp, navigateByUrl, fixture } = setup('//evil.example', 'fail');
    cmp.form.setValue({ username: 'demo', password: 'x' });
    cmp.submit();
    fixture.detectChanges();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(cmp.error()).toBe('Bad credentials');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Bad credentials');
  });

  it('fills the demo credentials from the chip', () => {
    const { cmp } = setup(null, 'ok');
    cmp.useDemo();
    expect(cmp.form.value).toEqual({ username: 'demo', password: 'Demo123!' });
  });
});
