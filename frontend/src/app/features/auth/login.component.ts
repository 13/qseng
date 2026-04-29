import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'qs-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <span class="brand-icon">🌳</span>
          <h1>Qseng</h1>
          <p>Your family history, beautifully organized</p>
        </div>

        <form (ngSubmit)="submit()">
          <label>
            Email address
            <input type="email" [(ngModel)]="email" name="email" required
                   placeholder="you@example.com" autocomplete="email">
          </label>
          <label>
            Password
            <input type="password" [(ngModel)]="password" name="password" required
                   placeholder="••••••••" autocomplete="current-password">
          </label>

          @if (error()) {
            <p class="error-msg" role="alert">{{ error() }}</p>
          }

          <button type="submit" class="primary" [disabled]="loading()" style="width:100%;justify-content:center;margin-top:.25rem">
            {{ loading() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <div class="demo-hint">
          <strong>Demo account:</strong><br>
          <code>demo@qseng.app</code> / <code>Demo123!</code>
        </div>

        <div class="auth-footer">
          No account? <a routerLink="/register">Create one</a>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  constructor(private auth: AuthService, private router: Router) {}

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/trees']),
      error: e => { this.error.set(e.error?.error ?? 'Login failed'); this.loading.set(false); }
    });
  }
}
