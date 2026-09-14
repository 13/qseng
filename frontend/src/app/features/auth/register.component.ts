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
