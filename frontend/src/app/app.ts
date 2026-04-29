import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  template: `
    @if (auth.isAuthenticated()) {
      <nav class="app-nav">
        <a class="app-nav__brand" routerLink="/trees">
          <span class="brand-icon">🌳</span>
          <span>Qseng</span>
        </a>
        <span class="app-nav__spacer"></span>
        <span class="app-nav__user">{{ auth.displayName() }}</span>
        <button class="app-nav__logout" (click)="logout()">Log out</button>
      </nav>
    }
    <router-outlet />
  `
})
export class App {
  auth = inject(AuthService);
  private router = inject(Router);

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
