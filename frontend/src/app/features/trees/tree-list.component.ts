import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiClient, Tree } from '../../core/api/api-client.service';

@Component({
  selector: 'qs-tree-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="trees-page">
      <div class="trees-page-header">
        <h2>My Trees</h2>
        <button class="primary" (click)="showNewForm.set(!showNewForm())">
          {{ showNewForm() ? '✕ Cancel' : '+ New Tree' }}
        </button>
      </div>

      @if (showNewForm()) {
        <div class="tree-new-form" style="margin-bottom:1.5rem">
          <h3>New family tree</h3>
          <div class="fields">
            <label>Name <input [(ngModel)]="newName" name="name" placeholder="Mustermann Family" required></label>
            <label>Description <input [(ngModel)]="newDesc" name="desc" placeholder="Optional description"></label>
          </div>
          <button class="primary" (click)="createTree()" [disabled]="!newName.trim()">Create Tree</button>
        </div>
      }

      @if (trees().length === 0 && !loading()) {
        <div class="empty-state">
          <span class="empty-icon">🌳</span>
          <p>No trees yet. Create your first family tree above.</p>
        </div>
      } @else {
        <div class="tree-grid">
          @for (tree of trees(); track tree.id) {
            @if (editingId() === tree.id) {
              <div class="card tree-card">
                <label>Name
                  <input [(ngModel)]="editName" name="editName" (keydown.escape)="cancelEdit()">
                </label>
                <label style="margin-top:.5rem">Description
                  <input [(ngModel)]="editDesc" name="editDesc" placeholder="Optional" (keydown.escape)="cancelEdit()">
                </label>
                <div class="tree-card__actions" style="margin-top:.5rem">
                  <button class="primary sm" (click)="saveEdit(tree.id)">Save</button>
                  <button class="sm ghost" (click)="cancelEdit()">Cancel</button>
                </div>
              </div>
            } @else {
              <div class="card tree-card">
                <a class="tree-card__title" [routerLink]="['/trees', tree.id]">{{ tree.name }}</a>
                @if (tree.description) {
                  <p class="tree-card__desc">{{ tree.description }}</p>
                }
                <p class="tree-card__meta">Created {{ formatDate(tree.createdAt) }}</p>
                <div class="tree-card__actions">
                  <a [routerLink]="['/trees', tree.id]" class="btn primary sm">Open</a>
                  <button class="sm ghost" (click)="startEdit(tree)" title="Rename">✏️ Edit</button>
                  <button class="sm danger" (click)="deleteTree(tree.id)" title="Delete">Delete</button>
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

  trees = signal<Tree[]>([]);
  loading = signal(true);
  showNewForm = signal(false);

  newName = '';
  newDesc = '';

  editingId = signal<string | null>(null);
  editName = '';
  editDesc = '';

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getTrees().subscribe(t => { this.trees.set(t); this.loading.set(false); });
  }

  createTree() {
    if (!this.newName.trim()) return;
    this.api.createTree(this.newName.trim(), this.newDesc.trim() || undefined).subscribe(() => {
      this.newName = '';
      this.newDesc = '';
      this.showNewForm.set(false);
      this.load();
    });
  }

  startEdit(tree: Tree) {
    this.editingId.set(tree.id);
    this.editName = tree.name;
    this.editDesc = tree.description ?? '';
  }

  saveEdit(id: string) {
    if (!this.editName.trim()) return;
    this.api.updateTree(id, this.editName.trim(), this.editDesc.trim() || undefined).subscribe(() => {
      this.editingId.set(null);
      this.load();
    });
  }

  cancelEdit() { this.editingId.set(null); }

  deleteTree(id: string) {
    if (!confirm('Delete this tree and all its data?')) return;
    this.api.deleteTree(id).subscribe(() => this.load());
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
