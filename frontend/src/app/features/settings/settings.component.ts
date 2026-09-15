import { Component, ElementRef, OnInit, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { UserApi, UserProfileDto } from '../../core/api/generated';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService, Lang } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeService } from '../../core/theme/theme.service';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { BreadcrumbService } from '../../core/ui/breadcrumb.service';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';
import { setServerErrors } from '../../core/forms/server-errors';
import { isValidationProblem } from '../../core/api/problem-details';
import { TrashCardComponent } from './trash-card.component';

@Component({
  selector: 'qs-settings',
  imports: [ReactiveFormsModule, DatePipe, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule,
            MatButtonToggleModule, MatProgressBarModule, TranslatePipe, FormErrorsPipe, TrashCardComponent],
  template: `
    <header class="qs-page-header"><h1 tabindex="-1">{{ 'settings.title' | translate }}</h1></header>

    <div class="qs-settings">
      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>{{ 'settings.profile.title' | translate }}</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (profile(); as p) {
            <dl class="qs-dl">
              <dt>{{ 'settings.profile.displayName' | translate }}</dt><dd>{{ p.displayName }}</dd>
              <dt>{{ 'settings.profile.username' | translate }}</dt><dd>{{ p.username }}</dd>
              <dt>{{ 'settings.profile.email' | translate }}</dt><dd>{{ p.email || '–' }}</dd>
              <dt>{{ 'settings.profile.member' | translate }}</dt><dd>{{ p.createdAt | date:'mediumDate':undefined:i18n.lang() }}</dd>
            </dl>
          } @else if (loadingProfile()) {
            <mat-progress-bar mode="indeterminate" />
          }
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>{{ 'settings.lang.title' | translate }}</mat-card-title></mat-card-header>
        <mat-card-content>
          <p class="qs-muted">{{ 'settings.lang.hint' | translate }}</p>
          <mat-button-toggle-group hideSingleSelectionIndicator [value]="i18n.lang()" (change)="setLang($event.value)">
            <mat-button-toggle value="de">Deutsch</mat-button-toggle>
            <mat-button-toggle value="en">English</mat-button-toggle>
          </mat-button-toggle-group>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>{{ 'settings.appearance.title' | translate }}</mat-card-title></mat-card-header>
        <mat-card-content>
          <p class="qs-muted">{{ 'settings.appearance.hint' | translate }}</p>
          <mat-button-toggle-group hideSingleSelectionIndicator [value]="theme.mode()" (change)="setTheme($event.value)">
            <mat-button-toggle value="light"><mat-icon>light_mode</mat-icon> {{ 'settings.appearance.light' | translate }}</mat-button-toggle>
            <mat-button-toggle value="dark"><mat-icon>dark_mode</mat-icon> {{ 'settings.appearance.dark' | translate }}</mat-button-toggle>
            <mat-button-toggle value="auto"><mat-icon>brightness_auto</mat-icon> {{ 'settings.appearance.auto' | translate }}</mat-button-toggle>
          </mat-button-toggle-group>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>{{ 'settings.password.title' | translate }}</mat-card-title></mat-card-header>
        <mat-card-content>
          <form [formGroup]="pwForm" (ngSubmit)="changePassword()" class="qs-form" novalidate>
            <mat-form-field>
              <mat-label>{{ 'settings.password.current' | translate }}</mat-label>
              <input matInput type="password" formControlName="current" autocomplete="current-password">
              <mat-error>{{ pwForm.controls.current.errors | formErrors }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'settings.password.new' | translate }}</mat-label>
              <input matInput type="password" formControlName="next" autocomplete="new-password">
              <mat-error>{{ pwForm.controls.next.errors | formErrors }}</mat-error>
            </mat-form-field>
            <div class="qs-form__actions">
              <button matButton="filled" type="submit" [disabled]="pwLoading()">
                {{ (pwLoading() ? 'settings.password.saving' : 'settings.password.save') | translate }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>{{ 'settings.export.title' | translate }}</mat-card-title></mat-card-header>
        <mat-card-content>
          <p class="qs-muted">{{ 'settings.export.hint' | translate }}</p>
          <button matButton="outlined" (click)="exportData()" [disabled]="exporting()">
            <mat-icon>download</mat-icon>{{ (exporting() ? 'settings.export.busy' : 'settings.export.btn') | translate }}
          </button>
        </mat-card-content>
      </mat-card>

      <qs-trash-card id="trash" #trashCard tabindex="-1" />

      <mat-card appearance="outlined" class="qs-danger">
        <mat-card-header><mat-card-title>{{ 'settings.danger.title' | translate }}</mat-card-title></mat-card-header>
        <mat-card-content class="qs-danger__content">
          <div>
            <p class="qs-muted">{{ 'settings.deleteData.hint' | translate }}</p>
            <button matButton="outlined" class="qs-danger__btn" (click)="deleteAllData()">{{ 'settings.deleteData.btn' | translate }}</button>
          </div>
          <div>
            <p class="qs-muted">{{ 'settings.delete.hint' | translate }}</p>
            <button matButton="outlined" class="qs-danger__btn" (click)="deleteAccount()">{{ 'settings.delete.btn' | translate }}</button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .qs-settings { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; max-width: 900px; align-items: start; }
    .qs-dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0; }
    .qs-dl dt { color: var(--mat-sys-on-surface-variant); }
    .qs-dl dd { margin: 0; }
    .qs-form { display: flex; flex-direction: column; gap: 4px; }
    .qs-form__actions { display: flex; justify-content: flex-end; }
    .qs-danger { --mat-card-outlined-outline-color: var(--mat-sys-error); grid-column: 1 / -1; }
    .qs-danger__content { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
    .qs-danger__btn { --mat-button-outlined-label-text-color: var(--mat-sys-error); --mat-button-outlined-outline-color: var(--mat-sys-error); }
    mat-card-content > p:first-child { margin-top: 0; }
  `]
})
export class SettingsComponent implements OnInit {
  private readonly api = inject(UserApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly crumbs = inject(BreadcrumbService);
  readonly i18n = inject(I18nService);
  readonly theme = inject(ThemeService);

  readonly profile = signal<UserProfileDto | null>(null);
  readonly loadingProfile = signal(true);
  readonly pwLoading = signal(false);
  readonly exporting = signal(false);

  readonly pwForm = inject(FormBuilder).nonNullable.group({
    current: ['', Validators.required],
    next: ['', [Validators.required, Validators.minLength(8)]]
  });

  // Scrolls the #trash card into view when arriving (or already sitting) on /settings#trash,
  // e.g. via the command palette's "Trash" action. anchorScrolling only fires on navigation,
  // not on a fragment-only change while already on this route, so drive it from the signal
  // instead; zoneless never re-renders from the fragment alone, hence the explicit effect.
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment);
  private readonly trashCard = viewChild<unknown, ElementRef<HTMLElement>>('trashCard', { read: ElementRef });

  constructor() {
    effect(() => {
      const el = this.trashCard()?.nativeElement;
      if (this.fragment() === 'trash' && el) queueMicrotask(() => { el.scrollIntoView({ block: 'start' }); el.focus({ preventScroll: true }); });
    });
  }

  ngOnInit() {
    this.crumbs.set([{ label: this.i18n.t('settings.title') }]);
    this.api.userGetProfile().subscribe({
      next: p => {
        this.profile.set(p);
        if (p.language === 'de' || p.language === 'en') this.i18n.setLang(p.language);
        this.loadingProfile.set(false);
      },
      error: e => { this.loadingProfile.set(false); this.toast.errorFrom(e, this.i18n.t('err.load')); }
    });
  }

  changePassword() {
    if (this.pwForm.invalid) { this.pwForm.markAllAsTouched(); return; }
    this.pwLoading.set(true);
    const { current, next } = this.pwForm.getRawValue();
    this.api.userChangePassword({ body: { currentPassword: current, newPassword: next } }).subscribe({
      next: session => {
        // The old session was revoked server-side; adopt the replacement so this tab stays signed in.
        this.auth.adoptSession(session);
        this.toast.success(this.i18n.t('settings.password.ok'));
        this.pwForm.reset({ current: '', next: '' });
        this.pwLoading.set(false);
      },
      error: e => {
        if (isValidationProblem(e.error)) {
          const rest = setServerErrors(this.pwForm, e.error);
          if (rest.length) this.toast.error(rest.join(' '));
        } else {
          this.toast.errorFrom(e, this.i18n.t('err.save'));
        }
        this.pwLoading.set(false);
      }
    });
  }

  // Narrows the button-toggle group's untyped `$event.value` (a plain string
  // as far as strict templates know) to the Lang/ThemeMode literal unions.
  setLang(lang: string) {
    if (lang !== 'de' && lang !== 'en') return;
    const l: Lang = lang;
    this.i18n.setLang(l);
    this.api.userChangeLanguage({ body: { language: l } }).subscribe({
      next: () => this.toast.success(this.i18n.t('settings.lang.saved')),
      error: e => this.toast.errorFrom(e, this.i18n.t('err.save'))
    });
  }

  setTheme(mode: string) {
    if (mode === 'light' || mode === 'dark' || mode === 'auto') this.theme.setMode(mode);
  }

  exportData() {
    this.exporting.set(true);
    this.api.userExport().subscribe({
      next: dto => {
        const blob = new Blob([JSON.stringify(dto, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qseng-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        this.exporting.set(false);
        this.toast.success(this.i18n.t('settings.export.done'));
      },
      error: e => { this.exporting.set(false); this.toast.errorFrom(e, this.i18n.t('err.load')); }
    });
  }

  async deleteAllData() {
    const password = await this.confirm.confirm({
      title: this.i18n.t('settings.deleteData.title'), message: this.i18n.t('settings.deleteData.hint'),
      confirmLabel: this.i18n.t('settings.deleteData.submit'), destructive: true, requirePassword: true
    });
    if (typeof password !== 'string') return;
    this.api.userDeleteData({ body: { password } }).subscribe({
      next: () => { this.toast.success(this.i18n.t('settings.deleteData.done')); void this.router.navigate(['/trees']); },
      error: e => this.toast.errorFrom(e, this.i18n.t('err.delete'))
    });
  }

  async deleteAccount() {
    const password = await this.confirm.confirm({
      title: this.i18n.t('settings.delete.title'), message: this.i18n.t('settings.delete.hint'),
      confirmLabel: this.i18n.t('settings.delete.submit'), destructive: true, requirePassword: true
    });
    if (typeof password !== 'string') return;
    this.api.userDeleteAccount({ body: { password } }).subscribe({
      next: () => { this.auth.logout(); void this.router.navigate(['/login']); },
      error: e => this.toast.errorFrom(e, this.i18n.t('err.delete'))
    });
  }
}
