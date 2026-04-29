import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AuthResponse {
  accessToken: string;
  userId: string;
  displayName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _token = signal<string | null>(localStorage.getItem('token'));
  private readonly _userId = signal<string | null>(localStorage.getItem('userId'));
  private readonly _displayName = signal<string | null>(localStorage.getItem('displayName'));

  readonly token = this._token.asReadonly();
  readonly userId = this._userId.asReadonly();
  readonly displayName = this._displayName.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());

  constructor(private http: HttpClient) {}

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${environment.apiBase}/auth/login`, { email, password })
      .pipe(tap(r => this.store(r)));
  }

  register(email: string, password: string, displayName: string) {
    return this.http.post<AuthResponse>(`${environment.apiBase}/auth/register`, { email, password, displayName })
      .pipe(tap(r => this.store(r)));
  }

  logout() {
    this._token.set(null); this._userId.set(null); this._displayName.set(null);
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('displayName');
  }

  private store(r: AuthResponse) {
    this._token.set(r.accessToken);
    this._userId.set(r.userId);
    this._displayName.set(r.displayName);
    localStorage.setItem('token', r.accessToken);
    localStorage.setItem('userId', r.userId);
    localStorage.setItem('displayName', r.displayName);
  }
}
