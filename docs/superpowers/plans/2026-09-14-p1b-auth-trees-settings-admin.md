# P1b Auth, Trees, Settings, Admin Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the login, register, trees, settings and admin-users screens on Angular Material with typed Reactive Forms and the generated API client, replacing the legacy components in place.

**Architecture:** `AuthService` moves onto the generated `AuthApi` (same public surface, so the interceptors and shell are untouched). Each screen becomes a standalone Material component under `features/<area>/` using `FormBuilder.nonNullable`, `FormErrorsPipe`, `setServerErrors`, `ToastService`, `ConfirmDialogService`, `BreadcrumbService` and `LayoutService` from P1a. Dialogs replace inline forms (tree create/rename, admin create user, admin set password). A shared `AuthPageComponent` frames login and register. Route file paths and selectors are kept so `app.routes.ts` needs no change beyond nothing.

**Tech Stack:** Angular 21.2 (zoneless), Angular Material 21.2.14, Reactive Forms, Vitest via `@angular/build:unit-test`, generated client (`AuthApi`, `TreesApi`, `UserApi`, `AdminApi`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-14-p1-material-rewrite-design.md` §4 (Login/Register, Trees, Settings, Admin users), §2 tokens, §3 services.
- Branch `feat/material-rewrite` (P1a HEAD 7ea4bc3). Do not touch `features/persons/**`, `features/timeline/**`, `features/import/**`, `features/trees/tree-view/**`, `features/trees/tree-search.component.ts` (P1c/P1d) or `core/api/api-client.service.ts` (deleted in P1e).
- No `ngModel` in new code; typed `FormBuilder.nonNullable` only. No native `confirm()`/`alert()`. No emoji in templates or in the i18n strings these screens use.
- Every user-facing string goes through `t()` / `translate` with a `TranslationKey`; add keys to BOTH `frontend/public/assets/i18n/en.json` and `de.json`, keep them alphabetically sorted, then run `npm run gen:i18n --prefix frontend`.
- Generated client method shapes (from `core/api/generated`):
  - `AuthApi.authLogin({ body: LoginRequest })`, `authRegister({ body: RegisterRequest })`, `authRefresh({ body: RefreshRequest })`, `authLogout({ body: RefreshRequest })` → `Observable<AuthResponse>` / `void`.
  - `TreesApi.treesGetAll()`, `treesCreate({ body: CreateTreeRequest })`, `treesUpdate({ id, body: UpdateTreeRequest })`, `treesDelete({ id })`.
  - `UserApi.userGetProfile()`, `userChangePassword({ body: ChangePasswordRequest })` → `AuthResponse`, `userChangeLanguage({ body: ChangeLanguageRequest })`, `userExport()` → `ExportDto`, `userDeleteData({ body: DeleteDataRequest })`, `userDeleteAccount({ body: DeleteAccountRequest })`.
  - `AdminApi.adminListUsers()`, `adminCreateUser({ body: AdminCreateUserRequest })`, `adminSetActive({ id, body: SetActiveRequest })`, `adminSetAdmin({ id, body: SetAdminRequest })`, `adminChangePassword({ id, body: AdminChangePasswordRequest })`, `adminDeleteUser({ id })`, `adminGetSettings()`, `adminSetRegistration({ body: SetRegistrationRequest })`.
  - Generated model fields are all optional (`TreeDto.name?: string`, `AuthResponse.accessToken?: string | null`, …); templates must use `??` fallbacks and never assume presence.
- `AuthService` public surface consumed elsewhere (must stay): `token()`, `userId()`, `displayName()`, `username()`, `isAdmin()`, `isAuthenticated()`, `login(username, password)`, `register(username, password, displayName?, email?)`, `refreshSession()`, `adoptSession(r)`, `logout()`, `clear()`, exported type `AuthResponse`.
- Material selectors: `matButton`, `matButton="filled"|"outlined"|"tonal"`, `matIconButton`, `matFab`/`matMiniFab`, `mat-form-field` + `matInput`, `mat-error`, `mat-chip-set`/`mat-chip`, `mat-card`, `mat-menu` + `mat-menu-item`, `mat-slide-toggle`, `mat-button-toggle-group`, `mat-table`, `mat-checkbox`, `mat-dialog-*`, `matTooltip`.
- `cd` is broken in the sandbox shell; use `--prefix`, `-C`, absolute paths. `ng test` always with `--watch=false` inside `timeout 180`; stale workers: `ps -eo pid,args | grep "suppress-warn[i]ng" | awk '{print $1}' | xargs -r kill -9`. Never `pkill -f` a pattern in your own command line.
- Test baseline at start: 18 files / 75 tests. Production build must stay under budget (600 kB initial warn).
- Commit messages end with the attribution lines from the session's system reminder.

## File structure produced by this plan

```
frontend/src/app/core/auth/auth.service.ts              on AuthApi (rewrite)
frontend/src/app/features/auth/auth-page.component.ts   shared frame (brand, card, language toggle)
frontend/src/app/features/auth/login.component.ts       rewrite + login.component.spec.ts
frontend/src/app/features/auth/register.component.ts    rewrite + register.component.spec.ts
frontend/src/app/features/trees/tree-form-dialog.component.ts + spec
frontend/src/app/features/trees/tree-list.component.ts  rewrite + spec
frontend/src/app/features/settings/settings.component.ts rewrite + spec
frontend/src/app/features/admin/user-form-dialog.component.ts
frontend/src/app/features/admin/user-password-dialog.component.ts + admin-dialogs.spec.ts
frontend/src/app/features/admin/admin-users.component.ts rewrite + spec
frontend/public/assets/i18n/{en,de}.json                keys added/changed
frontend/src/app/core/i18n/translation-keys.ts          regenerated
```

---

### Task 1: AuthService on the generated AuthApi

**Files:**
- Modify: `frontend/src/app/core/auth/auth.service.ts` (rewrite)
- Modify: `frontend/src/app/core/auth/auth.service.spec.ts` (imports only)

**Interfaces:**
- Consumes: `AuthApi` from `../api/generated`, models `AuthResponse`, `LoginRequest`, `RegisterRequest`, `RefreshRequest`.
- Produces: same public surface as before (see Global Constraints); `AuthResponse` is now re-exported from the generated models (`export type { AuthResponse } from '../api/generated';`).

- [ ] **Step 1: Point the spec at the generated type and run it (RED expected only if the rewrite changes behavior)**

In `frontend/src/app/core/auth/auth.service.spec.ts` change the import line to:
```ts
import { AuthService } from './auth.service';
import { AuthResponse } from '../api/generated';
```
Run: `timeout 150 npx --prefix /home/ben/repo/qseng/frontend ng test --watch=false --include='**/auth.service.spec.ts' 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests |×"`
Expected: `Tests  9 passed (9)` (the spec is behavior-based and stays green before and after; that is intended, this task is a refactor).

- [ ] **Step 2: Rewrite the service**

`frontend/src/app/core/auth/auth.service.ts`:
```ts
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
```

- [ ] **Step 3: Run the auth spec and the interceptor specs**

Run: `timeout 150 npx --prefix /home/ben/repo/qseng/frontend ng test --watch=false --include='**/auth.service.spec.ts' --include='**/error.interceptor.spec.ts' --include='**/interceptor-order.spec.ts' 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests |Test Files|×"`
Expected: `Test Files  3 passed (3)` / `Tests  13 passed (13)`.

- [ ] **Step 4: Build (legacy screens still compile against the same surface)**

Run: `npx --prefix /home/ben/repo/qseng/frontend ng build --configuration production 2>&1 | grep -E "complete|error"`
Expected: `Application bundle generation complete`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/auth
git commit -m "refactor(auth): AuthService on the generated AuthApi; AuthResponse re-exported from the contract"
```

---

### Task 2: Auth page frame and Login

**Files:**
- Create: `frontend/src/app/features/auth/auth-page.component.ts`
- Modify: `frontend/src/app/features/auth/login.component.ts` (rewrite)
- Create: `frontend/src/app/features/auth/login.component.spec.ts`
- Modify: `frontend/public/assets/i18n/en.json`, `de.json`; regenerate `translation-keys.ts`

**Interfaces:**
- Produces: `AuthPageComponent` (`<qs-auth-page [title]="..." [tagline]="...">` with content projection) used by login and register.
- Consumes: `AuthService.login`, `I18nService`, `FormErrorsPipe`, `problemMessage`, `setServerErrors`.
- Login honours `?returnUrl=` (only relative paths starting with a single `/`).

- [ ] **Step 1: i18n keys**

Add to `en.json` (keep sorted):
```json
"auth.hidePassword": "Hide password",
"auth.showPassword": "Show password",
"login.demoFill": "Use demo account",
"login.title": "Sign in"
```
`de.json`:
```json
"auth.hidePassword": "Passwort verbergen",
"auth.showPassword": "Passwort anzeigen",
"login.demoFill": "Demo-Konto verwenden",
"login.title": "Anmelden"
```
Run: `npm run gen:i18n --prefix /home/ben/repo/qseng/frontend` → `generated 301 translation keys`.

- [ ] **Step 2: Auth page frame**

`frontend/src/app/features/auth/auth-page.component.ts`:
```ts
import { Component, inject, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { I18nService, Lang } from '../../core/i18n/i18n.service';

/** Centered card with brand header and language toggle; login/register project their form into it. */
@Component({
  selector: 'qs-auth-page',
  imports: [MatCardModule, MatIconModule, MatButtonToggleModule],
  template: `
    <div class="qs-auth">
      <mat-card appearance="outlined" class="qs-auth__card">
        <div class="qs-auth__brand">
          <mat-icon aria-hidden="true">park</mat-icon>
          <span class="qs-display qs-auth__wordmark">Qseng</span>
        </div>
        <h1 class="qs-auth__title" tabindex="-1">{{ title() }}</h1>
        @if (tagline()) { <p class="qs-muted qs-auth__tagline">{{ tagline() }}</p> }

        <ng-content />

        <mat-button-toggle-group class="qs-auth__lang" hideSingleSelectionIndicator
                                 [value]="i18n.lang()" (change)="setLang($event.value)"
                                 aria-label="Language">
          <mat-button-toggle value="de">DE</mat-button-toggle>
          <mat-button-toggle value="en">EN</mat-button-toggle>
        </mat-button-toggle-group>
      </mat-card>
    </div>
  `,
  styles: [`
    .qs-auth { min-height: 100dvh; display: grid; place-items: center; padding: 24px var(--qs-gutter); background: var(--mat-sys-surface-container-low); }
    .qs-auth__card { width: 100%; max-width: 420px; padding: 32px 28px 24px; display: flex; flex-direction: column; gap: 12px; }
    .qs-auth__brand { display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--mat-sys-primary); }
    .qs-auth__wordmark { font-size: 1.6rem; color: var(--mat-sys-on-surface); }
    .qs-auth__title { text-align: center; margin-top: 4px; }
    .qs-auth__tagline { text-align: center; margin: -4px 0 8px; }
    .qs-auth__lang { align-self: center; margin-top: 8px; }
    @media (max-width: 599.98px) { .qs-auth__card { padding: 24px 18px 18px; } }
  `]
})
export class AuthPageComponent {
  readonly i18n = inject(I18nService);
  readonly title = input.required<string>();
  readonly tagline = input<string>('');
  setLang(lang: Lang) { this.i18n.setLang(lang); }
}
```

- [ ] **Step 3: Write the failing login spec**

`frontend/src/app/features/auth/login.component.spec.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify it fails**

Run: `timeout 150 npx --prefix /home/ben/repo/qseng/frontend ng test --watch=false --include='**/login.component.spec.ts' 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "×|error TS|Tests "`
Expected: failures (`form`, `error`, `useDemo` do not exist on the legacy component).

- [ ] **Step 5: Rewrite the login component**

`frontend/src/app/features/auth/login.component.ts`:
```ts
import { Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';
import { problemMessage } from '../../core/api/problem-details';
import { AuthPageComponent } from './auth-page.component';

/** Only same-origin absolute paths are honoured; anything else falls back to /trees. */
export function safeReturnUrl(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/trees';
}

@Component({
  selector: 'qs-login',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule,
            MatChipsModule, TranslatePipe, FormErrorsPipe, AuthPageComponent],
  template: `
    <qs-auth-page [title]="'login.title' | translate" [tagline]="'login.tagline' | translate">
      <form [formGroup]="form" (ngSubmit)="submit()" class="qs-auth-form" novalidate>
        <mat-form-field>
          <mat-label>{{ 'login.username' | translate }}</mat-label>
          <input matInput formControlName="username" autocomplete="username">
          <mat-error>{{ form.controls.username.errors | formErrors }}</mat-error>
        </mat-form-field>

        <mat-form-field>
          <mat-label>{{ 'login.password' | translate }}</mat-label>
          <input matInput formControlName="password" [type]="hide() ? 'password' : 'text'" autocomplete="current-password">
          <button matIconButton matSuffix type="button" (click)="hide.set(!hide())"
                  [attr.aria-label]="(hide() ? 'auth.showPassword' : 'auth.hidePassword') | translate"
                  [attr.aria-pressed]="!hide()">
            <mat-icon>{{ hide() ? 'visibility' : 'visibility_off' }}</mat-icon>
          </button>
          <mat-error>{{ form.controls.password.errors | formErrors }}</mat-error>
        </mat-form-field>

        @if (error()) {
          <p class="qs-form-error" role="alert">{{ error() }}</p>
        }

        <button matButton="filled" type="submit" class="qs-auth-form__submit" [disabled]="loading()">
          {{ (loading() ? 'login.submitting' : 'login.submit') | translate }}
        </button>
      </form>

      <mat-chip-set class="qs-auth-demo" [attr.aria-label]="'login.demo' | translate">
        <mat-chip (click)="useDemo()" (keydown.enter)="useDemo()" role="button" tabindex="0">
          <mat-icon matChipAvatar>science</mat-icon>{{ 'login.demoFill' | translate }}
        </mat-chip>
      </mat-chip-set>

      <p class="qs-auth-footer qs-muted">
        {{ 'login.noAccount' | translate }} <a routerLink="/register">{{ 'login.register' | translate }}</a>
      </p>
    </qs-auth-page>
  `,
  styles: [`
    .qs-auth-form { display: flex; flex-direction: column; gap: 4px; }
    .qs-auth-form__submit { margin-top: 4px; }
    .qs-form-error { margin: 0 0 8px; color: var(--mat-sys-error); font-size: .9rem; }
    .qs-auth-demo { justify-content: center; margin-top: 8px; }
    .qs-auth-footer { text-align: center; margin: 8px 0 0; }
  `]
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(FormBuilder).nonNullable;

  /** Bound from the `?returnUrl=` query param by withComponentInputBinding(). */
  readonly returnUrl = input<string | null>(null);

  readonly form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });
  readonly hide = signal(true);
  readonly loading = signal(false);
  readonly error = signal('');

  useDemo() {
    this.form.setValue({ username: 'demo', password: 'Demo123!' });
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');
    const { username, password } = this.form.getRawValue();
    this.auth.login(username, password).subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
      error: e => {
        this.error.set(problemMessage(e, this.i18n.t('login.error')));
        this.loading.set(false);
      }
    });
  }
}
```

- [ ] **Step 6: Run the spec and the whole suite**

Run: `timeout 150 npx --prefix /home/ben/repo/qseng/frontend ng test --watch=false --include='**/login.component.spec.ts' 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Tests |×|error TS"`
Expected: `Tests  4 passed (4)`.
Run the full suite: expected `Test Files  19 passed (19)` / `Tests  79 passed (79)`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/features/auth frontend/public/assets/i18n frontend/src/app/core/i18n/translation-keys.ts
git commit -m "feat(auth): Material login with typed form, password toggle, demo chip, safe returnUrl; shared auth page frame"
```

---

### Task 3: Register

**Files:**
- Modify: `frontend/src/app/features/auth/register.component.ts` (rewrite)
- Create: `frontend/src/app/features/auth/register.component.spec.ts`
- Modify: i18n JSON (`register.pendingTitle` loses the check mark), regenerate keys

**Interfaces:**
- Consumes: `AuthService.register`, `AuthPageComponent`, `setServerErrors`, `problemMessage`.

- [ ] **Step 1: i18n**

Change in `en.json`: `"register.pendingTitle": "Account created"`; in `de.json` the same key loses its trailing check mark if present (`"Konto erstellt"`). Run `npm run gen:i18n --prefix /home/ben/repo/qseng/frontend`.

- [ ] **Step 2: Failing spec**

`frontend/src/app/features/auth/register.component.spec.ts`:
```ts
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
```

- [ ] **Step 3: Run to verify it fails**

Run the spec with `--include='**/register.component.spec.ts'`. Expected: failures (`form`, `pending` missing / wrong types).

- [ ] **Step 4: Rewrite the component**

`frontend/src/app/features/auth/register.component.ts`:
```ts
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';
import { setServerErrors } from '../../core/forms/server-errors';
import { isValidationProblem, problemMessage } from '../../core/api/problem-details';
import { AuthPageComponent } from './auth-page.component';

@Component({
  selector: 'qs-register',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule,
            TranslatePipe, FormErrorsPipe, AuthPageComponent],
  template: `
    <qs-auth-page [title]="'register.title' | translate" [tagline]="'register.tagline' | translate">
      @if (pending()) {
        <div class="qs-pending" role="status">
          <mat-icon aria-hidden="true">mark_email_read</mat-icon>
          <p class="qs-pending__title">{{ 'register.pendingTitle' | translate }}</p>
          <p class="qs-muted">{{ 'register.pendingHint' | translate }}</p>
          <a matButton="filled" routerLink="/login">{{ 'register.login' | translate }}</a>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="qs-auth-form" novalidate>
          <mat-form-field>
            <mat-label>{{ 'register.username' | translate }}</mat-label>
            <input matInput formControlName="username" autocomplete="username">
            <mat-error>{{ form.controls.username.errors | formErrors }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'register.displayName' | translate }}</mat-label>
            <input matInput formControlName="displayName" autocomplete="name">
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'register.email' | translate }} ({{ 'optional' | translate }})</mat-label>
            <input matInput formControlName="email" type="email" autocomplete="email">
            <mat-error>{{ form.controls.email.errors | formErrors }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'register.password' | translate }}</mat-label>
            <input matInput formControlName="password" [type]="hide() ? 'password' : 'text'" autocomplete="new-password">
            <button matIconButton matSuffix type="button" (click)="hide.set(!hide())"
                    [attr.aria-label]="(hide() ? 'auth.showPassword' : 'auth.hidePassword') | translate" [attr.aria-pressed]="!hide()">
              <mat-icon>{{ hide() ? 'visibility' : 'visibility_off' }}</mat-icon>
            </button>
            <mat-hint>{{ 'register.passwordHint' | translate }}</mat-hint>
            <mat-error>{{ form.controls.password.errors | formErrors }}</mat-error>
          </mat-form-field>

          @if (error()) { <p class="qs-form-error" role="alert">{{ error() }}</p> }

          <button matButton="filled" type="submit" class="qs-auth-form__submit" [disabled]="loading()">
            {{ (loading() ? 'register.submitting' : 'register.submit') | translate }}
          </button>
        </form>
      }

      <p class="qs-auth-footer qs-muted">
        {{ 'register.haveAccount' | translate }} <a routerLink="/login">{{ 'register.login' | translate }}</a>
      </p>
    </qs-auth-page>
  `,
  styles: [`
    .qs-auth-form { display: flex; flex-direction: column; gap: 4px; }
    .qs-auth-form__submit { margin-top: 8px; }
    .qs-form-error { margin: 0 0 8px; color: var(--mat-sys-error); font-size: .9rem; }
    .qs-auth-footer { text-align: center; margin: 8px 0 0; }
    .qs-pending { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 8px 0 16px; }
    .qs-pending mat-icon { font-size: 40px; width: 40px; height: 40px; color: var(--mat-sys-primary); }
    .qs-pending__title { font-weight: 500; margin: 0; }
  `]
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly form = this.fb.group({
    username: ['', Validators.required],
    displayName: [''],
    email: ['', Validators.email],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });
  readonly hide = signal(true);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly pending = signal(false);

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');
    const v = this.form.getRawValue();
    this.auth.register(v.username, v.password, v.displayName || undefined, v.email || undefined).subscribe({
      next: r => {
        if (r.pendingActivation) { this.pending.set(true); this.loading.set(false); }
        else void this.router.navigateByUrl('/trees');
      },
      error: e => {
        if (isValidationProblem(e.error)) {
          const rest = setServerErrors(this.form, e.error);
          if (rest.length) this.error.set(rest.join(' '));
        } else {
          this.error.set(problemMessage(e, this.i18n.t('register.error')));
        }
        this.loading.set(false);
      }
    });
  }
}
```

- [ ] **Step 5: Run the spec and the suite**

Expected: spec `Tests  4 passed (4)`; full suite `Test Files  20 passed (20)` / `Tests  83 passed (83)`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/auth frontend/public/assets/i18n frontend/src/app/core/i18n/translation-keys.ts
git commit -m "feat(auth): Material register with validation, pending-activation state, server error mapping"
```

---

### Task 4: Trees list and tree dialog

**Files:**
- Create: `frontend/src/app/features/trees/tree-form-dialog.component.ts` + `tree-form-dialog.component.spec.ts`
- Modify: `frontend/src/app/features/trees/tree-list.component.ts` (rewrite) + create `tree-list.component.spec.ts`
- Modify: i18n JSON + regenerate keys

**Interfaces:**
- `TreeFormDialogComponent` data: `{ name?: string; description?: string | null }` (undefined name = create); closes with `{ name: string; description: string | null } | undefined`.
- Consumes: `TreesApi`, `ConfirmDialogService`, `ToastService`, `BreadcrumbService`, `TranslatePipe`.

- [ ] **Step 1: i18n**

Change existing values (`en.json` / `de.json`):
```
"trees.new": "New tree"                     / "Neuer Stammbaum"
"trees.edit": "Rename"                      / "Umbenennen"
"trees.cancel": "Cancel"                    / "Abbrechen"
```
Add:
```json
"trees.emptyImport": "Import from text",
"trees.emptyTitle": "No trees yet",
"trees.emptyHint": "Create your first family tree or import one from a genealogy text.",
"trees.menu": "Tree actions",
"trees.new.rename": "Rename tree",
"trees.created.toast": "Tree created.",
"trees.deleted.toast": "Tree deleted.",
"trees.renamed.toast": "Tree renamed."
```
```json
"trees.emptyImport": "Aus Text importieren",
"trees.emptyTitle": "Noch keine Stammbäume",
"trees.emptyHint": "Lege deinen ersten Stammbaum an oder importiere ihn aus einem Genealogie-Text.",
"trees.menu": "Aktionen für Stammbaum",
"trees.new.rename": "Stammbaum umbenennen",
"trees.created.toast": "Stammbaum erstellt.",
"trees.deleted.toast": "Stammbaum gelöscht.",
"trees.renamed.toast": "Stammbaum umbenannt."
```
Run `npm run gen:i18n --prefix /home/ben/repo/qseng/frontend`.

- [ ] **Step 2: Dialog spec (failing)**

`frontend/src/app/features/trees/tree-form-dialog.component.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { TreeFormDialogComponent } from './tree-form-dialog.component';
import { I18nService } from '../../core/i18n/i18n.service';

describe('TreeFormDialogComponent', () => {
  it('prefills for rename, validates name, and closes with trimmed values', () => {
    const ref = { close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { name: 'Familie', description: null } },
        { provide: MatDialogRef, useValue: ref },
        { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }
      ]
    });
    const fixture = TestBed.createComponent(TreeFormDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    expect(cmp.isRename).toBe(true);
    expect(cmp.form.value.name).toBe('Familie');

    cmp.form.setValue({ name: '   ', description: '' });
    cmp.save();
    expect(ref.close).not.toHaveBeenCalled();

    cmp.form.setValue({ name: '  Escobar ', description: ' Tirol ' });
    cmp.save();
    expect(ref.close).toHaveBeenCalledWith({ name: 'Escobar', description: 'Tirol' });
  });
});
```

- [ ] **Step 3: Dialog component**

`frontend/src/app/features/trees/tree-form-dialog.component.ts`:
```ts
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';

export interface TreeFormData { name?: string; description?: string | null; }
export interface TreeFormResult { name: string; description: string | null; }

/** Rejects whitespace-only names. */
function notBlank(control: { value: string }) {
  return control.value.trim().length ? null : { required: true };
}

@Component({
  selector: 'qs-tree-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, TranslatePipe, FormErrorsPipe],
  template: `
    <h2 mat-dialog-title>{{ (isRename ? 'trees.new.rename' : 'trees.new.title') | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="qs-dialog-form">
        <mat-form-field>
          <mat-label>{{ 'trees.new.name' | translate }}</mat-label>
          <input matInput formControlName="name" cdkFocusInitial maxlength="120">
          <mat-error>{{ form.controls.name.errors | formErrors }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'trees.new.desc' | translate }} ({{ 'optional' | translate }})</mat-label>
          <textarea matInput formControlName="description" rows="2" maxlength="500"></textarea>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" (click)="ref.close()">{{ 'cancel' | translate }}</button>
        <button matButton="filled" type="submit">{{ (isRename ? 'trees.save' : 'trees.new.submit') | translate }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`.qs-dialog-form { display: flex; flex-direction: column; gap: 4px; min-width: min(420px, 90vw); }`]
})
export class TreeFormDialogComponent {
  readonly data = inject<TreeFormData>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<TreeFormDialogComponent, TreeFormResult | undefined>>(MatDialogRef);
  readonly isRename = this.data.name !== undefined;

  readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.data.name ?? '', [Validators.required, notBlank]],
    description: [this.data.description ?? '']
  });

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.ref.close({ name: v.name.trim(), description: v.description.trim() || null });
  }
}
```

Run the dialog spec: expected `Tests  1 passed (1)`.

- [ ] **Step 4: Tree list spec (failing)**

`frontend/src/app/features/trees/tree-list.component.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TreeListComponent } from './tree-list.component';
import { TreesApi } from '../../core/api/generated';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { I18nService } from '../../core/i18n/i18n.service';

const trees = [
  { id: 't1', name: 'Familie Escobar', description: 'Fünf Generationen', createdAt: '2026-09-01T00:00:00Z', personCount: 42 },
  { id: 't2', name: 'Smith', description: null, createdAt: '2026-09-02T00:00:00Z', personCount: 0 }
];

function setup(list = trees, dialogResult: unknown = undefined, confirmResult = true) {
  const api = {
    treesGetAll: vi.fn(() => of(list)),
    treesCreate: vi.fn(() => of({ id: 't3', name: 'New', personCount: 0, createdAt: '2026-09-03T00:00:00Z' })),
    treesUpdate: vi.fn(() => of({ ...list[0], name: 'Renamed' })),
    treesDelete: vi.fn(() => of(undefined))
  };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };
  const confirm = { confirm: vi.fn(async () => confirmResult) };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: TreesApi, useValue: api },
      { provide: MatDialog, useValue: dialog },
      { provide: ConfirmDialogService, useValue: confirm },
      { provide: ToastService, useValue: toast },
      { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k, lang: () => 'en' } }
    ]
  });
  const fixture = TestBed.createComponent(TreeListComponent);
  fixture.detectChanges();
  return { fixture, api, dialog, confirm, toast, cmp: fixture.componentInstance };
}

describe('TreeListComponent', () => {
  it('renders one card per tree with name and people count', () => {
    const { fixture } = setup();
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('mat-card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Familie Escobar');
    expect(cards[0].textContent).toContain('42');
  });

  it('shows the empty state when there are no trees', () => {
    const { fixture } = setup([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('trees.emptyTitle');
  });

  it('creates a tree from the dialog result and reloads', async () => {
    const { cmp, api, toast } = setup(trees, { name: 'New', description: null });
    await cmp.openCreate();
    expect(api.treesCreate).toHaveBeenCalledWith({ body: { name: 'New', description: null } });
    expect(api.treesGetAll).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith('trees.created.toast');
  });

  it('deletes only after confirmation', async () => {
    const declined = setup(trees, undefined, false);
    await declined.cmp.remove(trees[0]);
    expect(declined.api.treesDelete).not.toHaveBeenCalled();

    const accepted = setup(trees, undefined, true);
    await accepted.cmp.remove(trees[0]);
    expect(accepted.api.treesDelete).toHaveBeenCalledWith({ id: 't1' });
  });
});
```

- [ ] **Step 5: Tree list component**

`frontend/src/app/features/trees/tree-list.component.ts`:
```ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { TreeDto, TreesApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { BreadcrumbService } from '../../core/ui/breadcrumb.service';
import { problemMessage } from '../../core/api/problem-details';
import { TreeFormDialogComponent, TreeFormData, TreeFormResult } from './tree-form-dialog.component';

@Component({
  selector: 'qs-tree-list',
  imports: [RouterLink, DatePipe, MatButtonModule, MatCardModule, MatIconModule, MatMenuModule, MatChipsModule, TranslatePipe],
  template: `
    <header class="qs-page-header">
      <h1 tabindex="-1">{{ 'trees.title' | translate }}</h1>
      <button matButton="filled" (click)="openCreate()">
        <mat-icon>add</mat-icon>{{ 'trees.new' | translate }}
      </button>
    </header>

    @if (loadError()) {
      <div class="qs-empty" role="alert">
        <mat-icon aria-hidden="true">error</mat-icon>
        <p>{{ loadError() }}</p>
        <button matButton="outlined" (click)="load()">{{ 'retry' | translate }}</button>
      </div>
    } @else if (!loading() && trees().length === 0) {
      <div class="qs-empty">
        <mat-icon aria-hidden="true" class="qs-empty__icon">forest</mat-icon>
        <h2>{{ 'trees.emptyTitle' | translate }}</h2>
        <p class="qs-muted">{{ 'trees.emptyHint' | translate }}</p>
        <div class="qs-empty__actions">
          <button matButton="filled" (click)="openCreate()"><mat-icon>add</mat-icon>{{ 'trees.new' | translate }}</button>
        </div>
      </div>
    } @else {
      <div class="qs-tree-grid">
        @for (tree of trees(); track tree.id) {
          <mat-card appearance="outlined" class="qs-tree-card">
            <mat-card-header>
              <mat-card-title>
                <a class="qs-tree-card__title qs-display" [routerLink]="['/trees', tree.id]">{{ tree.name }}</a>
              </mat-card-title>
              <button matIconButton [matMenuTriggerFor]="menu" [attr.aria-label]="'trees.menu' | translate" class="qs-tree-card__menu">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #menu="matMenu">
                <button mat-menu-item (click)="openRename(tree)"><mat-icon>edit</mat-icon>{{ 'trees.edit' | translate }}</button>
                <button mat-menu-item (click)="remove(tree)"><mat-icon>delete</mat-icon>{{ 'trees.delete' | translate }}</button>
              </mat-menu>
            </mat-card-header>
            <mat-card-content>
              @if (tree.description) { <p class="qs-tree-card__desc">{{ tree.description }}</p> }
              <div class="qs-tree-card__meta">
                <mat-chip-set>
                  <mat-chip disabled><mat-icon matChipAvatar>group</mat-icon>{{ tree.personCount ?? 0 }} {{ 'trees.persons' | translate }}</mat-chip>
                </mat-chip-set>
                <span class="qs-muted">{{ 'trees.created' | translate }} {{ tree.createdAt | date:'mediumDate' }}</span>
              </div>
            </mat-card-content>
            <mat-card-actions>
              <a matButton="tonal" [routerLink]="['/trees', tree.id]">{{ 'trees.open' | translate }}<mat-icon iconPositionEnd>arrow_forward</mat-icon></a>
            </mat-card-actions>
          </mat-card>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .qs-page-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .qs-tree-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .qs-tree-card { display: flex; flex-direction: column; }
    .qs-tree-card mat-card-header { align-items: flex-start; }
    .qs-tree-card__title { font-size: 1.2rem; color: var(--mat-sys-on-surface); }
    .qs-tree-card__menu { margin-left: auto; }
    .qs-tree-card__desc { margin: 8px 0; color: var(--mat-sys-on-surface-variant); }
    .qs-tree-card__meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: .85rem; margin-top: 8px; }
    .qs-tree-card mat-card-content { flex: 1; }
    .qs-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 48px 16px; }
    .qs-empty__icon { font-size: 56px; width: 56px; height: 56px; color: var(--mat-sys-primary); }
    .qs-empty__actions { display: flex; gap: 8px; margin-top: 8px; }
  `]
})
export class TreeListComponent implements OnInit {
  private readonly api = inject(TreesApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly crumbs = inject(BreadcrumbService);

  readonly trees = signal<TreeDto[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');

  ngOnInit() {
    this.crumbs.set([{ label: this.i18n.t('trees.title') }]);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.loadError.set('');
    this.api.treesGetAll().subscribe({
      next: t => { this.trees.set(t); this.loading.set(false); },
      error: e => { this.loadError.set(problemMessage(e, this.i18n.t('trees.err.load'))); this.loading.set(false); }
    });
  }

  async openCreate() {
    const result = await this.openForm({});
    if (!result) return;
    this.api.treesCreate({ body: result }).subscribe({
      next: () => { this.toast.success(this.i18n.t('trees.created.toast')); this.load(); },
      error: e => this.toast.error(problemMessage(e, this.i18n.t('trees.err.create')))
    });
  }

  async openRename(tree: TreeDto) {
    const result = await this.openForm({ name: tree.name ?? '', description: tree.description ?? null });
    if (!result || !tree.id) return;
    this.api.treesUpdate({ id: tree.id, body: result }).subscribe({
      next: () => { this.toast.success(this.i18n.t('trees.renamed.toast')); this.load(); },
      error: e => this.toast.error(problemMessage(e, this.i18n.t('trees.err.save')))
    });
  }

  async remove(tree: TreeDto) {
    const ok = await this.confirm.confirm({
      title: `${this.i18n.t('trees.delete')}: ${tree.name ?? ''}`,
      message: this.i18n.t('trees.delete.confirm'),
      confirmLabel: this.i18n.t('trees.delete'),
      destructive: true
    });
    if (ok !== true || !tree.id) return;
    this.api.treesDelete({ id: tree.id }).subscribe({
      next: () => { this.toast.success(this.i18n.t('trees.deleted.toast')); this.load(); },
      error: e => this.toast.error(problemMessage(e, this.i18n.t('trees.err.delete')))
    });
  }

  private openForm(data: TreeFormData): Promise<TreeFormResult | undefined> {
    const ref = this.dialog.open<TreeFormDialogComponent, TreeFormData, TreeFormResult | undefined>(TreeFormDialogComponent, { data, width: '480px', maxWidth: '95vw' });
    return firstValueFrom(ref.afterClosed());
  }
}
```

- [ ] **Step 6: Run specs and suite**

Expected: `tree-list` `Tests  4 passed (4)`; full suite `Test Files  22 passed (22)` / `Tests  88 passed (88)`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/features/trees/tree-list.component.ts frontend/src/app/features/trees/tree-list.component.spec.ts frontend/src/app/features/trees/tree-form-dialog.component.ts frontend/src/app/features/trees/tree-form-dialog.component.spec.ts frontend/public/assets/i18n frontend/src/app/core/i18n/translation-keys.ts
git commit -m "feat(trees): Material tree cards with create/rename dialog, confirmed delete, empty state"
```

---

### Task 5: Settings

**Files:**
- Modify: `frontend/src/app/features/settings/settings.component.ts` (rewrite)
- Create: `frontend/src/app/features/settings/settings.component.spec.ts`
- Modify: i18n JSON + regenerate keys

**Interfaces:**
- Consumes: `UserApi`, `AuthService.adoptSession/logout`, `ThemeService`, `I18nService`, `ConfirmDialogService` (`requirePassword`), `ToastService`, `BreadcrumbService`.

- [ ] **Step 1: i18n**

Add (`en` / `de`):
```json
"settings.appearance.auto": "System",
"settings.appearance.dark": "Dark",
"settings.appearance.hint": "Light, dark, or follow the system setting.",
"settings.appearance.light": "Light",
"settings.appearance.title": "Appearance",
"settings.danger.title": "Danger zone",
"settings.deleteData.done": "All your data was deleted.",
"settings.export.done": "Export downloaded.",
"settings.profile.email": "E-mail",
"settings.profile.member": "Member since",
"settings.profile.title": "Profile",
"settings.profile.username": "Username"
```
```json
"settings.appearance.auto": "System",
"settings.appearance.dark": "Dunkel",
"settings.appearance.hint": "Hell, dunkel oder wie die Systemeinstellung.",
"settings.appearance.light": "Hell",
"settings.appearance.title": "Darstellung",
"settings.danger.title": "Gefahrenzone",
"settings.deleteData.done": "Alle deine Daten wurden gelöscht.",
"settings.export.done": "Export heruntergeladen.",
"settings.profile.email": "E-Mail",
"settings.profile.member": "Mitglied seit",
"settings.profile.title": "Profil",
"settings.profile.username": "Benutzername"
```
Run `npm run gen:i18n --prefix /home/ben/repo/qseng/frontend`.

- [ ] **Step 2: Failing spec**

`frontend/src/app/features/settings/settings.component.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
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
      provideRouter([]),
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
```

- [ ] **Step 3: Rewrite the component**

`frontend/src/app/features/settings/settings.component.ts`:
```ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { UserApi, UserProfileDto } from '../../core/api/generated';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService, Lang } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeService } from '../../core/theme/theme.service';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { BreadcrumbService } from '../../core/ui/breadcrumb.service';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';
import { setServerErrors } from '../../core/forms/server-errors';
import { isValidationProblem, problemMessage } from '../../core/api/problem-details';

@Component({
  selector: 'qs-settings',
  imports: [ReactiveFormsModule, DatePipe, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule,
            MatButtonToggleModule, MatProgressBarModule, TranslatePipe, FormErrorsPipe],
  template: `
    <header class="qs-page-header"><h1 tabindex="-1">{{ 'settings.title' | translate }}</h1></header>

    <div class="qs-settings">
      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>{{ 'settings.profile.title' | translate }}</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (profile(); as p) {
            <dl class="qs-dl">
              <dt>{{ 'settings.profile.username' | translate }}</dt><dd>{{ p.username }}</dd>
              <dt>{{ 'settings.profile.email' | translate }}</dt><dd>{{ p.email || '–' }}</dd>
              <dt>{{ 'settings.profile.member' | translate }}</dt><dd>{{ p.createdAt | date:'mediumDate' }}</dd>
            </dl>
          } @else if (loadingProfile()) {
            <mat-progress-bar mode="indeterminate" />
          }
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>{{ 'settings.lang.title' | translate }}</mat-card-title></mat-card-header>
        <mat-card-content>
          <p class="qs-muted">{{ 'settings.lang.hint' | translate }}</p>
          <mat-button-toggle-group hideSingleSelectionIndicator [value]="i18n.lang()" (change)="setLang($event.value)">
            <mat-button-toggle value="de">Deutsch</mat-button-toggle>
            <mat-button-toggle value="en">English</mat-button-toggle>
          </mat-button-toggle-group>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>{{ 'settings.appearance.title' | translate }}</mat-card-title></mat-card-header>
        <mat-card-content>
          <p class="qs-muted">{{ 'settings.appearance.hint' | translate }}</p>
          <mat-button-toggle-group hideSingleSelectionIndicator [value]="theme.mode()" (change)="theme.setMode($event.value)">
            <mat-button-toggle value="light"><mat-icon>light_mode</mat-icon> {{ 'settings.appearance.light' | translate }}</mat-button-toggle>
            <mat-button-toggle value="dark"><mat-icon>dark_mode</mat-icon> {{ 'settings.appearance.dark' | translate }}</mat-button-toggle>
            <mat-button-toggle value="auto"><mat-icon>brightness_auto</mat-icon> {{ 'settings.appearance.auto' | translate }}</mat-button-toggle>
          </mat-button-toggle-group>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>{{ 'settings.password.title' | translate }}</mat-card-title></mat-card-header>
        <mat-card-content>
          <form [formGroup]="pwForm" (ngSubmit)="changePassword()" class="qs-form" novalidate>
            <mat-form-field>
              <mat-label>{{ 'settings.password.current' | translate }}</mat-label>
              <input matInput type="password" formControlName="current" autocomplete="current-password">
              <mat-error>{{ pwForm.controls.current.errors | formErrors }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'settings.password.new' | translate }}</mat-label>
              <input matInput type="password" formControlName="next" autocomplete="new-password">
              <mat-error>{{ pwForm.controls.next.errors | formErrors }}</mat-error>
            </mat-form-field>
            <div class="qs-form__actions">
              <button matButton="filled" type="submit" [disabled]="pwLoading()">
                {{ (pwLoading() ? 'settings.password.saving' : 'settings.password.save') | translate }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>{{ 'settings.export.title' | translate }}</mat-card-title></mat-card-header>
        <mat-card-content>
          <p class="qs-muted">{{ 'settings.export.hint' | translate }}</p>
          <button matButton="outlined" (click)="exportData()" [disabled]="exporting()">
            <mat-icon>download</mat-icon>{{ (exporting() ? 'settings.export.busy' : 'settings.export.btn') | translate }}
          </button>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined" class="qs-danger">
        <mat-card-header><mat-card-title>{{ 'settings.danger.title' | translate }}</mat-card-title></mat-card-header>
        <mat-card-content class="qs-danger__content">
          <div>
            <p class="qs-muted">{{ 'settings.deleteData.hint' | translate }}</p>
            <button matButton="outlined" class="qs-danger__btn" (click)="deleteAllData()">{{ 'settings.deleteData.btn' | translate }}</button>
          </div>
          <div>
            <p class="qs-muted">{{ 'settings.delete.hint' | translate }}</p>
            <button matButton="outlined" class="qs-danger__btn" (click)="deleteAccount()">{{ 'settings.delete.btn' | translate }}</button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .qs-page-header { margin-bottom: 20px; }
    .qs-settings { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; max-width: 900px; }
    .qs-dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0; }
    .qs-dl dt { color: var(--mat-sys-on-surface-variant); }
    .qs-dl dd { margin: 0; }
    .qs-form { display: flex; flex-direction: column; gap: 4px; }
    .qs-form__actions { display: flex; justify-content: flex-end; }
    .qs-danger { --mat-card-outlined-outline-color: var(--mat-sys-error); grid-column: 1 / -1; }
    .qs-danger__content { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
    .qs-danger__btn { --mat-button-outlined-label-text-color: var(--mat-sys-error); --mat-button-outlined-outline-color: var(--mat-sys-error); }
    mat-card-content > p:first-child { margin-top: 0; }
  `]
})
export class SettingsComponent implements OnInit {
  private readonly api = inject(UserApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly crumbs = inject(BreadcrumbService);
  readonly i18n = inject(I18nService);
  readonly theme = inject(ThemeService);

  readonly profile = signal<UserProfileDto | null>(null);
  readonly loadingProfile = signal(true);
  readonly pwLoading = signal(false);
  readonly exporting = signal(false);

  readonly pwForm = inject(FormBuilder).nonNullable.group({
    current: ['', Validators.required],
    next: ['', [Validators.required, Validators.minLength(8)]]
  });

  ngOnInit() {
    this.crumbs.set([{ label: this.i18n.t('settings.title') }]);
    this.api.userGetProfile().subscribe({
      next: p => {
        this.profile.set(p);
        if (p.language === 'de' || p.language === 'en') this.i18n.setLang(p.language);
        this.loadingProfile.set(false);
      },
      error: e => { this.loadingProfile.set(false); this.toast.error(problemMessage(e, this.i18n.t('err.load'))); }
    });
  }

  changePassword() {
    if (this.pwForm.invalid) { this.pwForm.markAllAsTouched(); return; }
    this.pwLoading.set(true);
    const { current, next } = this.pwForm.getRawValue();
    this.api.userChangePassword({ body: { currentPassword: current, newPassword: next } }).subscribe({
      next: session => {
        // The old session was revoked server-side; adopt the replacement so this tab stays signed in.
        this.auth.adoptSession(session);
        this.toast.success(this.i18n.t('settings.password.ok'));
        this.pwForm.reset({ current: '', next: '' });
        this.pwLoading.set(false);
      },
      error: e => {
        if (isValidationProblem(e.error)) setServerErrors(this.pwForm, e.error);
        else this.toast.error(problemMessage(e, this.i18n.t('err.save')));
        this.pwLoading.set(false);
      }
    });
  }

  setLang(lang: Lang) {
    this.i18n.setLang(lang);
    this.api.userChangeLanguage({ body: { language: lang } }).subscribe({
      next: () => this.toast.success(this.i18n.t('settings.lang.saved')),
      error: e => this.toast.error(problemMessage(e, this.i18n.t('err.save')))
    });
  }

  exportData() {
    this.exporting.set(true);
    this.api.userExport().subscribe({
      next: dto => {
        const blob = new Blob([JSON.stringify(dto, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qseng-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
        this.toast.success(this.i18n.t('settings.export.done'));
      },
      error: e => { this.exporting.set(false); this.toast.error(problemMessage(e, this.i18n.t('err.load'))); }
    });
  }

  async deleteAllData() {
    const password = await this.confirm.confirm({
      title: this.i18n.t('settings.deleteData.title'), message: this.i18n.t('settings.deleteData.hint'),
      confirmLabel: this.i18n.t('settings.deleteData.submit'), destructive: true, requirePassword: true
    });
    if (typeof password !== 'string') return;
    this.api.userDeleteData({ body: { password } }).subscribe({
      next: () => { this.toast.success(this.i18n.t('settings.deleteData.done')); void this.router.navigate(['/trees']); },
      error: e => this.toast.error(problemMessage(e, this.i18n.t('err.delete')))
    });
  }

  async deleteAccount() {
    const password = await this.confirm.confirm({
      title: this.i18n.t('settings.delete.title'), message: this.i18n.t('settings.delete.hint'),
      confirmLabel: this.i18n.t('settings.delete.submit'), destructive: true, requirePassword: true
    });
    if (typeof password !== 'string') return;
    this.api.userDeleteAccount({ body: { password } }).subscribe({
      next: () => { this.auth.logout(); void this.router.navigate(['/login']); },
      error: e => this.toast.error(problemMessage(e, this.i18n.t('err.delete')))
    });
  }
}
```
- [ ] **Step 4: Run spec and suite**

Expected: spec `Tests  3 passed (3)`; suite `Test Files  23 passed (23)` / `Tests  91 passed (91)`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/settings frontend/public/assets/i18n frontend/src/app/core/i18n/translation-keys.ts
git commit -m "feat(settings): Material settings cards: profile, language, appearance, password, export, danger zone with password-confirmed dialogs"
```

---

### Task 6: Admin users

**Files:**
- Create: `frontend/src/app/features/admin/user-form-dialog.component.ts`
- Create: `frontend/src/app/features/admin/user-password-dialog.component.ts`
- Create: `frontend/src/app/features/admin/admin-dialogs.spec.ts`
- Modify: `frontend/src/app/features/admin/admin-users.component.ts` (rewrite) + create `admin-users.component.spec.ts`
- Modify: i18n JSON + regenerate keys

**Interfaces:**
- `UserFormDialogComponent` closes with `AdminCreateUserRequest | undefined`.
- `UserPasswordDialogComponent` data `{ username: string }`, closes with `string | undefined` (new password).
- Consumes: `AdminApi`, `AuthService.userId`, `LayoutService.handset`, `ConfirmDialogService`, `ToastService`, `BreadcrumbService`.

- [ ] **Step 1: i18n**

Change values: `"admin.create.btn": "Create user"` / `"Benutzer anlegen"`; `"admin.create.username": "Username"` / `"Benutzername"`; `"admin.create.password": "Password"` / `"Passwort"`.
Add (`en` / `de`):
```json
"admin.actions": "User actions",
"admin.created.toast": "User created.",
"admin.deleted.toast": "User deleted.",
"admin.pw.saved": "Password changed.",
"admin.reg.hint": "Allow new visitors to create an account.",
"admin.saved.toast": "Saved."
```
```json
"admin.actions": "Benutzeraktionen",
"admin.created.toast": "Benutzer angelegt.",
"admin.deleted.toast": "Benutzer gelöscht.",
"admin.pw.saved": "Passwort geändert.",
"admin.reg.hint": "Neuen Besuchern erlauben, ein Konto anzulegen.",
"admin.saved.toast": "Gespeichert."
```
Run `npm run gen:i18n --prefix /home/ben/repo/qseng/frontend`.

- [ ] **Step 2: Dialogs spec (failing)**

`frontend/src/app/features/admin/admin-dialogs.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { UserFormDialogComponent } from './user-form-dialog.component';
import { UserPasswordDialogComponent } from './user-password-dialog.component';
import { I18nService } from '../../core/i18n/i18n.service';

const i18n = { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } };

describe('admin dialogs', () => {
  it('user form requires username and 8+ password and closes with a request body', () => {
    const ref = { close: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: MatDialogRef, useValue: ref }, { provide: MAT_DIALOG_DATA, useValue: {} }, i18n] });
    const cmp = TestBed.createComponent(UserFormDialogComponent).componentInstance;
    cmp.form.setValue({ username: 'x', displayName: '', email: '', password: 'short', isAdmin: false });
    cmp.save();
    expect(ref.close).not.toHaveBeenCalled();
    cmp.form.setValue({ username: 'newbie', displayName: '', email: 'n@x.de', password: 'password1', isAdmin: true });
    cmp.save();
    expect(ref.close).toHaveBeenCalledWith({ username: 'newbie', displayName: null, email: 'n@x.de', password: 'password1', isAdmin: true });
  });

  it('password dialog closes with the new password', () => {
    const ref = { close: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: MatDialogRef, useValue: ref }, { provide: MAT_DIALOG_DATA, useValue: { username: 'demo' } }, i18n] });
    const cmp = TestBed.createComponent(UserPasswordDialogComponent).componentInstance;
    cmp.form.setValue({ password: 'short' });
    cmp.save();
    expect(ref.close).not.toHaveBeenCalled();
    cmp.form.setValue({ password: 'longenough' });
    cmp.save();
    expect(ref.close).toHaveBeenCalledWith('longenough');
  });
});
```

- [ ] **Step 3: Dialog components**

`frontend/src/app/features/admin/user-form-dialog.component.ts`:
```ts
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AdminCreateUserRequest } from '../../core/api/generated';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';

@Component({
  selector: 'qs-user-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatCheckboxModule, TranslatePipe, FormErrorsPipe],
  template: `
    <h2 mat-dialog-title>{{ 'admin.create.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="qs-dialog-form">
        <mat-form-field>
          <mat-label>{{ 'admin.create.username' | translate }}</mat-label>
          <input matInput formControlName="username" autocomplete="off" cdkFocusInitial>
          <mat-error>{{ form.controls.username.errors | formErrors }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'admin.create.displayName' | translate }}</mat-label>
          <input matInput formControlName="displayName">
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'admin.create.email' | translate }}</mat-label>
          <input matInput formControlName="email" type="email">
          <mat-error>{{ form.controls.email.errors | formErrors }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'admin.create.password' | translate }}</mat-label>
          <input matInput formControlName="password" type="password" autocomplete="new-password">
          <mat-error>{{ form.controls.password.errors | formErrors }}</mat-error>
        </mat-form-field>
        <mat-checkbox formControlName="isAdmin">{{ 'admin.create.isAdmin' | translate }}</mat-checkbox>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" (click)="ref.close()">{{ 'admin.create.cancel' | translate }}</button>
        <button matButton="filled" type="submit">{{ 'admin.create.submit' | translate }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`.qs-dialog-form { display: flex; flex-direction: column; gap: 4px; min-width: min(440px, 90vw); }`]
})
export class UserFormDialogComponent {
  readonly ref = inject<MatDialogRef<UserFormDialogComponent, AdminCreateUserRequest | undefined>>(MatDialogRef);
  readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', Validators.required],
    displayName: [''],
    email: ['', Validators.email],
    password: ['', [Validators.required, Validators.minLength(8)]],
    isAdmin: [false]
  });

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.ref.close({ username: v.username.trim(), displayName: v.displayName.trim() || null, email: v.email.trim() || null, password: v.password, isAdmin: v.isAdmin });
  }
}
```

`frontend/src/app/features/admin/user-password-dialog.component.ts`:
```ts
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';

@Component({
  selector: 'qs-user-password-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, TranslatePipe, FormErrorsPipe],
  template: `
    <h2 mat-dialog-title>{{ title }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="qs-dialog-form">
        <mat-form-field>
          <mat-label>{{ 'admin.pw.placeholder' | translate }}</mat-label>
          <input matInput formControlName="password" type="password" autocomplete="new-password" cdkFocusInitial>
          <mat-error>{{ form.controls.password.errors | formErrors }}</mat-error>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" (click)="ref.close()">{{ 'admin.pw.cancel' | translate }}</button>
        <button matButton="filled" type="submit">{{ 'admin.pw.save' | translate }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`.qs-dialog-form { min-width: min(380px, 90vw); }`]
})
export class UserPasswordDialogComponent {
  readonly data = inject<{ username: string }>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<UserPasswordDialogComponent, string | undefined>>(MatDialogRef);
  readonly title = inject(I18nService).t('admin.pw.title').replace('__NAME__', this.data.username);
  readonly form = inject(FormBuilder).nonNullable.group({ password: ['', [Validators.required, Validators.minLength(8)]] });

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.ref.close(this.form.getRawValue().password);
  }
}
```
Run the dialogs spec: `Tests  2 passed (2)`.

- [ ] **Step 4: Admin users spec (failing)**

`frontend/src/app/features/admin/admin-users.component.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AdminUsersComponent } from './admin-users.component';
import { AdminApi } from '../../core/api/generated';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { LayoutService } from '../../core/ui/layout.service';
import { I18nService } from '../../core/i18n/i18n.service';

const users = [
  { id: 'me', username: 'demo', displayName: 'Demo Admin', email: 'd@x', isAdmin: true, isActive: true, language: 'en', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'u2', username: 'anna', displayName: 'Anna', email: null, isAdmin: false, isActive: false, language: 'de', createdAt: '2026-02-01T00:00:00Z' }
];

function setup(handset = false, confirmResult = true, dialogResult: unknown = undefined) {
  const api = {
    adminListUsers: vi.fn(() => of(users)),
    adminGetSettings: vi.fn(() => of({ registrationEnabled: true })),
    adminSetRegistration: vi.fn(() => of(undefined)),
    adminCreateUser: vi.fn(() => of(users[1])),
    adminSetActive: vi.fn(() => of(undefined)),
    adminSetAdmin: vi.fn(() => of(undefined)),
    adminChangePassword: vi.fn(() => of(undefined)),
    adminDeleteUser: vi.fn(() => of(undefined))
  };
  const confirm = { confirm: vi.fn(async () => confirmResult) };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AdminApi, useValue: api }, { provide: AuthService, useValue: { userId: () => 'me' } },
      { provide: ConfirmDialogService, useValue: confirm }, { provide: ToastService, useValue: toast },
      { provide: MatDialog, useValue: dialog }, { provide: LayoutService, useValue: { handset: () => handset } },
      { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k, lang: () => 'en' } }
    ]
  });
  const fixture = TestBed.createComponent(AdminUsersComponent);
  fixture.detectChanges();
  return { fixture, api, confirm, toast, dialog, cmp: fixture.componentInstance };
}

describe('AdminUsersComponent', () => {
  it('renders a table on desktop and cards on handset', () => {
    const desktop = setup(false);
    expect((desktop.fixture.nativeElement as HTMLElement).querySelector('table')).not.toBeNull();
    const handset = setup(true);
    expect((handset.fixture.nativeElement as HTMLElement).querySelector('table')).toBeNull();
    expect((handset.fixture.nativeElement as HTMLElement).querySelectorAll('mat-card').length).toBe(2);
  });

  it('toggles registration and reflects the new state', () => {
    const { cmp, api } = setup();
    cmp.toggleRegistration(false);
    expect(api.adminSetRegistration).toHaveBeenCalledWith({ body: { enabled: false } });
    expect(cmp.registrationEnabled()).toBe(false);
  });

  it('never offers destructive actions on the current user and confirms before deleting others', async () => {
    const { cmp, api, confirm } = setup(false, true);
    expect(cmp.isMe(users[0])).toBe(true);
    await cmp.deleteUser(users[1]);
    expect(confirm.confirm).toHaveBeenCalled();
    expect(api.adminDeleteUser).toHaveBeenCalledWith({ id: 'u2' });
  });

  it('creates a user from the dialog result', async () => {
    const { cmp, api, toast } = setup(false, true, { username: 'x', password: 'password1', isAdmin: false, displayName: null, email: null });
    await cmp.openCreate();
    expect(api.adminCreateUser).toHaveBeenCalledWith({ body: { username: 'x', password: 'password1', isAdmin: false, displayName: null, email: null } });
    expect(toast.success).toHaveBeenCalledWith('admin.created.toast');
  });
});
```

- [ ] **Step 5: Admin users component**

`frontend/src/app/features/admin/admin-users.component.ts`:
```ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { AdminApi, AdminCreateUserRequest, UserSummaryDto } from '../../core/api/generated';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { LayoutService } from '../../core/ui/layout.service';
import { BreadcrumbService } from '../../core/ui/breadcrumb.service';
import { problemMessage } from '../../core/api/problem-details';
import { UserFormDialogComponent } from './user-form-dialog.component';
import { UserPasswordDialogComponent } from './user-password-dialog.component';

@Component({
  selector: 'qs-admin-users',
  imports: [DatePipe, NgTemplateOutlet, MatTableModule, MatCardModule, MatButtonModule, MatIconModule, MatMenuModule, MatChipsModule,
            MatSlideToggleModule, MatProgressBarModule, TranslatePipe],
  template: `
    <header class="qs-page-header">
      <div>
        <h1 tabindex="-1">{{ 'admin.title' | translate }}</h1>
        <p class="qs-muted qs-page-header__sub">{{ registeredLabel() }}</p>
      </div>
      <div class="qs-page-header__actions">
        <mat-slide-toggle [checked]="registrationEnabled()" (change)="toggleRegistration($event.checked)">
          {{ 'admin.registration' | translate }}: {{ (registrationEnabled() ? 'admin.reg.on' : 'admin.reg.off') | translate }}
        </mat-slide-toggle>
        <button matButton="filled" (click)="openCreate()"><mat-icon>person_add</mat-icon>{{ 'admin.create.btn' | translate }}</button>
      </div>
    </header>

    @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
    @if (error()) { <p class="qs-form-error" role="alert">{{ error() }}</p> }

    @if (layout.handset()) {
      <div class="qs-user-cards">
        @for (u of users(); track u.id) {
          <mat-card appearance="outlined">
            <mat-card-header>
              <div matCardAvatar class="qs-avatar">{{ initials(u) }}</div>
              <mat-card-title>{{ u.displayName }} @if (isMe(u)) { <span class="qs-me">({{ 'admin.me' | translate }})</span> }</mat-card-title>
              <mat-card-subtitle>&#64;{{ u.username }} · {{ u.email || '–' }}</mat-card-subtitle>
              <ng-container *ngTemplateOutlet="actions; context: { $implicit: u }" />
            </mat-card-header>
            <mat-card-content>
              <ng-container *ngTemplateOutlet="chips; context: { $implicit: u }" />
              <p class="qs-muted">{{ 'admin.table.registered' | translate }}: {{ u.createdAt | date:'mediumDate' }}</p>
            </mat-card-content>
          </mat-card>
        }
      </div>
    } @else {
      <div class="qs-table-wrap">
        <table mat-table [dataSource]="users()" class="qs-users-table">
          <ng-container matColumnDef="user">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.table.user' | translate }}</th>
            <td mat-cell *matCellDef="let u">
              <div class="qs-user-cell">
                <span class="qs-avatar">{{ initials(u) }}</span>
                <div>
                  <div>{{ u.displayName }} @if (isMe(u)) { <span class="qs-me">({{ 'admin.me' | translate }})</span> }</div>
                  <div class="qs-muted">&#64;{{ u.username }}</div>
                </div>
              </div>
            </td>
          </ng-container>
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.table.email' | translate }}</th>
            <td mat-cell *matCellDef="let u">{{ u.email || '–' }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.table.status' | translate }} / {{ 'admin.table.role' | translate }}</th>
            <td mat-cell *matCellDef="let u"><ng-container *ngTemplateOutlet="chips; context: { $implicit: u }" /></td>
          </ng-container>
          <ng-container matColumnDef="registered">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.table.registered' | translate }}</th>
            <td mat-cell *matCellDef="let u">{{ u.createdAt | date:'mediumDate' }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="qs-col-actions">{{ 'admin.table.actions' | translate }}</th>
            <td mat-cell *matCellDef="let u" class="qs-col-actions"><ng-container *ngTemplateOutlet="actions; context: { $implicit: u }" /></td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </div>
    }

    <ng-template #chips let-u>
      <mat-chip-set>
        <mat-chip disabled [class.qs-chip-active]="u.isActive">{{ (u.isActive ? 'admin.status.active' : 'admin.status.inactive') | translate }}</mat-chip>
        <mat-chip disabled [class.qs-chip-admin]="u.isAdmin">{{ (u.isAdmin ? 'admin.role.admin' : 'admin.role.user') | translate }}</mat-chip>
        <mat-chip disabled>{{ u.language }}</mat-chip>
      </mat-chip-set>
    </ng-template>

    <ng-template #actions let-u>
      <button matIconButton [matMenuTriggerFor]="menu" [attr.aria-label]="'admin.actions' | translate" class="qs-row-menu">
        <mat-icon>more_vert</mat-icon>
      </button>
      <mat-menu #menu="matMenu">
        <button mat-menu-item (click)="toggleActive(u)" [disabled]="isMe(u)">
          <mat-icon>{{ u.isActive ? 'person_off' : 'how_to_reg' }}</mat-icon>{{ (u.isActive ? 'admin.action.deactivate' : 'admin.action.activate') | translate }}
        </button>
        <button mat-menu-item (click)="toggleAdmin(u)" [disabled]="isMe(u)">
          <mat-icon>{{ u.isAdmin ? 'remove_moderator' : 'add_moderator' }}</mat-icon>{{ (u.isAdmin ? 'admin.action.removeAdmin' : 'admin.action.makeAdmin') | translate }}
        </button>
        <button mat-menu-item (click)="changePassword(u)"><mat-icon>key</mat-icon>{{ 'admin.action.password' | translate }}</button>
        <button mat-menu-item (click)="deleteUser(u)" [disabled]="isMe(u)"><mat-icon>delete</mat-icon>{{ 'admin.action.delete' | translate }}</button>
      </mat-menu>
    </ng-template>
  `,
  styles: [`
    :host { display: block; }
    .qs-page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .qs-page-header__sub { margin: 4px 0 0; }
    .qs-page-header__actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .qs-table-wrap { overflow-x: auto; border: 1px solid var(--mat-sys-outline-variant); border-radius: var(--mat-sys-corner-medium); }
    .qs-users-table { width: 100%; }
    .qs-user-cell { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
    .qs-avatar { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); font-weight: 600; font-size: .8rem; }
    .qs-me { color: var(--mat-sys-on-surface-variant); font-size: .85rem; }
    .qs-col-actions { width: 56px; text-align: right; }
    .qs-chip-active { --mat-chip-disabled-label-text-color: var(--mat-sys-on-primary-container); --mat-chip-elevated-disabled-container-color: var(--mat-sys-primary-container); }
    .qs-chip-admin { --mat-chip-disabled-label-text-color: var(--mat-sys-on-tertiary-container); --mat-chip-elevated-disabled-container-color: var(--mat-sys-tertiary-container); }
    .qs-user-cards { display: grid; gap: 12px; }
    .qs-row-menu { margin-left: auto; }
    .qs-form-error { color: var(--mat-sys-error); }
  `]
})
export class AdminUsersComponent implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly crumbs = inject(BreadcrumbService);
  readonly i18n = inject(I18nService);
  readonly layout = inject(LayoutService);

  readonly columns = ['user', 'email', 'status', 'registered', 'actions'];
  readonly users = signal<UserSummaryDto[]>([]);
  readonly registrationEnabled = signal(false);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit() {
    this.crumbs.set([{ label: this.i18n.t('admin.title') }]);
    this.load();
  }

  registeredLabel() { return this.i18n.t('admin.registered').replace('__N__', String(this.users().length)); }
  isMe(u: UserSummaryDto) { return u.id === this.auth.userId(); }
  initials(u: UserSummaryDto) { return (u.displayName ?? u.username ?? '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.adminListUsers().subscribe({
      next: u => { this.users.set(u); this.loading.set(false); },
      error: e => { this.error.set(problemMessage(e, this.i18n.t('admin.err.load'))); this.loading.set(false); }
    });
    this.api.adminGetSettings().subscribe({ next: s => this.registrationEnabled.set(s.registrationEnabled ?? false) });
  }

  toggleRegistration(enabled: boolean) {
    const previous = this.registrationEnabled();
    this.registrationEnabled.set(enabled);
    this.api.adminSetRegistration({ body: { enabled } }).subscribe({
      next: () => this.toast.success(this.i18n.t('admin.saved.toast')),
      error: e => { this.registrationEnabled.set(previous); this.toast.error(problemMessage(e, this.i18n.t('err.save'))); }
    });
  }

  async openCreate() {
    const ref = this.dialog.open<UserFormDialogComponent, unknown, AdminCreateUserRequest | undefined>(UserFormDialogComponent, { data: {}, width: '520px', maxWidth: '95vw' });
    const body = await firstValueFrom(ref.afterClosed());
    if (!body) return;
    this.api.adminCreateUser({ body }).subscribe({
      next: () => { this.toast.success(this.i18n.t('admin.created.toast')); this.load(); },
      error: e => this.toast.error(problemMessage(e, this.i18n.t('err.save')))
    });
  }

  toggleActive(u: UserSummaryDto) {
    if (!u.id) return;
    this.api.adminSetActive({ id: u.id, body: { active: !u.isActive } }).subscribe({
      next: () => { this.toast.success(this.i18n.t('admin.saved.toast')); this.load(); },
      error: e => this.toast.error(problemMessage(e, this.i18n.t('err.save')))
    });
  }

  async toggleAdmin(u: UserSummaryDto) {
    if (!u.id) return;
    const key = u.isAdmin ? 'admin.confirm.removeAdmin' : 'admin.confirm.makeAdmin';
    const ok = await this.confirm.confirm({
      title: this.i18n.t(u.isAdmin ? 'admin.action.removeAdmin' : 'admin.action.makeAdmin'),
      message: this.i18n.dynamic(key).replace('__NAME__', u.username ?? ''),
      confirmLabel: this.i18n.t('save')
    });
    if (ok !== true) return;
    this.api.adminSetAdmin({ id: u.id, body: { admin: !u.isAdmin } }).subscribe({
      next: () => { this.toast.success(this.i18n.t('admin.saved.toast')); this.load(); },
      error: e => this.toast.error(problemMessage(e, this.i18n.t('err.save')))
    });
  }

  async changePassword(u: UserSummaryDto) {
    if (!u.id) return;
    const ref = this.dialog.open<UserPasswordDialogComponent, { username: string }, string | undefined>(UserPasswordDialogComponent, { data: { username: u.username ?? '' }, width: '440px', maxWidth: '95vw' });
    const newPassword = await firstValueFrom(ref.afterClosed());
    if (!newPassword) return;
    this.api.adminChangePassword({ id: u.id, body: { newPassword } }).subscribe({
      next: () => this.toast.success(this.i18n.t('admin.pw.saved')),
      error: e => this.toast.error(problemMessage(e, this.i18n.t('err.save')))
    });
  }

  async deleteUser(u: UserSummaryDto) {
    if (!u.id || this.isMe(u)) return;
    const ok = await this.confirm.confirm({
      title: this.i18n.t('admin.action.delete'),
      message: this.i18n.t('admin.confirm.delete').replace('__NAME__', u.username ?? ''),
      confirmLabel: this.i18n.t('delete'), destructive: true
    });
    if (ok !== true) return;
    this.api.adminDeleteUser({ id: u.id }).subscribe({
      next: () => { this.toast.success(this.i18n.t('admin.deleted.toast')); this.load(); },
      error: e => this.toast.error(problemMessage(e, this.i18n.t('err.delete')))
    });
  }
}
```
- [ ] **Step 6: Run specs and suite**

Expected: admin spec `Tests  4 passed (4)`; suite `Test Files  25 passed (25)` / `Tests  97 passed (97)`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/features/admin frontend/public/assets/i18n frontend/src/app/core/i18n/translation-keys.ts
git commit -m "feat(admin): Material user management: table/cards by breakpoint, registration toggle, create/password dialogs, confirmed role and delete actions"
```

---

### Task 7: Lint, build, visual verification

**Files:**
- Modify only if lint reports errors in the files this plan created/rewrote.
- Screenshots to `/tmp/claude-1000/-home-ben-repo-qseng/049c520f-1129-42f1-a523-488b58a5476d/scratchpad/shots/p1b/` (never into the repo).

- [ ] **Step 1: Lint**

Run: `npx --prefix /home/ben/repo/qseng/frontend ng lint 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "^/" | sed 's|.*/frontend/||'`
Expected: only files under `features/persons/`, `features/timeline/`, `features/trees/tree-view/`, `features/trees/tree-search.component.ts`, `features/import/` (untouched legacy). Fix any error in `features/auth/**`, `features/trees/tree-list*`, `features/trees/tree-form-dialog*`, `features/settings/**`, `features/admin/**`, `core/auth/auth.service.ts`.

- [ ] **Step 2: Build and grep gates for the rewritten screens**

Run: `npx --prefix /home/ben/repo/qseng/frontend ng build --configuration production 2>&1 | grep -E "complete|error|exceeded|Initial total"`
Expected: completion line, `Initial total` under 600 kB, no `exceeded`.

Run:
```bash
grep -rlE "ngModel|confirm\(|alert\(" /home/ben/repo/qseng/frontend/src/app/features/auth /home/ben/repo/qseng/frontend/src/app/features/settings /home/ben/repo/qseng/frontend/src/app/features/admin /home/ben/repo/qseng/frontend/src/app/features/trees/tree-list.component.ts /home/ben/repo/qseng/frontend/src/app/features/trees/tree-form-dialog.component.ts; echo "gate-end"
```
Expected: only `gate-end`.

- [ ] **Step 3: Visual verification**

Start API (`ASPNETCORE_ENVIRONMENT=Development DB_PROVIDER=sqlite CONNECTION_STRING="Data Source=/tmp/p1b.db" dotnet run --project /home/ben/repo/qseng/backend/src/Qseng.Api --no-launch-profile`) and `npm start --prefix /home/ben/repo/qseng/frontend` in the background; wait for `/api/v1/health` and `:4200`. With Playwright: `/login` (use the demo chip, then submit), `/trees` (open the tree menu once), `/settings`, `/admin/users`, `/register` (after logout), each at 1400×900 and 400×800, light and dark (toggle via the toolbar theme button or settings → Appearance). Check `browser_console_messages` for errors after each page. Expected: zero console errors; login card centred with outlined fields; tree cards with kebab menus; settings cards in a responsive grid; admin table on desktop, cards on 400 px; no legacy indigo buttons or emoji on these five screens. Stop both servers by PID; confirm ports free; ensure no screenshots or `.playwright-mcp/` in the repo.

- [ ] **Step 4: Commit (only if lint fixes were needed)**

```bash
git add frontend
git commit -m "chore(p1b): lint fixes for rewritten screens"
```

## Verification before hand-off

- Suite green (25 files / 97 tests), production build under budget, lint clean for all P1b files.
- Screens verified visually at both breakpoints and both themes with no console errors.
- No `ngModel`, `confirm(`, `alert(`, emoji in the rewritten screens.

## Next plans

- P1c: person detail/edit, timeline, media, relationship dialog, `PartialDateInput` CVA, `PersonStore`; backend `MediaDto.Kind` → `MediaKind` enum + contract re-export.
- P1d: tree view + graph (`TreeStore`, node SVG renderer, sidenav/bottom-sheet, context menu, `fullBleed`).
- P1e: delete `ApiClient`, `_legacy.scss`, remaining legacy components; grep gates; Lighthouse; screenshots; budget check.
