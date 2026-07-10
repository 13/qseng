import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/theme/theme.service';
import { I18nService } from './core/i18n/i18n.service';
import { TranslatePipe } from './core/i18n/translate.pipe';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, TranslatePipe],
  template: `
    @if (auth.isAuthenticated()) {
      <nav class="app-nav">
        <a class="app-nav__brand" routerLink="/trees">
          <span class="brand-icon">🌳</span>
          <span>Qseng</span>
        </a>
        <span class="app-nav__spacer"></span>

        <button class="app-nav__theme-btn" (click)="theme.toggle()"
                [title]="(theme.dark() ? 'nav.theme.dark' : 'nav.theme.light') | translate"
                [attr.aria-label]="(theme.dark() ? 'nav.theme.dark' : 'nav.theme.light') | translate">
          {{ theme.dark() ? '☀' : '🌙' }}
        </button>

        <div class="app-nav__user-wrap" (keydown.escape)="menuOpen.set(false)">
          <button type="button" class="app-nav__user-menu" (click)="toggleMenu($event)"
                  aria-haspopup="menu" [attr.aria-expanded]="menuOpen()">
            <span class="user-avatar-nav" aria-hidden="true">{{ initials() }}</span>
            <span class="app-nav__username">{{ auth.displayName() }}</span>
            <span class="dropdown-caret" aria-hidden="true">▾</span>
          </button>

          @if (menuOpen()) {
            <div class="user-dropdown" (click)="$event.stopPropagation()">
              <div class="user-dropdown__header">
                <div class="user-dropdown__name">{{ auth.displayName() }}</div>
                <div class="user-dropdown__sub">&#64;{{ auth.username() }}</div>
              </div>
              <div class="user-dropdown__divider"></div>
              <a class="user-dropdown__item" routerLink="/settings" (click)="menuOpen.set(false)">
                <span>⚙</span> {{ 'nav.settings' | translate }}
              </a>
              @if (auth.isAdmin()) {
                <a class="user-dropdown__item" routerLink="/admin/users" (click)="menuOpen.set(false)">
                  <span>👥</span> {{ 'nav.users' | translate }}
                </a>
              }
              <div class="lang-switcher">
                <button [class.active]="i18n.lang() === 'de'" (click)="setLang('de'); $event.stopPropagation()">
                  🇩🇪 DE
                </button>
                <button [class.active]="i18n.lang() === 'en'" (click)="setLang('en'); $event.stopPropagation()">
                  🇬🇧 EN
                </button>
              </div>
              <div class="user-dropdown__divider"></div>
              <button class="user-dropdown__item danger" (click)="logout()">
                <span>⏻</span> {{ 'nav.logout' | translate }}
              </button>
            </div>
          }
        </div>
      </nav>
    }
    <router-outlet />
  `
})
export class App {
  auth  = inject(AuthService);
  theme = inject(ThemeService);
  i18n  = inject(I18nService);
  private router = inject(Router);
  menuOpen = signal(false);

  @HostListener('document:click')
  closeMenu() { this.menuOpen.set(false); }

  toggleMenu(e: Event) {
    e.stopPropagation();
    this.menuOpen.update(v => !v);
  }

  logout() {
    this.menuOpen.set(false);
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  setLang(lang: 'en' | 'de') {
    this.i18n.setLang(lang);
    this.menuOpen.set(false);
  }

  initials() {
    const name = this.auth.displayName() ?? this.auth.username() ?? '?';
    return name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
  }
}
