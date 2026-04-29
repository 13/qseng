import { Component, OnInit, OnDestroy, ElementRef, ViewChild, signal, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { ApiClient, Person, Relationship, RELATIONSHIP_TYPES, RelationshipType, Sex } from '../../../core/api/api-client.service';
import { TreeGraphService } from './tree-graph.service';

function initials(p: Person): string {
  return ((p.firstName?.[0] ?? '') + (p.lastName?.[0] ?? '')).toUpperCase();
}
function sexCls(sex: Sex): string {
  return sex.toLowerCase();
}

@Component({
  selector: 'qs-tree-view',
  standalone: true,
  imports: [RouterLink, FormsModule, NgClass],
  template: `
    <header class="page-header">
      <a class="back-link" routerLink="/trees">← Trees</a>
      <h1>{{ treeName() }}</h1>
      <div class="header-actions">
        <button class="ghost sm" [routerLink]="['/trees', treeId, 'search']">🔍 Search</button>
        <button class="ghost sm" [routerLink]="['/trees', treeId, 'import']">↑ Import</button>
        <button class="primary sm" [routerLink]="['/trees', treeId, 'persons', 'new']">+ Person</button>
      </div>
    </header>

    <div class="tree-view-layout">
      <!-- Sidebar -->
      <div class="person-sidebar">
        <div class="person-sidebar__search">
          <input [(ngModel)]="searchTerm" (ngModelChange)="onSearch($event)"
                 placeholder="Filter people…">
        </div>

        <div class="person-sidebar__list">
          @for (p of filteredPersons(); track p.id) {
            <div class="person-row" [class.active]="selectedId() === p.id" (click)="select(p.id)">
              <span class="avatar sm" [ngClass]="sexCls(p.sex)">{{ initials(p) }}</span>
              <span class="person-row__name">{{ p.lastName }}, {{ p.firstName }}</span>
              @if (p.birth?.year) { <span class="person-row__year">{{ p.birth!.year }}</span> }
            </div>
          }
          @if (filteredPersons().length === 0) {
            <p style="padding:.75rem;font-size:.82rem;color:var(--c-text-3)">No results.</p>
          }
        </div>

        <div class="person-sidebar__add-btn">
          <button class="ghost sm" style="width:100%;justify-content:center" [routerLink]="['/trees', treeId, 'persons', 'new']">
            + Add person
          </button>
        </div>

        <!-- Add Relationship panel -->
        <div class="rel-panel">
          <p class="rel-panel__title">Add Relationship</p>
          <label>Type
            <select [(ngModel)]="newRel.type">
              @for (t of relTypes; track t) { <option [value]="t">{{ t }}</option> }
            </select>
          </label>
          <label>From
            <select [(ngModel)]="newRel.fromPersonId">
              <option value="">— select person —</option>
              @for (p of persons(); track p.id) {
                <option [value]="p.id">{{ p.firstName }} {{ p.lastName }}</option>
              }
            </select>
          </label>
          <label>To
            <select [(ngModel)]="newRel.toPersonId">
              <option value="">— select person —</option>
              @for (p of persons(); track p.id) {
                <option [value]="p.id">{{ p.firstName }} {{ p.lastName }}</option>
              }
            </select>
          </label>
          <div class="rel-panel-row">
            <button class="primary sm"
                    [disabled]="!newRel.fromPersonId || !newRel.toPersonId || newRel.fromPersonId === newRel.toPersonId"
                    (click)="addRelationship()">
              Add
            </button>
          </div>
          @if (relError()) { <p class="error-msg" style="margin-top:.35rem">{{ relError() }}</p> }
        </div>
      </div>

      <!-- Graph canvas -->
      <div class="cy-wrap">
        <div class="cy-controls">
          <button (click)="graph.fit()" title="Fit all">⊡</button>
          <button (click)="graph.zoomIn()" title="Zoom in">+</button>
          <button (click)="graph.zoomOut()" title="Zoom out">−</button>
        </div>
        <div class="cy-host" #cyHost></div>
      </div>
    </div>
  `,
  styles: [`
    .cy-wrap { position: relative; overflow: hidden; }
    .cy-host { width: 100%; height: 100%; }
  `]
})
export class TreeViewComponent implements OnInit, OnDestroy {
  @ViewChild('cyHost', { static: true }) cyHost!: ElementRef;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiClient);
  readonly graph = inject(TreeGraphService);

  treeId = '';
  treeName = signal('');
  persons = signal<Person[]>([]);
  filteredPersons = signal<Person[]>([]);
  selectedId = signal<string | null>(null);
  relError = signal('');
  searchTerm = '';

  relTypes = RELATIONSHIP_TYPES;
  newRel: { type: RelationshipType; fromPersonId: string; toPersonId: string } = {
    type: 'Parent', fromPersonId: '', toPersonId: ''
  };

  readonly initials = initials;
  readonly sexCls = sexCls;

  ngOnInit() {
    this.treeId = this.route.snapshot.paramMap.get('treeId')!;
    this.api.getTrees().subscribe(trees => {
      const t = trees.find(x => x.id === this.treeId);
      if (t) this.treeName.set(t.name);
    });
    this.loadGraph();
  }

  ngOnDestroy() { this.graph.destroy(); }

  loadGraph() {
    this.api.getPersonsByTree(this.treeId).subscribe(persons => {
      this.persons.set(persons);
      this.filteredPersons.set(persons);
      this.api.getRelationships(this.treeId).subscribe(rels => {
        this.graph.build(this.cyHost.nativeElement, persons, rels, id => this.select(id));
      });
    });
  }

  onSearch(term: string) {
    const t = term.toLowerCase();
    this.filteredPersons.set(
      t ? this.persons().filter(p =>
        p.firstName.toLowerCase().includes(t) || p.lastName.toLowerCase().includes(t))
      : this.persons()
    );
  }

  select(id: string) {
    this.selectedId.set(id);
    this.graph.highlight(id);
    this.router.navigate(['/persons', id]);
  }

  addRelationship() {
    this.relError.set('');
    this.api.createRelationship(this.treeId, {
      type: this.newRel.type,
      fromPersonId: this.newRel.fromPersonId,
      toPersonId: this.newRel.toPersonId
    }).subscribe({
      next: () => {
        this.newRel.fromPersonId = '';
        this.newRel.toPersonId = '';
        this.loadGraph();
      },
      error: (e: { error?: { error?: string } }) =>
        this.relError.set(e.error?.error ?? 'Failed to add relationship')
    });
  }
}
