import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PersonsApi, TrashApi, TrashedPersonDto } from '../../core/api/generated';
import { fullName } from '../../core/models/person-helpers';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';

/**
 * Settings card listing soft-deleted people awaiting purge. Embedded (not
 * routed) inside `SettingsComponent`; see that component for the `#trash`
 * fragment scroll-to that links here from the command palette.
 */
@Component({
  selector: 'qs-trash-card',
  imports: [DatePipe, MatCardModule, MatTableModule, MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header><mat-card-title>{{ 'trash.title' | translate }}</mat-card-title></mat-card-header>
      <mat-card-content>
        <p class="qs-muted">{{ hint() }}</p>
        @if (items().length) {
          <div class="qs-table-wrap">
            <table mat-table [dataSource]="items()" class="qs-trash-table">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>{{ 'trash.col.name' | translate }}</th>
                <td mat-cell *matCellDef="let it">{{ name(it) }}</td>
              </ng-container>
              <ng-container matColumnDef="tree">
                <th mat-header-cell *matHeaderCellDef>{{ 'trash.col.tree' | translate }}</th>
                <td mat-cell *matCellDef="let it">{{ it.treeName }}</td>
              </ng-container>
              <ng-container matColumnDef="deleted">
                <th mat-header-cell *matHeaderCellDef>{{ 'trash.col.deleted' | translate }}</th>
                <td mat-cell *matCellDef="let it">{{ it.deletedAt | date:'mediumDate' }}</td>
              </ng-container>
              <ng-container matColumnDef="purge">
                <th mat-header-cell *matHeaderCellDef>{{ 'trash.col.purge' | translate }}</th>
                <td mat-cell *matCellDef="let it">{{ it.purgeAt | date:'mediumDate' }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="qs-col-actions"></th>
                <td mat-cell *matCellDef="let it" class="qs-col-actions">
                  <button matIconButton [attr.aria-label]="('trash.restore' | translate) + ': ' + name(it)" [disabled]="busy()" (click)="restore(it)">
                    <mat-icon>restore_from_trash</mat-icon>
                  </button>
                  <button matIconButton [attr.aria-label]="('trash.purge' | translate) + ': ' + name(it)" [disabled]="busy()" (click)="purge(it)">
                    <mat-icon>delete_forever</mat-icon>
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns"></tr>
            </table>
          </div>
        } @else if (!loading()) {
          <p class="qs-muted">{{ 'trash.empty' | translate }}</p>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    :host { display: block; }
    .qs-table-wrap { overflow-x: auto; }
    .qs-trash-table { width: 100%; }
    .qs-col-actions { text-align: right; white-space: nowrap; }
    mat-card-content > p:first-child { margin-top: 0; }
  `]
})
export class TrashCardComponent {
  private readonly trashApi = inject(TrashApi);
  private readonly personsApi = inject(PersonsApi);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private loadSeq = 0;

  readonly columns = ['name', 'tree', 'deleted', 'purge', 'actions'];
  readonly items = signal<TrashedPersonDto[]>([]);
  readonly retentionDays = signal(30);
  readonly loading = signal(true);
  // Disables both row buttons while a restore/purge request is in flight, so a double
  // click can't fire the same mutation twice.
  readonly busy = signal(false);

  constructor() { this.load(); }

  hint() { return this.i18n.t('trash.hint').replace('__DAYS__', String(this.retentionDays())); }
  name(it: TrashedPersonDto) { return fullName({ firstName: it.firstName ?? '', lastName: it.lastName ?? '' }); }

  load() {
    this.loading.set(true);
    const requestId = ++this.loadSeq;
    this.trashApi.trashList().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: dto => {
        if (requestId !== this.loadSeq) return;
        this.items.set(dto.items ?? []);
        this.retentionDays.set(dto.retentionDays ?? 30);
        this.loading.set(false);
      },
      error: e => {
        if (requestId !== this.loadSeq) return;
        this.loading.set(false);
        this.toast.errorFrom(e, this.i18n.t('err.load'));
      }
    });
  }

  restore(it: TrashedPersonDto) {
    if (!it.id || this.busy()) return;
    this.busy.set(true);
    this.personsApi.personsRestore({ id: it.id }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.busy.set(false); this.toast.success(this.i18n.t('trash.restored').replace('__NAME__', this.name(it))); this.load(); },
      error: e => { this.busy.set(false); this.toast.errorFrom(e, this.i18n.t('err.restore')); }
    });
  }

  async purge(it: TrashedPersonDto) {
    if (!it.id || this.busy()) return;
    // Set busy before awaiting the confirm dialog (not after), so a second purge() call
    // fired while the dialog is still open is rejected too, not just a second click on an
    // already-disabled button.
    this.busy.set(true);
    const ok = await this.confirm.confirm({
      title: this.i18n.t('trash.purge'),
      message: this.i18n.t('trash.purgeConfirm').replace('__NAME__', this.name(it)),
      confirmLabel: this.i18n.t('delete'), destructive: true
    });
    if (ok !== true) { this.busy.set(false); return; }
    this.trashApi.trashPurge({ personId: it.id }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.busy.set(false); this.toast.success(this.i18n.t('trash.purged').replace('__NAME__', this.name(it))); this.load(); },
      error: e => { this.busy.set(false); this.toast.errorFrom(e, this.i18n.t('err.delete')); }
    });
  }
}
