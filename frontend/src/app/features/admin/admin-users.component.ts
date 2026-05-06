import { Component, signal, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiClient, UserSummary, SiteSettings } from '../../core/api/api-client.service';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'qs-admin-users',
  standalone: true,
  imports: [DatePipe, FormsModule, TranslatePipe],
  template: `
    <div class="admin-page">

      <!-- Header -->
      <div class="admin-header">
        <div>
          <h1>{{ 'admin.title' | translate }}</h1>
          <p class="muted">{{ ('admin.registered' | translate).replace('__N__', users().length.toString()) }}</p>
        </div>
        <div class="admin-header-actions">
          @if (siteSettings()) {
            <label class="toggle-label">
              <span>{{ 'admin.registration' | translate }}</span>
              <button class="toggle-btn" [class.on]="siteSettings()!.registrationEnabled"
                      (click)="toggleRegistration()">
                <span class="toggle-track">
                  <span class="toggle-thumb"></span>
                </span>
                {{ siteSettings()!.registrationEnabled ? ('admin.reg.on' | translate) : ('admin.reg.off' | translate) }}
              </button>
            </label>
          }
          @if (toggleErr()) {
            <span class="error-msg" style="font-size:.78rem">{{ toggleErr() }}</span>
          }
          <button class="btn primary" (click)="showCreate.set(!showCreate())">
            {{ showCreate() ? ('admin.create.cancel' | translate) : ('admin.create.btn' | translate) }}
          </button>
        </div>
      </div>

      <!-- Create user form -->
      @if (showCreate()) {
        <div class="create-user-form">
          <h3>{{ 'admin.create.title' | translate }}</h3>
          <div class="create-user-grid">
            <label>
              {{ 'admin.create.username' | translate }}
              <input type="text" [(ngModel)]="newUser.username" placeholder="username">
            </label>
            <label>
              {{ 'admin.create.displayName' | translate }}
              <input type="text" [(ngModel)]="newUser.displayName" placeholder="Jane Smith">
            </label>
            <label>
              {{ 'admin.create.email' | translate }}
              <input type="email" [(ngModel)]="newUser.email" placeholder="jane@example.com">
            </label>
            <label>
              {{ 'admin.create.password' | translate }}
              <input type="password" [(ngModel)]="newUser.password" placeholder="min. 8 chars">
            </label>
          </div>
          <div class="create-user-footer">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="newUser.isAdmin">
              {{ 'admin.create.isAdmin' | translate }}
            </label>
            @if (createErr()) {
              <span class="error-msg">{{ createErr() }}</span>
            }
            <button class="btn primary" (click)="createUser()" [disabled]="createLoading()">
              {{ createLoading() ? ('admin.create.submitting' | translate) : ('admin.create.submit' | translate) }}
            </button>
          </div>
        </div>
      }

      <!-- Password change panel -->
      @if (changePwUserId()) {
        <div class="pw-change-panel">
          <strong>{{ ('admin.pw.title' | translate).replace('__NAME__', changePwUsername()) }}</strong>
          <div class="pw-change-row">
            <input type="password" [(ngModel)]="newPw" [placeholder]="'admin.pw.placeholder' | translate">
            <button class="btn primary" (click)="submitPwChange()" [disabled]="pwChangeLoading()">
              {{ pwChangeLoading() ? ('admin.pw.saving' | translate) : ('admin.pw.save' | translate) }}
            </button>
            <button class="btn ghost" (click)="cancelPwChange()">{{ 'admin.pw.cancel' | translate }}</button>
          </div>
          @if (pwChangeErr()) {
            <p class="error-msg">{{ pwChangeErr() }}</p>
          }
        </div>
      }

      <!-- User table -->
      @if (loading()) {
        <div class="loading">{{ 'admin.loading' | translate }}</div>
      } @else if (error()) {
        <div class="error-msg" role="alert">{{ error() }}</div>
      } @else {
        <div class="user-table-wrap">
          <table class="user-table">
            <thead>
              <tr>
                <th>{{ 'admin.table.user' | translate }}</th>
                <th>{{ 'admin.table.email' | translate }}</th>
                <th>{{ 'admin.table.lang' | translate }}</th>
                <th>{{ 'admin.table.registered' | translate }}</th>
                <th>{{ 'admin.table.status' | translate }}</th>
                <th>{{ 'admin.table.role' | translate }}</th>
                <th>{{ 'admin.table.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (u of users(); track u.id) {
                <tr [class.inactive-row]="!u.isActive">
                  <td>
                    <div class="user-cell">
                      <div [class]="avatarClass(u)">{{ initials(u) }}</div>
                      <div>
                        <div class="user-name">{{ u.displayName }}</div>
                        <div class="user-username">&#64;{{ u.username }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="muted">{{ u.email || '—' }}</td>
                  <td><span class="lang-badge">{{ u.language.toUpperCase() }}</span></td>
                  <td class="muted">{{ u.createdAt | date:'dd.MM.yyyy' }}</td>
                  <td>
                    <span class="status-badge" [class.active]="u.isActive" [class.inactive]="!u.isActive">
                      {{ u.isActive ? ('admin.status.active' | translate) : ('admin.status.inactive' | translate) }}
                    </span>
                  </td>
                  <td>
                    <span class="role-badge" [class.admin]="u.isAdmin" [class.user]="!u.isAdmin">
                      {{ u.isAdmin ? ('admin.role.admin' | translate) : ('admin.role.user' | translate) }}
                    </span>
                  </td>
                  <td>
                    @if (u.id !== currentUserId()) {
                      <div class="action-row">
                        <button class="btn sm" (click)="toggleActive(u)">
                          {{ u.isActive ? ('admin.action.deactivate' | translate) : ('admin.action.activate' | translate) }}
                        </button>
                        <button class="btn sm" (click)="toggleAdmin(u)">
                          {{ u.isAdmin ? ('admin.action.removeAdmin' | translate) : ('admin.action.makeAdmin' | translate) }}
                        </button>
                        <button class="btn sm" (click)="startPwChange(u)">{{ 'admin.action.password' | translate }}</button>
                        <button class="btn sm danger" (click)="deleteUser(u)">{{ 'admin.action.delete' | translate }}</button>
                      </div>
                      @if (actionErr()[u.id]) {
                        <p class="error-msg" style="font-size:.75rem;margin-top:.2rem">{{ actionErr()[u.id] }}</p>
                      }
                    } @else {
                      <span class="muted" style="font-size:.75rem">{{ 'admin.me' | translate }}</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `
})
export class AdminUsersComponent implements OnInit {
  private api = inject(ApiClient);
  private auth = inject(AuthService);
  private i18n = inject(I18nService);

  users        = signal<UserSummary[]>([]);
  siteSettings = signal<SiteSettings | null>(null);
  loading      = signal(true);
  error        = signal('');
  toggleErr    = signal('');
  actionErr    = signal<Record<string, string>>({});

  showCreate    = signal(false);
  newUser       = { username: '', displayName: '', email: '', password: '', isAdmin: false };
  createLoading = signal(false);
  createErr     = signal('');

  changePwUserId   = signal<string | null>(null);
  changePwUsername = signal('');
  newPw            = '';
  pwChangeLoading  = signal(false);
  pwChangeErr      = signal('');

  currentUserId() { return this.auth.userId(); }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.listUsers().subscribe({
      next: u => { this.users.set(u); this.loading.set(false); },
      error: e => { this.error.set(e.error?.error ?? this.i18n.t('admin.err.load')); this.loading.set(false); }
    });
    this.api.getSiteSettings().subscribe({
      next: s => this.siteSettings.set(s)
    });
  }

  toggleRegistration() {
    const s = this.siteSettings();
    if (!s) return;
    this.toggleErr.set('');
    this.api.setRegistrationEnabled(!s.registrationEnabled).subscribe({
      next: () => this.siteSettings.update(prev => prev ? { ...prev, registrationEnabled: !prev.registrationEnabled } : prev),
      error: e => this.toggleErr.set(e.error?.error ?? this.i18n.t('err.save'))
    });
  }

  createUser() {
    this.createLoading.set(true); this.createErr.set('');
    this.api.adminCreateUser({
      username: this.newUser.username,
      password: this.newUser.password,
      displayName: this.newUser.displayName || undefined,
      email: this.newUser.email || undefined,
      isAdmin: this.newUser.isAdmin
    }).subscribe({
      next: () => {
        this.newUser = { username: '', displayName: '', email: '', password: '', isAdmin: false };
        this.showCreate.set(false);
        this.createLoading.set(false);
        this.load();
      },
      error: e => { this.createErr.set(e.error?.error ?? this.i18n.t('err.save')); this.createLoading.set(false); }
    });
  }

  toggleActive(u: UserSummary) {
    this.api.setUserActive(u.id, !u.isActive).subscribe({
      next: () => this.load(),
      error: e => this.setActionErr(u.id, e.error?.error ?? this.i18n.t('err.save'))
    });
  }

  toggleAdmin(u: UserSummary) {
    const key = u.isAdmin ? 'admin.confirm.removeAdmin' : 'admin.confirm.makeAdmin';
    if (!confirm(this.i18n.t(key).replace('__NAME__', u.username))) return;
    this.api.setUserAdmin(u.id, !u.isAdmin).subscribe({
      next: () => this.load(),
      error: e => this.setActionErr(u.id, e.error?.error ?? this.i18n.t('err.save'))
    });
  }

  startPwChange(u: UserSummary) {
    this.changePwUserId.set(u.id);
    this.changePwUsername.set(u.username);
    this.newPw = '';
    this.pwChangeErr.set('');
  }

  cancelPwChange() { this.changePwUserId.set(null); }

  submitPwChange() {
    const id = this.changePwUserId();
    if (!id) return;
    this.pwChangeLoading.set(true); this.pwChangeErr.set('');
    this.api.adminChangeUserPassword(id, this.newPw).subscribe({
      next: () => { this.cancelPwChange(); this.pwChangeLoading.set(false); },
      error: e => { this.pwChangeErr.set(e.error?.error ?? this.i18n.t('err.save')); this.pwChangeLoading.set(false); }
    });
  }

  deleteUser(u: UserSummary) {
    if (!confirm(this.i18n.t('admin.confirm.delete').replace('__NAME__', u.username))) return;
    this.api.adminDeleteUser(u.id).subscribe({
      next: () => this.load(),
      error: e => this.setActionErr(u.id, e.error?.error ?? this.i18n.t('err.delete'))
    });
  }

  private setActionErr(id: string, msg: string) {
    this.actionErr.update(prev => ({ ...prev, [id]: msg }));
  }

  initials(u: UserSummary) {
    return u.displayName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  avatarClass(u: UserSummary) {
    const colors = ['av-blue', 'av-green', 'av-purple', 'av-orange', 'av-rose'];
    return `user-avatar ${colors[u.username.charCodeAt(0) % colors.length]}`;
  }
}
