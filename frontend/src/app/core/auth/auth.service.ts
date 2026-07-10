import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AuthResponse {
  accessToken: string | null;
  userId: string;
  displayName: string;
  username: string;
  isAdmin: boolean;
  pendingActivation?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _token       = signal<string | null>(localStorage.getItem('token'));
  private readonly _userId      = signal<string | null>(localStorage.getItem('userId'));
  private readonly _displayName = signal<string | null>(localStorage.getItem('displayName'));
  private readonly _username    = signal<string | null>(localStorage.getItem('username'));
  private readonly _isAdmin     = signal<boolean>(localStorage.getItem('isAdmin') === 'true');

  readonly token        = this._token.asReadonly();
  readonly userId       = this._userId.asReadonly();
  readonly displayName  = this._displayName.asReadonly();
  readonly username     = this._username.asReadonly();
  readonly isAdmin      = this._isAdmin.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());

  constructor(private http: HttpClient) {}

  login(username: string, password: string) {
    return this.http.post<AuthResponse>(`${environment.apiBase}/auth/login`, { username, password })
      .pipe(tap(r => this.store(r)));
  }

  register(username: string, password: string, displayName?: string, email?: string) {
    return this.http.post<AuthResponse>(`${environment.apiBase}/auth/register`,
      { username, password, displayName, email })
      .pipe(tap(r => this.store(r)));
  }

  logout() {
    this._token.set(null);
    this._userId.set(null);
    this._displayName.set(null);
    this._username.set(null);
    this._isAdmin.set(false);
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('displayName');
    localStorage.removeItem('username');
    localStorage.removeItem('isAdmin');
  }

  private store(r: AuthResponse) {
    if (!r.accessToken) return; // pending activation — no session to persist
    this._token.set(r.accessToken);
    this._userId.set(r.userId);
    this._displayName.set(r.displayName);
    this._username.set(r.username);
    this._isAdmin.set(r.isAdmin);
    localStorage.setItem('token', r.accessToken);
    localStorage.setItem('userId', r.userId);
    localStorage.setItem('displayName', r.displayName);
    localStorage.setItem('username', r.username);
    localStorage.setItem('isAdmin', String(r.isAdmin));
  }
}
