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

        @if (pending()) {
          <div class="pending-note" role="status">
            <p><strong>{{ 'register.pendingTitle' | translate }}</strong></p>
            <p>{{ 'register.pendingHint' | translate }}</p>
            <a routerLink="/login" class="btn primary" style="margin-top:.75rem">{{ 'register.login' | translate }}</a>
          </div>
        } @else {
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
        }

        <div class="auth-footer">
          {{ 'register.haveAccount' | translate }} <a routerLink="/login">{{ 'register.login' | translate }}</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .required { color: var(--c-error); }
    .field-optional { font-weight: 400; color: var(--c-text-4); font-size: .7rem; }
    .pending-note {
      background: var(--c-success-bg);
      border: 1px solid var(--c-success);
      border-radius: var(--r-md);
      padding: 1rem 1.25rem;
      font-size: .875rem;
      color: var(--c-text-2);
      text-align: center;
      p { margin: 0 0 .35rem; }
    }
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
  pending = signal(false);

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.auth.register(this.username, this.password, this.displayName || undefined, this.email || undefined)
      .subscribe({
        next: r => {
          if (r.pendingActivation) { this.pending.set(true); this.loading.set(false); }
          else this.router.navigate(['/trees']);
        },
        error: e => {
          const resp = e.error as { error?: string; errors?: { errorMessage: string }[] } | undefined;
          this.error.set(resp?.error ?? resp?.errors?.[0]?.errorMessage ?? this.i18n.t('register.error'));
          this.loading.set(false);
        }
      });
  }
}
