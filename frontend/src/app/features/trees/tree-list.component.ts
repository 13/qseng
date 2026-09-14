import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { TreeDto, TreesApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { ToastService } from '../../core/ui/toast.service';
import { BreadcrumbService } from '../../core/ui/breadcrumb.service';
import { problemMessage } from '../../core/api/problem-details';
import { TreeFormDialogComponent, TreeFormData } from './tree-form-dialog.component';

@Component({
  selector: 'qs-tree-list',
  imports: [RouterLink, DatePipe, MatButtonModule, MatCardModule, MatIconModule, MatMenuModule, MatChipsModule, TranslatePipe],
  template: `
    <header class="qs-page-header">
      <h1 tabindex="-1">{{ 'trees.title' | translate }}</h1>
      <button matButton="filled" (click)="openCreate()">
        <mat-icon>add</mat-icon>{{ 'trees.new' | translate }}
      </button>
    </header>

    @if (loadError()) {
      <div class="qs-empty" role="alert">
        <mat-icon aria-hidden="true">error</mat-icon>
        <p>{{ loadError() }}</p>
        <button matButton="outlined" (click)="load()">{{ 'retry' | translate }}</button>
      </div>
    } @else if (!loading() && trees().length === 0) {
      <div class="qs-empty">
        <mat-icon aria-hidden="true" class="qs-empty__icon">forest</mat-icon>
        <h2>{{ 'trees.emptyTitle' | translate }}</h2>
        <p class="qs-muted">{{ 'trees.emptyHint' | translate }}</p>
        <div class="qs-empty__actions">
          <button matButton="filled" (click)="openCreate()"><mat-icon>add</mat-icon>{{ 'trees.new' | translate }}</button>
        </div>
      </div>
    } @else {
      <div class="qs-tree-grid">
        @for (tree of trees(); track tree.id) {
          <mat-card appearance="outlined" class="qs-tree-card">
            <mat-card-header>
              <mat-card-title>
                <a class="qs-tree-card__title qs-display" [routerLink]="['/trees', tree.id]">{{ tree.name }}</a>
              </mat-card-title>
              <button matIconButton [matMenuTriggerFor]="menu" [attr.aria-label]="'trees.menu' | translate" class="qs-tree-card__menu">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #menu="matMenu">
                <button mat-menu-item (click)="openRename(tree)"><mat-icon>edit</mat-icon>{{ 'trees.edit' | translate }}</button>
                <button mat-menu-item (click)="remove(tree)"><mat-icon>delete</mat-icon>{{ 'trees.delete' | translate }}</button>
              </mat-menu>
            </mat-card-header>
            <mat-card-content>
              @if (tree.description) { <p class="qs-tree-card__desc">{{ tree.description }}</p> }
              <div class="qs-tree-card__meta">
                <mat-chip-set>
                  <mat-chip disabled><mat-icon matChipAvatar>group</mat-icon>{{ tree.personCount ?? 0 }} {{ 'trees.persons' | translate }}</mat-chip>
                </mat-chip-set>
                <span class="qs-muted">{{ 'trees.created' | translate }} {{ tree.createdAt | date:'mediumDate' }}</span>
              </div>
            </mat-card-content>
            <mat-card-actions>
              <a matButton="tonal" [routerLink]="['/trees', tree.id]">{{ 'trees.open' | translate }}<mat-icon iconPositionEnd>arrow_forward</mat-icon></a>
            </mat-card-actions>
          </mat-card>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .qs-tree-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .qs-tree-card { display: flex; flex-direction: column; }
    .qs-tree-card mat-card-header { align-items: flex-start; }
    .qs-tree-card__title { font-size: 1.2rem; color: var(--mat-sys-on-surface); }
    .qs-tree-card__menu { margin-left: auto; }
    .qs-tree-card__desc { margin: 8px 0; color: var(--mat-sys-on-surface-variant); }
    .qs-tree-card__meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: .85rem; margin-top: 8px; }
    .qs-tree-card mat-card-content { flex: 1; }
  `]
})
export class TreeListComponent implements OnInit {
  private readonly api = inject(TreesApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly trees = signal<TreeDto[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');

  ngOnInit() {
    this.crumbs.set([{ label: this.i18n.t('trees.title') }]);
    this.load();
    // One-shot: the command palette's "New tree" action navigates here with ?new=1 to open
    // the create dialog, then this clears the flag so a refresh doesn't reopen it.
    firstValueFrom(this.route.queryParamMap).then(params => {
      if (params.get('new') !== '1') return;
      void this.openCreate();
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    });
  }

  load() {
    this.loading.set(true);
    this.loadError.set('');
    this.api.treesGetAll().subscribe({
      next: t => { this.trees.set(t); this.loading.set(false); },
      error: e => { this.loadError.set(problemMessage(e, this.i18n.t('trees.err.load'))); this.loading.set(false); }
    });
  }

  async openCreate() {
    const result = await this.openForm({ mode: 'create' });
    if (!result) return;
    this.toast.success(this.i18n.t('trees.created.toast'));
    this.load();
  }

  async openRename(tree: TreeDto) {
    const result = await this.openForm({ mode: 'rename', tree });
    if (!result) return;
    this.toast.success(this.i18n.t('trees.renamed.toast'));
    this.load();
  }

  async remove(tree: TreeDto) {
    const ok = await this.confirm.confirm({
      title: `${this.i18n.t('trees.delete')}: ${tree.name ?? ''}`,
      message: this.i18n.t('trees.delete.confirm'),
      confirmLabel: this.i18n.t('trees.delete'),
      destructive: true
    });
    if (ok !== true || !tree.id) return;
    this.api.treesDelete({ id: tree.id }).subscribe({
      next: () => { this.toast.success(this.i18n.t('trees.deleted.toast')); this.load(); },
      error: e => this.toast.errorFrom(e, this.i18n.t('trees.err.delete'))
    });
  }

  private openForm(data: TreeFormData): Promise<TreeDto | undefined> {
    const ref = this.dialog.open<TreeFormDialogComponent, TreeFormData, TreeDto | undefined>(TreeFormDialogComponent, { data, width: '480px', maxWidth: '95vw' });
    return firstValueFrom(ref.afterClosed());
  }
}
