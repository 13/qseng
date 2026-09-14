import { Component, DestroyRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/theme/theme.service';
import { I18nService, Lang } from './core/i18n/i18n.service';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { PendingRequestsService } from './core/ui/pending-requests.service';
import { BreadcrumbService } from './core/ui/breadcrumb.service';
import { ToastService } from './core/ui/toast.service';
import { UserApi } from './core/api/generated';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule,
            MatProgressBarModule, MatDividerModule, MatTooltipModule, TranslatePipe],
  template: `
    <a class="qs-skip-link" href="#main">{{ 'nav.skip' | translate }}</a>

    @if (layout() === 'app' && auth.isAuthenticated()) {
      <mat-toolbar class="qs-toolbar">
        <a class="qs-brand" routerLink="/trees" aria-label="Qseng">
          <mat-icon aria-hidden="true">park</mat-icon>
          <span class="qs-display">Qseng</span>
        </a>

        <nav class="qs-crumbs" aria-label="Breadcrumb">
          @for (c of crumbs.crumbs(); track $index; let last = $last) {
            <mat-icon class="qs-crumbs__sep" aria-hidden="true">chevron_right</mat-icon>
            @if (c.link && !last) {
              <a [routerLink]="c.link" class="qs-crumbs__item">{{ c.label }}</a>
            } @else {
              <span class="qs-crumbs__item qs-crumbs__item--current" aria-current="page">{{ c.label }}</span>
            }
          }
        </nav>

        <span class="qs-spacer"></span>

        <button matIconButton (click)="theme.cycle()" [matTooltip]="themeLabel()" [attr.aria-label]="themeLabel()">
          <mat-icon>{{ themeIcon() }}</mat-icon>
        </button>

        <button matButton [matMenuTriggerFor]="userMenu" class="qs-user" aria-haspopup="menu" [attr.aria-label]="auth.displayName()">
          <span class="qs-avatar qs-avatar--28 qs-avatar__initials qs-user__avatar" aria-hidden="true">{{ initials() }}</span>
          <span class="qs-user__name">{{ auth.displayName() }}</span>
          <mat-icon aria-hidden="true">expand_more</mat-icon>
        </button>
        <mat-menu #userMenu="matMenu" xPosition="before">
          <div class="qs-menu-header">
            <div class="qs-menu-header__name">{{ auth.displayName() }}</div>
            <div class="qs-muted">&#64;{{ auth.username() }}</div>
          </div>
          <mat-divider />
          <a mat-menu-item routerLink="/settings"><mat-icon>settings</mat-icon>{{ 'nav.settings' | translate }}</a>
          @if (auth.isAdmin()) {
            <a mat-menu-item routerLink="/admin/users"><mat-icon>group</mat-icon>{{ 'nav.users' | translate }}</a>
          }
          <mat-divider />
          <button mat-menu-item (click)="setLang('de')" [disabled]="i18n.lang() === 'de'"><mat-icon>{{ i18n.lang() === 'de' ? 'check' : '' }}</mat-icon>Deutsch</button>
          <button mat-menu-item (click)="setLang('en')" [disabled]="i18n.lang() === 'en'"><mat-icon>{{ i18n.lang() === 'en' ? 'check' : '' }}</mat-icon>English</button>
          <mat-divider />
          <button mat-menu-item (click)="logout()"><mat-icon>logout</mat-icon>{{ 'nav.logout' | translate }}</button>
        </mat-menu>
      </mat-toolbar>
      <mat-progress-bar class="qs-progress" mode="indeterminate" [class.qs-progress--on]="busy()" aria-hidden="true" />
    }

    <main id="main" tabindex="-1" [class.qs-main--app]="layout() === 'app' && !fullBleed()">
      <router-outlet />
    </main>
  `,
  styles: [`
    :host { display: block; min-height: 100%; }
    .qs-toolbar { position: sticky; top: 0; z-index: 100; height: var(--qs-toolbar-h); gap: 8px; background: var(--mat-sys-surface-container); border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .qs-brand { display: inline-flex; align-items: center; gap: 6px; color: var(--mat-sys-on-surface); font-size: 1.25rem; text-decoration: none; }
    .qs-brand mat-icon { color: var(--mat-sys-primary); }
    .qs-crumbs { display: flex; align-items: center; min-width: 0; font-size: .95rem; }
    .qs-crumbs__sep { color: var(--mat-sys-outline); }
    .qs-crumbs__item { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 32vw; color: var(--mat-sys-on-surface-variant); }
    .qs-crumbs__item--current { color: var(--mat-sys-on-surface); font-weight: 500; }
    .qs-spacer { flex: 1; }
    .qs-user { display: inline-flex; align-items: center; gap: 8px; }
    .qs-user__avatar { background: var(--mat-sys-primary); color: var(--mat-sys-on-primary); }
    .qs-menu-header { padding: 8px 16px; }
    .qs-menu-header__name { font-weight: 500; }
    .qs-progress { position: sticky; top: var(--qs-toolbar-h); z-index: 99; opacity: 0; transition: opacity .15s; }
    .qs-progress--on { opacity: 1; }
    main:focus { outline: none; }
    @media (max-width: 599.98px) { .qs-user__name, .qs-crumbs { display: none; } }
  `]
})
export class App {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  readonly crumbs = inject(BreadcrumbService);
  private readonly pending = inject(PendingRequestsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly userApi = inject(UserApi);
  private readonly toast = inject(ToastService);

  private readonly navigating = signal(false);
  private lastPath: string | null = null;
  readonly layout = signal<'auth' | 'app'>('app');
  readonly fullBleed = signal(false);
  readonly busy = computed(() => this.navigating() || this.pending.busy());

  readonly themeIcon = computed(() => ({ auto: 'brightness_auto', light: 'light_mode', dark: 'dark_mode' })[this.theme.mode()]);
  readonly themeLabel = computed(() => this.i18n.t(({ auto: 'nav.theme.auto', light: 'nav.theme.light', dark: 'nav.theme.dark' } as const)[this.theme.mode()]));

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(e => {
      if (e instanceof NavigationStart) this.navigating.set(true);
      if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) {
        this.navigating.set(false);
        this.layout.set(this.deepestData()['layout'] === 'auth' ? 'auth' : 'app');
        this.fullBleed.set(this.deepestData()['fullBleed'] === true);
        if (e instanceof NavigationEnd) {
          const path = e.urlAfterRedirects.split(/[?#]/)[0];
          if (path !== this.lastPath) {
            this.lastPath = path;
            afterNextRender(
              () => (document.querySelector('main h1') as HTMLElement | null)?.focus?.(),
              { injector: this.injector }
            );
          }
        }
      }
    });
  }

  private deepestData(): Record<string, unknown> {
    let route: ActivatedRoute | null = this.router.routerState.root;
    while (route?.firstChild) route = route.firstChild;
    return route?.snapshot.data ?? {};
  }

  initials(): string {
    const name = this.auth.displayName() ?? this.auth.username() ?? '?';
    return name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
  }

  setLang(lang: Lang) {
    this.i18n.setLang(lang);
    if (this.auth.isAuthenticated()) {
      this.userApi.userChangeLanguage({ body: { language: lang } }).subscribe({
        error: e => this.toast.errorFrom(e, this.i18n.t('err.save'))
      });
    }
  }

  logout() {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
