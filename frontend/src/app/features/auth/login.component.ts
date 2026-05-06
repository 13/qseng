import { Component, signal, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'qs-login',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <span class="brand-icon">🌳</span>
          <h1>Qseng</h1>
          <p>{{ 'login.tagline' | translate }}</p>
        </div>

        <form (ngSubmit)="submit()">
          <label>
            {{ 'login.username' | translate }}
            <input type="text" [(ngModel)]="username" name="username" required
                   placeholder="username" autocomplete="username">
          </label>
          <label>
            {{ 'login.password' | translate }}
            <input type="password" [(ngModel)]="password" name="password" required
                   placeholder="••••••••" autocomplete="current-password">
          </label>

          @if (error()) {
            <p class="error-msg" role="alert">{{ error() }}</p>
          }

          <button type="submit" class="primary" [disabled]="loading()"
                  style="width:100%;justify-content:center;margin-top:.25rem">
            {{ loading() ? ('login.submitting' | translate) : ('login.submit' | translate) }}
          </button>
        </form>

        <div class="demo-hint">
          <strong>{{ 'login.demo' | translate }}:</strong><br>
          {{ 'login.demoUser' | translate }}: <code>demo</code> &nbsp;|&nbsp;
          {{ 'login.demoPass' | translate }}: <code>Demo123!</code>
        </div>

        <div class="auth-footer">
          {{ 'login.noAccount' | translate }} <a routerLink="/register">{{ 'login.register' | translate }}</a>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  username = '';
  password = '';
  loading = signal(false);
  error = signal('');

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.username, this.password).subscribe({
      next: () => this.router.navigate(['/trees']),
      error: e => { this.error.set(e.error?.error ?? this.i18n.t('login.error')); this.loading.set(false); }
    });
  }
}
