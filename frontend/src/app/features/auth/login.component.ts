import { Component, inject, input, signal } from '@angular/core';
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
import { problemMessage } from '../../core/api/problem-details';
import { AuthPageComponent } from './auth-page.component';

/** Only same-origin absolute paths are honoured; anything else falls back to /trees. */
export function safeReturnUrl(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/trees';
}

@Component({
  selector: 'qs-login',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule,
            TranslatePipe, FormErrorsPipe, AuthPageComponent],
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

      <button matButton="outlined" type="button" class="qs-auth-demo" (click)="useDemo()">
        <mat-icon>science</mat-icon>{{ 'login.demoFill' | translate }}
      </button>

      <p class="qs-auth-footer qs-muted">
        {{ 'login.noAccount' | translate }} <a routerLink="/register">{{ 'login.register' | translate }}</a>
      </p>
    </qs-auth-page>
  `,
  styles: [`
    .qs-auth-form { display: flex; flex-direction: column; gap: 4px; }
    .qs-auth-form__submit { margin-top: 4px; }
    .qs-auth-demo { align-self: center; margin-top: 8px; }
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
