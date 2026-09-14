import { Component, OnInit, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { AdminApi, UserSummaryDto } from '../../core/api/generated';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { LayoutService } from '../../core/ui/layout.service';
import { BreadcrumbService } from '../../core/ui/breadcrumb.service';
import { problemMessage } from '../../core/api/problem-details';
import { UserFormDialogComponent } from './user-form-dialog.component';
import { UserPasswordDialogComponent } from './user-password-dialog.component';

@Component({
  selector: 'qs-admin-users',
  imports: [DatePipe, NgTemplateOutlet, MatTableModule, MatSortModule, MatCardModule, MatButtonModule, MatIconModule, MatMenuModule, MatChipsModule,
            MatSlideToggleModule, MatProgressBarModule, TranslatePipe],
  template: `
    <header class="qs-page-header">
      <div>
        <h1 tabindex="-1">{{ 'admin.title' | translate }}</h1>
        <p class="qs-muted qs-page-header__sub">{{ registeredLabel() }}</p>
      </div>
      <div class="qs-page-header__actions">
        @if (!settingsUnavailable()) {
          <div class="qs-reg-toggle">
            <mat-slide-toggle [checked]="registrationEnabled()" (change)="toggleRegistration($event.checked)">
              {{ 'admin.registration' | translate }}: {{ (registrationEnabled() ? 'admin.reg.on' : 'admin.reg.off') | translate }}
            </mat-slide-toggle>
            <span class="qs-muted qs-reg-toggle__hint">{{ 'admin.reg.hint' | translate }}</span>
          </div>
        }
        <button matButton="filled" (click)="openCreate()"><mat-icon>person_add</mat-icon>{{ 'admin.create.btn' | translate }}</button>
      </div>
    </header>

    @if (error()) {
      <div class="qs-empty" role="alert">
        <mat-icon aria-hidden="true">error</mat-icon>
        <p>{{ error() }}</p>
        <button matButton="outlined" (click)="loadUsers()">{{ 'retry' | translate }}</button>
      </div>
    } @else {
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      @if (layout.handset()) {
        <div class="qs-user-cards">
          @for (u of users(); track u.id) {
            <mat-card appearance="outlined">
              <mat-card-header>
                <div matCardAvatar class="qs-avatar">{{ initials(u) }}</div>
                <mat-card-title>{{ u.displayName }} @if (isMe(u)) { <span class="qs-me">({{ 'admin.me' | translate }})</span> }</mat-card-title>
                <mat-card-subtitle>&#64;{{ u.username }} · {{ u.email || '–' }}</mat-card-subtitle>
                <ng-container *ngTemplateOutlet="actions; context: { $implicit: u }" />
              </mat-card-header>
              <mat-card-content>
                <ng-container *ngTemplateOutlet="chips; context: { $implicit: u }" />
                <p class="qs-muted">{{ 'admin.table.registered' | translate }}: {{ u.createdAt | date:'mediumDate' }}</p>
              </mat-card-content>
            </mat-card>
          }
        </div>
      } @else {
        <div class="qs-table-wrap">
          <table mat-table [dataSource]="dataSource" matSort class="qs-users-table">
            <ng-container matColumnDef="user">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'admin.table.user' | translate }}</th>
              <td mat-cell *matCellDef="let u">
                <div class="qs-user-cell">
                  <span class="qs-avatar">{{ initials(u) }}</span>
                  <div>
                    <div>{{ u.displayName }} @if (isMe(u)) { <span class="qs-me">({{ 'admin.me' | translate }})</span> }</div>
                    <div class="qs-muted">&#64;{{ u.username }}</div>
                  </div>
                </div>
              </td>
            </ng-container>
            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'admin.table.email' | translate }}</th>
              <td mat-cell *matCellDef="let u">{{ u.email || '–' }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>{{ 'admin.table.status' | translate }} / {{ 'admin.table.role' | translate }}</th>
              <td mat-cell *matCellDef="let u"><ng-container *ngTemplateOutlet="chips; context: { $implicit: u }" /></td>
            </ng-container>
            <ng-container matColumnDef="registered">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'admin.table.registered' | translate }}</th>
              <td mat-cell *matCellDef="let u">{{ u.createdAt | date:'mediumDate' }}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="qs-col-actions">{{ 'admin.table.actions' | translate }}</th>
              <td mat-cell *matCellDef="let u" class="qs-col-actions"><ng-container *ngTemplateOutlet="actions; context: { $implicit: u }" /></td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
      }
    }

    <ng-template #chips let-u>
      <mat-chip-set>
        <mat-chip [class.qs-chip-active]="u.isActive">{{ (u.isActive ? 'admin.status.active' : 'admin.status.inactive') | translate }}</mat-chip>
        <mat-chip [class.qs-chip-admin]="u.isAdmin">{{ (u.isAdmin ? 'admin.role.admin' : 'admin.role.user') | translate }}</mat-chip>
        <mat-chip>{{ (u.language ?? '').toUpperCase() }}</mat-chip>
      </mat-chip-set>
    </ng-template>

    <ng-template #actions let-u>
      <button matIconButton [matMenuTriggerFor]="menu" [attr.aria-label]="('admin.actions' | translate) + ': ' + (u.username ?? '')" class="qs-row-menu">
        <mat-icon>more_vert</mat-icon>
      </button>
      <mat-menu #menu="matMenu">
        <button mat-menu-item (click)="toggleActive(u)" [disabled]="isMe(u)">
          <mat-icon>{{ u.isActive ? 'person_off' : 'how_to_reg' }}</mat-icon>{{ (u.isActive ? 'admin.action.deactivate' : 'admin.action.activate') | translate }}
        </button>
        <button mat-menu-item (click)="toggleAdmin(u)" [disabled]="isMe(u)">
          <mat-icon>{{ u.isAdmin ? 'remove_moderator' : 'add_moderator' }}</mat-icon>{{ (u.isAdmin ? 'admin.action.removeAdmin' : 'admin.action.makeAdmin') | translate }}
        </button>
        <button mat-menu-item (click)="changePassword(u)" [disabled]="isMe(u)"><mat-icon>key</mat-icon>{{ 'admin.action.password' | translate }}</button>
        <button mat-menu-item (click)="deleteUser(u)" [disabled]="isMe(u)"><mat-icon>delete</mat-icon>{{ 'admin.action.delete' | translate }}</button>
      </mat-menu>
    </ng-template>
  `,
  styles: [`
    :host { display: block; }
    .qs-reg-toggle { display: flex; flex-direction: column; gap: 2px; }
    .qs-reg-toggle__hint { font-size: .8rem; }
    .qs-table-wrap { overflow-x: auto; border: 1px solid var(--mat-sys-outline-variant); border-radius: var(--mat-sys-corner-medium); }
    .qs-users-table { width: 100%; }
    .qs-user-cell { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
    .qs-avatar { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); font-weight: 600; font-size: .8rem; }
    .qs-me { color: var(--mat-sys-on-surface-variant); font-size: .85rem; }
    .qs-col-actions { width: 56px; text-align: right; }
    .qs-chip-active { --mat-chip-label-text-color: var(--mat-sys-on-primary-container); --mat-chip-elevated-container-color: var(--mat-sys-primary-container); }
    .qs-chip-admin { --mat-chip-label-text-color: var(--mat-sys-on-tertiary-container); --mat-chip-elevated-container-color: var(--mat-sys-tertiary-container); }
    .qs-user-cards { display: grid; gap: 12px; }
    .qs-row-menu { margin-left: auto; }
  `]
})
export class AdminUsersComponent implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly crumbs = inject(BreadcrumbService);
  readonly i18n = inject(I18nService);
  readonly layout = inject(LayoutService);

  readonly columns = ['user', 'email', 'status', 'registered', 'actions'];
  readonly users = signal<UserSummaryDto[]>([]);
  readonly registrationEnabled = signal(false);
  readonly settingsUnavailable = signal(false);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly dataSource = new MatTableDataSource<UserSummaryDto>([]);
  private readonly sort = viewChild(MatSort);

  constructor() {
    this.dataSource.sortingDataAccessor = (u, property) => {
      if (property === 'user') return u.displayName ?? '';
      if (property === 'registered') return u.createdAt ?? '';
      return (u as unknown as Record<string, string>)[property] ?? '';
    };
    effect(() => { this.dataSource.data = this.users(); });
    effect(() => {
      const s = this.sort();
      if (s) this.dataSource.sort = s;
    });
  }

  ngOnInit() {
    this.crumbs.set([{ label: this.i18n.t('admin.title') }]);
    this.loadUsers();
    this.loadSettings();
  }

  registeredLabel() { return this.i18n.t('admin.registered').replace('__N__', String(this.users().length)); }
  isMe(u: UserSummaryDto) { return u.id === this.auth.userId(); }
  initials(u: UserSummaryDto) { return (u.displayName ?? u.username ?? '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase(); }

  loadUsers() {
    this.loading.set(true);
    this.error.set('');
    this.api.adminListUsers().subscribe({
      next: u => { this.users.set(u); this.loading.set(false); },
      error: e => { this.error.set(problemMessage(e, this.i18n.t('admin.err.load'))); this.loading.set(false); }
    });
  }

  loadSettings() {
    this.api.adminGetSettings().subscribe({
      next: s => { this.registrationEnabled.set(s.registrationEnabled ?? false); this.settingsUnavailable.set(false); },
      error: () => this.settingsUnavailable.set(true)
    });
  }

  toggleRegistration(enabled: boolean) {
    const previous = this.registrationEnabled();
    this.registrationEnabled.set(enabled);
    this.api.adminSetRegistration({ body: { enabled } }).subscribe({
      next: () => this.toast.success(this.i18n.t('admin.saved.toast')),
      error: e => { this.registrationEnabled.set(previous); this.toast.errorFrom(e, this.i18n.t('err.save')); }
    });
  }

  async openCreate() {
    const ref = this.dialog.open<UserFormDialogComponent, unknown, UserSummaryDto | undefined>(UserFormDialogComponent, { data: {}, width: '520px', maxWidth: '95vw' });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    this.toast.success(this.i18n.t('admin.created.toast'));
    this.loadUsers();
  }

  toggleActive(u: UserSummaryDto) {
    if (!u.id || this.isMe(u)) return;
    this.api.adminSetActive({ id: u.id, body: { active: !u.isActive } }).subscribe({
      next: () => { this.toast.success(this.i18n.t('admin.saved.toast')); this.loadUsers(); },
      error: e => this.toast.errorFrom(e, this.i18n.t('err.save'))
    });
  }

  async toggleAdmin(u: UserSummaryDto) {
    if (!u.id || this.isMe(u)) return;
    const key = u.isAdmin ? 'admin.confirm.removeAdmin' : 'admin.confirm.makeAdmin';
    const ok = await this.confirm.confirm({
      title: this.i18n.t(u.isAdmin ? 'admin.action.removeAdmin' : 'admin.action.makeAdmin'),
      message: this.i18n.dynamic(key).replace('__NAME__', u.username ?? ''),
      confirmLabel: this.i18n.t('save')
    });
    if (ok !== true) return;
    this.api.adminSetAdmin({ id: u.id, body: { admin: !u.isAdmin } }).subscribe({
      next: () => { this.toast.success(this.i18n.t('admin.saved.toast')); this.loadUsers(); },
      error: e => this.toast.errorFrom(e, this.i18n.t('err.save'))
    });
  }

  async changePassword(u: UserSummaryDto) {
    if (!u.id || this.isMe(u)) return;
    const ref = this.dialog.open<UserPasswordDialogComponent, { id: string; username: string }, true | undefined>(UserPasswordDialogComponent, { data: { id: u.id, username: u.username ?? '' }, width: '440px', maxWidth: '95vw' });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    this.toast.success(this.i18n.t('admin.pw.saved'));
  }

  async deleteUser(u: UserSummaryDto) {
    if (!u.id || this.isMe(u)) return;
    const ok = await this.confirm.confirm({
      title: this.i18n.t('admin.action.delete'),
      message: this.i18n.t('admin.confirm.delete').replace('__NAME__', u.username ?? ''),
      confirmLabel: this.i18n.t('delete'), destructive: true
    });
    if (ok !== true) return;
    this.api.adminDeleteUser({ id: u.id }).subscribe({
      next: () => { this.toast.success(this.i18n.t('admin.deleted.toast')); this.loadUsers(); },
      error: e => this.toast.errorFrom(e, this.i18n.t('err.delete'))
    });
  }
}
