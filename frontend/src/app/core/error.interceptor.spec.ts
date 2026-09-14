import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { errorInterceptor } from './error.interceptor';
import { AuthResponse, AuthService } from './auth/auth.service';
import { ToastService } from './ui/toast.service';
import { I18nService } from './i18n/i18n.service';

function setup(auth: Partial<AuthService>) {
  const toast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
  const router = { navigate: vi.fn(), url: '/trees/1' };
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting(),
      { provide: AuthService, useValue: { isAuthenticated: () => true, clear: vi.fn(), refreshSession: vi.fn(), ...auth } },
      { provide: ToastService, useValue: toast },
      { provide: Router, useValue: router },
      { provide: I18nService, useValue: { t: (k: string) => k } }
    ]
  });
  return { http: TestBed.inject(HttpClient), ctrl: TestBed.inject(HttpTestingController), toast, router, auth: TestBed.inject(AuthService) };
}

describe('errorInterceptor', () => {
  it('refreshes once on 401 and replays with the new token', () => {
    const { http, ctrl, auth } = setup({ refreshSession: vi.fn(() => of({ accessToken: 'new' } as unknown as AuthResponse)) });
    let body: unknown;
    http.get('/api/v1/trees').subscribe(b => (body = b));
    ctrl.expectOne('/api/v1/trees').flush('', { status: 401, statusText: 'u' });
    const replay = ctrl.expectOne('/api/v1/trees');
    expect(replay.request.headers.get('Authorization')).toBe('Bearer new');
    replay.flush([]);
    expect(body).toEqual([]);
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('ends the session with returnUrl when refresh fails', () => {
    const { http, ctrl, auth, router } = setup({ refreshSession: vi.fn(() => throwError(() => new Error('nope'))) });
    http.get('/api/v1/trees').subscribe({ error: () => {} });
    ctrl.expectOne('/api/v1/trees').flush('', { status: 401, statusText: 'u' });
    expect(auth.clear).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/trees/1' } });
  });

  it('toasts on 403 and 5xx but rethrows 400', () => {
    const { http, ctrl, toast } = setup({});
    http.get('/a').subscribe({ error: () => {} });
    ctrl.expectOne('/a').flush({ title: 'Forbidden', status: 403 }, { status: 403, statusText: 'f' });
    http.get('/b').subscribe({ error: () => {} });
    ctrl.expectOne('/b').flush({ title: 'Internal server error.', status: 500 }, { status: 500, statusText: 's' });
    let caught: unknown;
    http.get('/c').subscribe({ error: e => (caught = e) });
    ctrl.expectOne('/c').flush({ status: 400, errors: { x: ['bad'] } }, { status: 400, statusText: 'b' });
    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenNthCalledWith(1, 'Forbidden');
    expect(caught).toBeDefined();
  });
});
