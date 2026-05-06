import { Component, signal, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'qs-register',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <span class="brand-icon">🌳</span>
          <h1>{{ 'register.title' | translate }}</h1>
          <p>{{ 'register.tagline' | translate }}</p>
        </div>

        <form (ngSubmit)="submit()">
          <label>
            {{ 'register.username' | translate }} <span class="required">*</span>
            <input type="text" [(ngModel)]="username" name="username" required
                   placeholder="username" autocomplete="username">
          </label>
          <label>
            {{ 'register.displayName' | translate }}
            <input [(ngModel)]="displayName" name="displayName"
                   placeholder="Jane Smith" autocomplete="name">
          </label>
          <label>
            {{ 'register.email' | translate }} <span class="field-optional">({{ 'optional' | translate }})</span>
            <input type="email" [(ngModel)]="email" name="email"
                   placeholder="you@example.com" autocomplete="email">
          </label>
          <label>
            {{ 'register.password' | translate }} <span class="required">*</span>
            <input type="password" [(ngModel)]="password" name="password"
                   required minlength="8" [placeholder]="'register.passwordHint' | translate"
                   autocomplete="new-password">
          </label>

          @if (error()) {
            <p class="error-msg" role="alert">{{ error() }}</p>
          }

          <button type="submit" class="primary" [disabled]="loading()"
                  style="width:100%;justify-content:center;margin-top:.25rem">
            {{ loading() ? ('register.submitting' | translate) : ('register.submit' | translate) }}
          </button>
        </form>

        <div class="auth-footer">
          {{ 'register.haveAccount' | translate }} <a routerLink="/login">{{ 'register.login' | translate }}</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .required { color: var(--c-error); }
    .field-optional { font-weight: 400; color: var(--c-text-4); font-size: .7rem; }
  `]
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  username = '';
  displayName = '';
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.auth.register(this.username, this.password, this.displayName || undefined, this.email || undefined)
      .subscribe({
        next: () => this.router.navigate(['/trees']),
        error: e => { this.error.set(e.error?.error ?? this.i18n.t('register.error')); this.loading.set(false); }
      });
  }
}
