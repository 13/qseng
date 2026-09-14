import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, shareReplay, tap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthApi, AuthResponse } from '../api/generated';

export type { AuthResponse } from '../api/generated';

const STORAGE_KEYS = ['token', 'refreshToken', 'userId', 'displayName', 'username', 'isAdmin'] as const;

/**
 * Session state (signals) persisted in localStorage, backed by the generated
 * AuthApi. A pending-activation registration yields no session.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);

  private readonly _token        = signal<string | null>(localStorage.getItem('token'));
  private readonly _refreshToken = signal<string | null>(localStorage.getItem('refreshToken'));
  private readonly _userId       = signal<string | null>(localStorage.getItem('userId'));
  private readonly _displayName  = signal<string | null>(localStorage.getItem('displayName'));
  private readonly _username     = signal<string | null>(localStorage.getItem('username'));
  private readonly _isAdmin      = signal<boolean>(localStorage.getItem('isAdmin') === 'true');

  readonly token       = this._token.asReadonly();
  readonly userId      = this._userId.asReadonly();
  readonly displayName = this._displayName.asReadonly();
  readonly username    = this._username.asReadonly();
  readonly isAdmin     = this._isAdmin.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());

  /** In-flight refresh, shared so concurrent 401s trigger exactly one call. */
  private refresh$: Observable<AuthResponse> | null = null;

  login(username: string, password: string): Observable<AuthResponse> {
    return this.api.authLogin({ body: { username, password } }).pipe(tap(r => this.store(r)));
  }

  register(username: string, password: string, displayName?: string, email?: string): Observable<AuthResponse> {
    return this.api
      .authRegister({ body: { username, password, displayName: displayName ?? null, email: email ?? null } })
      .pipe(tap(r => this.store(r)));
  }

  /** The server rotates the refresh token on every call, so the response is always stored. */
  refreshSession(): Observable<AuthResponse> {
    if (this.refresh$) return this.refresh$;

    const refreshToken = this._refreshToken();
    if (!refreshToken) return throwError(() => new Error('No refresh token'));

    this.refresh$ = this.api.authRefresh({ body: { refreshToken } }).pipe(
      tap(r => this.store(r)),
      catchError(err => {
        this.clear();
        return throwError(() => err);
      }),
      tap({ finalize: () => (this.refresh$ = null) }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.refresh$;
  }

  /** Adopts a session minted by another endpoint (e.g. password change). */
  adoptSession(r: AuthResponse) { this.store(r); }

  /** Revokes the refresh token server-side, then clears local state regardless. */
  logout() {
    const refreshToken = this._refreshToken();
    if (refreshToken) {
      this.api.authLogout({ body: { refreshToken } }).subscribe({ error: () => { /* error ignored on logout */ } });
    }
    this.clear();
  }

  clear() {
    this._token.set(null);
    this._refreshToken.set(null);
    this._userId.set(null);
    this._displayName.set(null);
    this._username.set(null);
    this._isAdmin.set(false);
    this.refresh$ = null;
    for (const key of STORAGE_KEYS) localStorage.removeItem(key);
  }

  private store(r: AuthResponse) {
    if (!r.accessToken) return; // pending activation: no session to persist
    const userId = r.userId ?? '';
    const displayName = r.displayName ?? '';
    const username = r.username ?? '';
    const isAdmin = r.isAdmin ?? false;

    this._token.set(r.accessToken);
    this._refreshToken.set(r.refreshToken ?? null);
    this._userId.set(userId);
    this._displayName.set(displayName);
    this._username.set(username);
    this._isAdmin.set(isAdmin);

    localStorage.setItem('token', r.accessToken);
    if (r.refreshToken) localStorage.setItem('refreshToken', r.refreshToken);
    localStorage.setItem('userId', userId);
    localStorage.setItem('displayName', displayName);
    localStorage.setItem('username', username);
    localStorage.setItem('isAdmin', String(isAdmin));
  }
}
