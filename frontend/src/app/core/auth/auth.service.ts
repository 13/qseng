import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AuthResponse {
  accessToken: string | null;
  refreshToken: string | null;
  expiresIn: number;
  userId: string;
  displayName: string;
  username: string;
  isAdmin: boolean;
  pendingActivation?: boolean;
}

const STORAGE_KEYS = ['token', 'refreshToken', 'userId', 'displayName', 'username', 'isAdmin'] as const;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

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

  login(username: string, password: string) {
    return this.http
      .post<AuthResponse>(`${environment.apiBase}/auth/login`, { username, password })
      .pipe(tap(r => this.store(r)));
  }

  register(username: string, password: string, displayName?: string, email?: string) {
    return this.http
      .post<AuthResponse>(`${environment.apiBase}/auth/register`, { username, password, displayName, email })
      .pipe(tap(r => this.store(r)));
  }

  /**
   * Exchanges the refresh token for a new access token. The server rotates the
   * refresh token on every call, so the response must always be stored.
   */
  refreshSession(): Observable<AuthResponse> {
    if (this.refresh$) return this.refresh$;

    const refreshToken = this._refreshToken();
    if (!refreshToken) return throwError(() => new Error('No refresh token'));

    this.refresh$ = this.http
      .post<AuthResponse>(`${environment.apiBase}/auth/refresh`, { refreshToken })
      .pipe(
        tap(r => this.store(r)),
        catchError(err => {
          this.clear();
          return throwError(() => err);
        }),
        // Late subscribers get the same result; the flag is cleared either way.
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
      this.http
        .post(`${environment.apiBase}/auth/logout`, { refreshToken })
        .subscribe({ error: () => {/* error ignored on logout */} });
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
    if (!r.accessToken) return; // pending activation — no session to persist
    this._token.set(r.accessToken);
    this._refreshToken.set(r.refreshToken);
    this._userId.set(r.userId);
    this._displayName.set(r.displayName);
    this._username.set(r.username);
    this._isAdmin.set(r.isAdmin);

    localStorage.setItem('token', r.accessToken);
    if (r.refreshToken) localStorage.setItem('refreshToken', r.refreshToken);
    localStorage.setItem('userId', r.userId);
    localStorage.setItem('displayName', r.displayName);
    localStorage.setItem('username', r.username);
    localStorage.setItem('isAdmin', String(r.isAdmin));
  }
}
