import { Component, OnInit, OnDestroy, ElementRef, ViewChild, signal, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { ApiClient, Person, Relationship, RELATIONSHIP_TYPES, RelationshipType, Sex } from '../../../core/api/api-client.service';

type UiRelType = RelationshipType | 'Child';
const UI_REL_TYPES: UiRelType[] = ['Parent', 'Child', 'Spouse', 'Adoptive'];
import { TreeGraphService } from './tree-graph.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

function initials(p: Person): string {
  return ((p.firstName?.[0] ?? '') + (p.lastName?.[0] ?? '')).toUpperCase();
}
function sexCls(sex: Sex): string { return sex.toLowerCase(); }

@Component({
  selector: 'qs-tree-view',
  standalone: true,
  imports: [RouterLink, FormsModule, NgClass, TranslatePipe],
  template: `
    <header class="page-header">
      <a class="back-link" routerLink="/trees">{{ 'tree.back' | translate }}</a>
      <h1>{{ treeName() }}</h1>
      <div class="header-actions">
        <button class="btn ghost sm" [routerLink]="['/trees', treeId, 'search']">{{ 'tree.search' | translate }}</button>
        <button class="btn ghost sm" [routerLink]="['/trees', treeId, 'import']">{{ 'tree.import' | translate }}</button>
        <button class="btn primary sm" [routerLink]="['/trees', treeId, 'persons', 'new']">{{ 'tree.addPerson' | translate }}</button>
      </div>
    </header>

    <div class="tree-view-layout">
      <!-- Sidebar -->
      <div class="person-sidebar">
        <div class="person-sidebar__search">
          <input [(ngModel)]="searchTerm" (ngModelChange)="onSearch($event)"
                 [placeholder]="'tree.filter' | translate">
        </div>

        <div class="person-sidebar__list">
          @for (p of filteredPersons(); track p.id) {
            <div class="person-row" [class.active]="selectedId() === p.id" (click)="select(p.id)">
              @if (p.avatarUrl) {
                <img class="avatar-photo sm" [src]="p.avatarUrl" [alt]="initials(p)">
              } @else {
                <span class="avatar sm" [ngClass]="sexCls(p.sex)">{{ initials(p) }}</span>
              }
              <span class="person-row__name">{{ p.lastName }}, {{ p.firstName }}</span>
              @if (p.birth?.year) { <span class="person-row__year">{{ p.birth!.year }}</span> }
            </div>
          }
          @if (filteredPersons().length === 0) {
            <p style="padding:.75rem;font-size:.82rem;color:var(--c-text-3)">{{ 'tree.noResults' | translate }}</p>
          }
        </div>

        <div class="person-sidebar__add-btn">
          <button class="btn ghost sm" style="width:100%;justify-content:center"
                  [routerLink]="['/trees', treeId, 'persons', 'new']">
            {{ 'tree.addPerson' | translate }}
          </button>
        </div>

        <!-- Add Relationship panel -->
        <div class="rel-panel">
          <p class="rel-panel__title">{{ 'tree.addRel' | translate }}</p>

          <label class="field-lbl" style="font-size:.72rem;margin-bottom:.4rem">
            {{ 'tree.relType' | translate }}
            <select [(ngModel)]="newRel.type" style="font-size:.82rem;padding:.3rem .45rem">
              @for (t of uiRelTypes; track t) {
                <option [value]="t">{{ i18n.t('rel.' + t.toLowerCase()) }}</option>
              }
            </select>
          </label>

          <!-- From search -->
          <div class="rel-search-field">
            <label class="field-lbl" style="font-size:.72rem">{{ 'tree.relFrom' | translate }}</label>
            <div class="rel-search-input-wrap">
              <input [ngModel]="fromSearch()" (ngModelChange)="fromSearch.set($event); onFromSearch($event)"
                     [placeholder]="'tree.relFromPlaceholder' | translate"
                     autocomplete="off" style="font-size:.82rem;padding:.3rem .45rem">
              @if (fromFiltered().length > 0 && !selectedFrom()) {
                <div class="rel-suggestions">
                  @for (p of fromFiltered(); track p.id) {
                    <div class="rel-suggestions__item" (click)="pickFrom(p)">
                      {{ p.firstName }} {{ p.lastName }}
                      @if (p.birth?.year) { <span style="font-size:.7rem;color:var(--c-text-4);margin-left:auto">{{ p.birth!.year }}</span> }
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <!-- To search -->
          <div class="rel-search-field">
            <label class="field-lbl" style="font-size:.72rem">{{ 'tree.relTo' | translate }}</label>
            <div class="rel-search-input-wrap">
              <input [ngModel]="toSearch()" (ngModelChange)="toSearch.set($event); onToSearch($event)"
                     [placeholder]="'tree.relToPlaceholder' | translate"
                     autocomplete="off" style="font-size:.82rem;padding:.3rem .45rem">
              @if (toFiltered().length > 0 && !selectedTo()) {
                <div class="rel-suggestions">
                  @for (p of toFiltered(); track p.id) {
                    <div class="rel-suggestions__item" (click)="pickTo(p)">
                      {{ p.firstName }} {{ p.lastName }}
                      @if (p.birth?.year) { <span style="font-size:.7rem;color:var(--c-text-4);margin-left:auto">{{ p.birth!.year }}</span> }
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <div class="rel-panel-row">
            <button class="btn primary sm"
                    [disabled]="!selectedFrom() || !selectedTo() || selectedFrom()!.id === selectedTo()!.id"
                    (click)="addRelationship()">
              {{ 'tree.relAdd' | translate }}
            </button>
          </div>
          @if (relError()) { <p class="error-msg" style="margin-top:.35rem;font-size:.78rem">{{ relError() }}</p> }
        </div>
      </div>

      <!-- Graph canvas -->
      <div class="cy-wrap">
        <div class="cy-controls">
          <button (click)="graph.fit()" title="Fit all">⊡</button>
          <button (click)="graph.zoomIn()" title="Zoom in">+</button>
          <button (click)="graph.zoomOut()" title="Zoom out">−</button>
          <button (click)="graph.toggleLayout()"
                  [title]="graph.layoutMode() === 'auto' ? ('tree.layoutTree' | translate) : ('tree.layoutAuto' | translate)"
                  style="font-size:.72rem;padding:.15rem .35rem">
            {{ graph.layoutMode() === 'auto' ? ('tree.layoutTree' | translate) : ('tree.layoutAuto' | translate) }}
          </button>
        </div>
        <div class="cy-host" #cyHost></div>
      </div>
    </div>
  `,
  styles: [`
    .cy-wrap { position: relative; overflow: hidden; }
    .cy-host { width: 100%; height: 100%; }
    .rel-search-field { margin-bottom: .4rem; }
    .rel-search-input-wrap { position: relative; }
    .rel-suggestions {
      position: absolute;
      top: 100%;
      left: 0; right: 0;
      z-index: 50;
      background: var(--c-bg);
      border: 1px solid var(--c-border);
      border-radius: var(--r-md);
      box-shadow: 0 4px 16px rgba(0,0,0,.1);
      max-height: 160px;
      overflow-y: auto;
    }
    .rel-suggestions__item {
      display: flex;
      align-items: center;
      gap: .4rem;
      padding: .4rem .6rem;
      font-size: .82rem;
      cursor: pointer;
      &:hover { background: var(--c-accent-sub); }
    }
  `]
})
export class TreeViewComponent implements OnInit, OnDestroy {
  @ViewChild('cyHost', { static: true }) cyHost!: ElementRef;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiClient);
  readonly graph = inject(TreeGraphService);
  readonly i18n = inject(I18nService);

  treeId = '';
  treeName = signal('');
  persons = signal<Person[]>([]);
  filteredPersons = signal<Person[]>([]);
  selectedId = signal<string | null>(null);
  relError = signal('');
  searchTerm = '';

  fromSearch = signal('');
  toSearch = signal('');
  selectedFrom = signal<Person | null>(null);
  selectedTo   = signal<Person | null>(null);

  fromFiltered = computed(() => {
    const s = this.fromSearch().toLowerCase().trim();
    if (!s || this.selectedFrom()) return [];
    return this.persons()
      .filter(p => p.firstName.toLowerCase().includes(s) || p.lastName.toLowerCase().includes(s))
      .slice(0, 8);
  });

  toFiltered = computed(() => {
    const s = this.toSearch().toLowerCase().trim();
    if (!s || this.selectedTo()) return [];
    return this.persons()
      .filter(p => p.firstName.toLowerCase().includes(s) || p.lastName.toLowerCase().includes(s))
      .slice(0, 8);
  });

  uiRelTypes = UI_REL_TYPES;
  newRel: { type: UiRelType } = { type: 'Parent' };

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
      const sorted = [...persons].sort((a, b) => (a.birth?.year ?? 9999) - (b.birth?.year ?? 9999));
      this.persons.set(sorted);
      this.filteredPersons.set(sorted);
      this.api.getRelationships(this.treeId).subscribe(rels => {
        this.graph.build(this.cyHost.nativeElement, sorted, rels, id => this.select(id));
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

  onFromSearch(term: string) {
    if (this.selectedFrom() && `${this.selectedFrom()!.firstName} ${this.selectedFrom()!.lastName}` !== term) {
      this.selectedFrom.set(null);
    }
  }

  onToSearch(term: string) {
    if (this.selectedTo() && `${this.selectedTo()!.firstName} ${this.selectedTo()!.lastName}` !== term) {
      this.selectedTo.set(null);
    }
  }

  pickFrom(p: Person) {
    this.selectedFrom.set(p);
    this.fromSearch.set(`${p.firstName} ${p.lastName}`);
  }

  pickTo(p: Person) {
    this.selectedTo.set(p);
    this.toSearch.set(`${p.firstName} ${p.lastName}`);
  }

  addRelationship() {
    const from = this.selectedFrom();
    const to   = this.selectedTo();
    if (!from || !to) return;
    this.relError.set('');
    // 'Child' means From is a child of To → swap ids and use Parent type
    const isChild = this.newRel.type === 'Child';
    const apiType: RelationshipType = isChild ? 'Parent' : (this.newRel.type as RelationshipType);
    this.api.createRelationship(this.treeId, {
      type: apiType,
      fromPersonId: isChild ? to.id   : from.id,
      toPersonId:   isChild ? from.id : to.id
    }).subscribe({
      next: () => {
        this.selectedFrom.set(null); this.selectedTo.set(null);
        this.fromSearch.set(''); this.toSearch.set('');
        this.loadGraph();
      },
      error: (e: { error?: { error?: string } }) =>
        this.relError.set(e.error?.error ?? this.i18n.t('tree.relErr'))
    });
  }
}
