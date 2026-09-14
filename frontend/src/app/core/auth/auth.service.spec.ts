import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthResponse, AuthService } from './auth.service';

function session(overrides: Partial<AuthResponse> = {}): AuthResponse {
  return {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresIn: 3600,
    userId: 'u1',
    displayName: 'Demo',
    username: 'demo',
    isAdmin: false,
    ...overrides
  };
}

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AuthService]
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  it('stores the session after login', () => {
    auth.login('demo', 'pw').subscribe();
    http.expectOne(r => r.url.endsWith('/auth/login')).flush(session());

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.token()).toBe('access-1');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-1');
  });

  it('does not create a session for a pending-activation registration', () => {
    auth.register('newbie', 'password1').subscribe();
    http.expectOne(r => r.url.endsWith('/auth/register'))
      .flush(session({ accessToken: null, refreshToken: null, pendingActivation: true }));

    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('stores the rotated refresh token on refresh', () => {
    auth.login('demo', 'pw').subscribe();
    http.expectOne(r => r.url.endsWith('/auth/login')).flush(session());

    auth.refreshSession().subscribe();
    const req = http.expectOne(r => r.url.endsWith('/auth/refresh'));
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    req.flush(session({ accessToken: 'access-2', refreshToken: 'refresh-2' }));

    expect(auth.token()).toBe('access-2');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-2');
  });

  it('issues only one network refresh for concurrent callers', () => {
    auth.login('demo', 'pw').subscribe();
    http.expectOne(r => r.url.endsWith('/auth/login')).flush(session());

    const results: string[] = [];
    auth.refreshSession().subscribe(r => results.push(r.accessToken!));
    auth.refreshSession().subscribe(r => results.push(r.accessToken!));

    // A second in-flight request would mean each queued 401 burns a rotation.
    http.expectOne(r => r.url.endsWith('/auth/refresh'))
      .flush(session({ accessToken: 'access-2', refreshToken: 'refresh-2' }));

    expect(results).toEqual(['access-2', 'access-2']);
  });

  it('clears the session when refresh fails', () => {
    auth.login('demo', 'pw').subscribe();
    http.expectOne(r => r.url.endsWith('/auth/login')).flush(session());

    auth.refreshSession().subscribe({ error: () => {} });
    http.expectOne(r => r.url.endsWith('/auth/refresh'))
      .flush({ error: 'revoked' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('errors without attempting a request when there is no refresh token', () => {
    let errored = false;
    auth.refreshSession().subscribe({ error: () => (errored = true) });

    expect(errored).toBe(true);
    http.expectNone(r => r.url.endsWith('/auth/refresh'));
  });

  it('revokes the refresh token server-side on logout', () => {
    auth.login('demo', 'pw').subscribe();
    http.expectOne(r => r.url.endsWith('/auth/login')).flush(session());

    auth.logout();

    const req = http.expectOne(r => r.url.endsWith('/auth/logout'));
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('clears local state even if the logout call fails', () => {
    auth.login('demo', 'pw').subscribe();
    http.expectOne(r => r.url.endsWith('/auth/login')).flush(session());

    auth.logout();
    http.expectOne(r => r.url.endsWith('/auth/logout'))
      .flush('nope', { status: 500, statusText: 'Server Error' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('adopts a session minted by the password-change endpoint', () => {
    auth.adoptSession(session({ accessToken: 'access-9', refreshToken: 'refresh-9' }));

    expect(auth.token()).toBe('access-9');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-9');
  });
});
