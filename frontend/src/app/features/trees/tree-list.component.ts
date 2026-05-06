import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiClient, Tree } from '../../core/api/api-client.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'qs-tree-list',
  standalone: true,
  imports: [RouterLink, FormsModule, TranslatePipe],
  template: `
    <div class="trees-page">
      <div class="trees-page-header">
        <h2>{{ 'trees.title' | translate }}</h2>
        <button class="primary" (click)="showNewForm.set(!showNewForm())">
          {{ showNewForm() ? ('trees.cancel' | translate) : ('trees.new' | translate) }}
        </button>
      </div>

      @if (showNewForm()) {
        <div class="tree-new-form" style="margin-bottom:1.5rem">
          <h3>{{ 'trees.new.title' | translate }}</h3>
          <div class="fields">
            <label>
              {{ 'trees.new.name' | translate }}
              <input [(ngModel)]="newName" name="name" placeholder="Smith Family" required>
            </label>
            <label>
              {{ 'trees.new.desc' | translate }}
              <input [(ngModel)]="newDesc" name="desc" [placeholder]="'trees.optional' | translate">
            </label>
          </div>
          @if (createErr()) {
            <p class="error-msg" style="margin-bottom:.5rem">{{ createErr() }}</p>
          }
          <button class="primary" (click)="createTree()" [disabled]="!newName.trim()">
            {{ 'trees.new.submit' | translate }}
          </button>
        </div>
      }

      @if (loadErr()) {
        <div class="error-msg" role="alert">{{ loadErr() }}</div>
      } @else if (trees().length === 0 && !loading()) {
        <div class="empty-state">
          <span class="empty-icon">🌳</span>
          <p>{{ 'trees.empty' | translate }}</p>
        </div>
      } @else {
        <div class="tree-grid">
          @for (tree of trees(); track tree.id) {
            @if (editingId() === tree.id) {
              <div class="card tree-card">
                <label>
                  {{ 'trees.new.name' | translate }}
                  <input [(ngModel)]="editName" name="editName" (keydown.escape)="cancelEdit()">
                </label>
                <label style="margin-top:.5rem">
                  {{ 'trees.new.desc' | translate }}
                  <input [(ngModel)]="editDesc" name="editDesc" [placeholder]="'trees.optional' | translate" (keydown.escape)="cancelEdit()">
                </label>
                @if (editErr()) {
                  <p class="error-msg" style="font-size:.78rem;margin:.25rem 0">{{ editErr() }}</p>
                }
                <div class="tree-card__actions" style="margin-top:.5rem">
                  <button class="primary sm" (click)="saveEdit(tree.id)">{{ 'trees.save' | translate }}</button>
                  <button class="sm ghost" (click)="cancelEdit()">{{ 'trees.editCancel' | translate }}</button>
                </div>
              </div>
            } @else {
              <div class="card tree-card">
                <a class="tree-card__title" [routerLink]="['/trees', tree.id]">{{ tree.name }}</a>
                @if (tree.description) {
                  <p class="tree-card__desc">{{ tree.description }}</p>
                }
                <p class="tree-card__meta">{{ 'trees.created' | translate }} {{ formatDate(tree.createdAt) }}</p>
                @if (deleteErr()[tree.id]) {
                  <p class="error-msg" style="font-size:.75rem">{{ deleteErr()[tree.id] }}</p>
                }
                <div class="tree-card__actions">
                  <a [routerLink]="['/trees', tree.id]" class="btn primary sm">{{ 'trees.open' | translate }}</a>
                  <button class="sm ghost" (click)="startEdit(tree)">{{ 'trees.edit' | translate }}</button>
                  <button class="sm danger" (click)="deleteTree(tree.id)">{{ 'trees.delete' | translate }}</button>
                </div>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .tree-card { padding: 1.25rem; display: flex; flex-direction: column; gap: .5rem; min-height: 140px; }
    .tree-card__title { font-size: 1rem; font-weight: 600; color: var(--c-text); }
    .tree-card__title:hover { color: var(--c-accent); text-decoration: none; }
    .tree-card__desc { font-size: .85rem; color: var(--c-text-3); margin: 0; flex: 1; line-height: 1.5; }
    .tree-card__meta { font-size: .72rem; color: var(--c-text-4); margin: 0 0 .25rem; }
    .tree-card__actions { display: flex; align-items: center; gap: .4rem; margin-top: auto; }
    .tree-card label { font-size: .78rem; font-weight: 600; color: var(--c-text-2); }
  `]
})
export class TreeListComponent implements OnInit {
  private api = inject(ApiClient);
  private i18n = inject(I18nService);

  trees      = signal<Tree[]>([]);
  loading    = signal(true);
  loadErr    = signal('');
  showNewForm = signal(false);
  createErr  = signal('');

  newName = '';
  newDesc = '';

  editingId = signal<string | null>(null);
  editName  = '';
  editDesc  = '';
  editErr   = signal('');
  deleteErr = signal<Record<string, string>>({});

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getTrees().subscribe({
      next: t => { this.trees.set(t); this.loading.set(false); },
      error: e => { this.loadErr.set(e.error?.error ?? this.i18n.t('trees.err.load')); this.loading.set(false); }
    });
  }

  createTree() {
    if (!this.newName.trim()) return;
    this.createErr.set('');
    this.api.createTree(this.newName.trim(), this.newDesc.trim() || undefined).subscribe({
      next: () => { this.newName = ''; this.newDesc = ''; this.showNewForm.set(false); this.load(); },
      error: e => this.createErr.set(e.error?.error ?? this.i18n.t('trees.err.create'))
    });
  }

  startEdit(tree: Tree) {
    this.editingId.set(tree.id);
    this.editName = tree.name;
    this.editDesc = tree.description ?? '';
    this.editErr.set('');
  }

  saveEdit(id: string) {
    if (!this.editName.trim()) return;
    this.editErr.set('');
    this.api.updateTree(id, this.editName.trim(), this.editDesc.trim() || undefined).subscribe({
      next: () => { this.editingId.set(null); this.load(); },
      error: e => this.editErr.set(e.error?.error ?? this.i18n.t('trees.err.save'))
    });
  }

  cancelEdit() { this.editingId.set(null); }

  deleteTree(id: string) {
    if (!confirm(this.i18n.t('trees.delete.confirm'))) return;
    this.api.deleteTree(id).subscribe({
      next: () => this.load(),
      error: e => this.deleteErr.update(prev => ({ ...prev, [id]: e.error?.error ?? this.i18n.t('trees.err.delete') }))
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
