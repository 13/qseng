import { Component, signal, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiClient, UserProfile } from '../../core/api/api-client.service';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'qs-settings',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="settings-page">
      <div class="settings-header">
        <h1>{{ 'settings.title' | translate }}</h1>
        @if (profile()) {
          <p class="muted">&#64;{{ profile()!.username }}</p>
        }
      </div>

      @if (loadingProfile()) {
        <div class="loading">{{ 'settings.loading' | translate }}</div>
      } @else {

        <!-- Change Password -->
        <div class="settings-section">
          <h2>{{ 'settings.password.title' | translate }}</h2>
          <form (ngSubmit)="changePassword()">
            <div class="settings-fields">
              <label>
                {{ 'settings.password.current' | translate }}
                <input type="password" [(ngModel)]="pw.current" name="pwCurrent" required
                       placeholder="••••••••" autocomplete="current-password">
              </label>
              <label>
                {{ 'settings.password.new' | translate }}
                <input type="password" [(ngModel)]="pw.next" name="pwNext" required minlength="8"
                       placeholder="••••••••" autocomplete="new-password">
              </label>
            </div>
            @if (pwMsg()) {
              <p class="success" style="margin-top:.5rem">{{ pwMsg() }}</p>
            }
            @if (pwErr()) {
              <p class="error-msg" style="margin-top:.5rem">{{ pwErr() }}</p>
            }
            <div class="form-actions" style="margin-top:.875rem">
              <button type="submit" class="btn primary" [disabled]="pwLoading()">
                {{ pwLoading() ? ('settings.password.saving' | translate) : ('settings.password.save' | translate) }}
              </button>
            </div>
          </form>
        </div>

        <!-- Language -->
        <div class="settings-section">
          <h2>{{ 'settings.lang.title' | translate }}</h2>
          <p class="muted" style="margin-bottom:.875rem;font-size:.85rem">
            {{ 'settings.lang.hint' | translate }}
          </p>
          <div class="lang-options">
            <button class="lang-btn" [class.active]="i18n.lang() === 'de'" (click)="setLang('de')">
              <span class="lang-flag">🇩🇪</span> Deutsch
            </button>
            <button class="lang-btn" [class.active]="i18n.lang() === 'en'" (click)="setLang('en')">
              <span class="lang-flag">🇬🇧</span> English
            </button>
          </div>
          @if (langMsg()) {
            <p class="success" style="margin-top:.5rem">{{ langMsg() }}</p>
          }
        </div>

        <!-- Export -->
        <div class="settings-section">
          <h2>{{ 'settings.export.title' | translate }}</h2>
          <p class="muted" style="margin-bottom:.875rem;font-size:.85rem">
            {{ 'settings.export.hint' | translate }}
          </p>
          <button class="btn" (click)="exportData()" [disabled]="exporting()">
            {{ exporting() ? ('settings.export.busy' | translate) : ('settings.export.btn' | translate) }}
          </button>
        </div>

        <!-- Delete All Data -->
        <div class="settings-section danger-zone">
          <h2>{{ 'settings.deleteData.title' | translate }}</h2>
          <p class="muted" style="margin-bottom:.875rem;font-size:.85rem">
            {{ 'settings.deleteData.hint' | translate }}
          </p>
          @if (!showDeleteDataForm()) {
            <button class="btn danger" (click)="showDeleteDataForm.set(true)">
              {{ 'settings.deleteData.btn' | translate }}
            </button>
          } @else {
            <form (ngSubmit)="deleteAllData()">
              <label style="margin-bottom:.75rem">
                {{ 'settings.deleteData.confirm' | translate }}
                <input type="password" [(ngModel)]="deleteDataPw" name="deleteDataPw" required
                       placeholder="••••••••" autocomplete="current-password">
              </label>
              @if (deleteDataErr()) {
                <p class="error-msg" style="margin-bottom:.5rem">{{ deleteDataErr() }}</p>
              }
              <div class="form-actions">
                <button type="submit" class="btn danger" [disabled]="deleteDataLoading()">
                  {{ deleteDataLoading() ? ('settings.deleteData.deleting' | translate) : ('settings.deleteData.submit' | translate) }}
                </button>
                <button type="button" class="btn ghost" (click)="showDeleteDataForm.set(false)">
                  {{ 'cancel' | translate }}
                </button>
              </div>
            </form>
          }
        </div>

        <!-- Delete Account -->
        <div class="settings-section danger-zone">
          <h2>{{ 'settings.delete.title' | translate }}</h2>
          <p class="muted" style="margin-bottom:.875rem;font-size:.85rem">
            {{ 'settings.delete.hint' | translate }}
          </p>
          @if (!showDeleteForm()) {
            <button class="btn danger" (click)="showDeleteForm.set(true)">
              {{ 'settings.delete.btn' | translate }}
            </button>
          } @else {
            <form (ngSubmit)="deleteAccount()">
              <label style="margin-bottom:.75rem">
                {{ 'settings.delete.confirm' | translate }}
                <input type="password" [(ngModel)]="deletePw" name="deletePw" required
                       placeholder="••••••••" autocomplete="current-password">
              </label>
              @if (deleteErr()) {
                <p class="error-msg" style="margin-bottom:.5rem">{{ deleteErr() }}</p>
              }
              <div class="form-actions">
                <button type="submit" class="btn danger" [disabled]="deleteLoading()">
                  {{ deleteLoading() ? ('settings.delete.deleting' | translate) : ('settings.delete.submit' | translate) }}
                </button>
                <button type="button" class="btn ghost" (click)="showDeleteForm.set(false)">
                  {{ 'cancel' | translate }}
                </button>
              </div>
            </form>
          }
        </div>
      }
    </div>
  `
})
export class SettingsComponent implements OnInit {
  private api = inject(ApiClient);
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly i18n = inject(I18nService);

  profile        = signal<UserProfile | null>(null);
  loadingProfile = signal(true);

  pw           = { current: '', next: '' };
  pwLoading    = signal(false);
  pwMsg        = signal('');
  pwErr        = signal('');

  langMsg      = signal('');

  exporting    = signal(false);

  showDeleteDataForm = signal(false);
  deleteDataPw       = '';
  deleteDataLoading  = signal(false);
  deleteDataErr      = signal('');

  showDeleteForm = signal(false);
  deletePw       = '';
  deleteLoading  = signal(false);
  deleteErr      = signal('');

  ngOnInit() {
    this.api.getProfile().subscribe({
      next: p => {
        this.profile.set(p);
        this.i18n.setLang(p.language as 'en' | 'de');
        this.loadingProfile.set(false);
      },
      error: () => this.loadingProfile.set(false)
    });
  }

  changePassword() {
    this.pwLoading.set(true); this.pwMsg.set(''); this.pwErr.set('');
    this.api.changePassword(this.pw.current, this.pw.next).subscribe({
      next: () => {
        this.pwMsg.set(this.i18n.t('settings.password.ok'));
        this.pw = { current: '', next: '' };
        this.pwLoading.set(false);
      },
      error: e => { this.pwErr.set(e.error?.error ?? this.i18n.t('err.save')); this.pwLoading.set(false); }
    });
  }

  setLang(lang: 'en' | 'de') {
    this.i18n.setLang(lang);
    this.langMsg.set('');
    this.api.changeLanguage(lang).subscribe({
      next: () => this.langMsg.set(this.i18n.t('settings.lang.saved')),
      error: e => this.langMsg.set(e.error?.error ?? this.i18n.t('err.save'))
    });
  }

  exportData() {
    this.exporting.set(true);
    this.api.exportData().subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qseng-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => this.exporting.set(false)
    });
  }

  deleteAllData() {
    this.deleteDataLoading.set(true); this.deleteDataErr.set('');
    this.api.deleteOwnData(this.deleteDataPw).subscribe({
      next: () => {
        this.showDeleteDataForm.set(false);
        this.deleteDataPw = '';
        this.deleteDataLoading.set(false);
        this.router.navigate(['/trees']);
      },
      error: e => { this.deleteDataErr.set(e.error?.error ?? this.i18n.t('err.delete')); this.deleteDataLoading.set(false); }
    });
  }

  deleteAccount() {
    this.deleteLoading.set(true); this.deleteErr.set('');
    this.api.deleteOwnAccount(this.deletePw).subscribe({
      next: () => { this.auth.logout(); this.router.navigate(['/login']); },
      error: e => { this.deleteErr.set(e.error?.error ?? this.i18n.t('err.delete')); this.deleteLoading.set(false); }
    });
  }
}
