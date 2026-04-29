import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'qs-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <span class="brand-icon">🌳</span>
          <h1>Create account</h1>
          <p>Start building your family tree today</p>
        </div>

        <form (ngSubmit)="submit()">
          <label>
            Display name
            <input [(ngModel)]="displayName" name="displayName" required
                   placeholder="Maria Mustermann" autocomplete="name">
          </label>
          <label>
            Email address
            <input type="email" [(ngModel)]="email" name="email" required
                   placeholder="you@example.com" autocomplete="email">
          </label>
          <label>
            Password
            <input type="password" [(ngModel)]="password" name="password"
                   required minlength="8" placeholder="8+ characters"
                   autocomplete="new-password">
          </label>

          @if (error()) {
            <p class="error-msg" role="alert">{{ error() }}</p>
          }

          <button type="submit" class="primary" [disabled]="loading()" style="width:100%;justify-content:center;margin-top:.25rem">
            {{ loading() ? 'Creating account…' : 'Create account' }}
          </button>
        </form>

        <div class="auth-footer">
          Already have an account? <a routerLink="/login">Sign in</a>
        </div>
      </div>
    </div>
  `
})
export class RegisterComponent {
  displayName = '';
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  constructor(private auth: AuthService, private router: Router) {}

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.auth.register(this.email, this.password, this.displayName).subscribe({
      next: () => this.router.navigate(['/trees']),
      error: e => { this.error.set(e.error?.error ?? 'Registration failed'); this.loading.set(false); }
    });
  }
}
