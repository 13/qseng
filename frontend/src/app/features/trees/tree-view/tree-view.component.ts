import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit,
  computed, inject, signal, viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { Subject, catchError, debounceTime, forkJoin, of } from 'rxjs';
import { ApiClient, Person, Sex } from '../../../core/api/api-client.service';
import { TreeGraphService } from './tree-graph.service';
import { UI_REL_TYPES, UiRelType, toApiRelationship } from './tree-graph.model';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { PartialDatePipe } from '../../../shared/pipes/partial-date.pipe';

function initials(p: Person): string {
  return ((p.firstName?.[0] ?? '') + (p.lastName?.[0] ?? '')).toUpperCase();
}
function sexCls(sex: Sex): string { return sex.toLowerCase(); }

@Component({
  selector: 'qs-tree-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TreeGraphService],
  imports: [RouterLink, FormsModule, NgClass, TranslatePipe, PartialDatePipe],
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
          <input type="search" [ngModel]="searchTerm()" (ngModelChange)="onSearch($event)"
                 [placeholder]="'tree.filter' | translate"
                 [attr.aria-label]="'tree.filter' | translate">
        </div>

        <ul class="person-sidebar__list" role="listbox" [attr.aria-label]="'tree.peopleList' | translate">
          @for (p of filteredPersons(); track p.id) {
            <li>
              <button type="button" class="person-row"
                      role="option"
                      [attr.aria-selected]="graph.selectedId() === p.id"
                      [class.active]="graph.selectedId() === p.id"
                      (click)="select(p.id)"
                      (dblclick)="open(p.id)">
                @if (p.avatarUrl) {
                  <img class="avatar-photo sm" [src]="p.avatarUrl" alt="" loading="lazy">
                } @else {
                  <span class="avatar sm" [ngClass]="sexCls(p.sex)" aria-hidden="true">{{ initials(p) }}</span>
                }
                <span class="person-row__name">{{ p.lastName }}, {{ p.firstName }}</span>
                @if (p.birth?.year) { <span class="person-row__year">{{ p.birth!.year }}</span> }
              </button>
            </li>
          } @empty {
            <li class="person-sidebar__empty">{{ 'tree.noResults' | translate }}</li>
          }
        </ul>

        <div class="person-sidebar__add-btn">
          <button class="btn ghost sm" style="width:100%;justify-content:center"
                  [routerLink]="['/trees', treeId, 'persons', 'new']">
            {{ 'tree.addPerson' | translate }}
          </button>
        </div>

        <!-- Add Relationship -->
        @if (persons().length >= 2) {
          <div class="rel-panel">
            <p class="rel-panel__title">{{ 'tree.addRel' | translate }}</p>

            <label class="field-lbl" style="font-size:.72rem;margin-bottom:.4rem">
              {{ 'tree.relType' | translate }}
              <select [ngModel]="relType()" (ngModelChange)="relType.set($event)"
                      style="font-size:.82rem;padding:.3rem .45rem">
                @for (t of uiRelTypes; track t) {
                  <option [value]="t">{{ i18n.dynamic('rel.' + t.toLowerCase()) }}</option>
                }
              </select>
            </label>

            <div class="rel-search-field">
              <label class="field-lbl" style="font-size:.72rem" for="rel-from">{{ 'tree.relFrom' | translate }}</label>
              <div class="rel-search-input-wrap">
                <input id="rel-from" [ngModel]="fromSearch()" (ngModelChange)="onFromSearch($event)"
                       [placeholder]="'tree.relFromPlaceholder' | translate"
                       autocomplete="off" style="font-size:.82rem;padding:.3rem .45rem">
                @if (fromFiltered().length) {
                  <div class="rel-suggestions">
                    @for (p of fromFiltered(); track p.id) {
                      <button type="button" class="rel-suggestions__item" (click)="pickFrom(p)">
                        {{ p.firstName }} {{ p.lastName }}
                        @if (p.birth?.year) { <span class="rel-suggestions__year">{{ p.birth!.year }}</span> }
                      </button>
                    }
                  </div>
                }
              </div>
            </div>

            <div class="rel-search-field">
              <label class="field-lbl" style="font-size:.72rem" for="rel-to">{{ 'tree.relTo' | translate }}</label>
              <div class="rel-search-input-wrap">
                <input id="rel-to" [ngModel]="toSearch()" (ngModelChange)="onToSearch($event)"
                       [placeholder]="'tree.relToPlaceholder' | translate"
                       autocomplete="off" style="font-size:.82rem;padding:.3rem .45rem">
                @if (toFiltered().length) {
                  <div class="rel-suggestions">
                    @for (p of toFiltered(); track p.id) {
                      <button type="button" class="rel-suggestions__item" (click)="pickTo(p)">
                        {{ p.firstName }} {{ p.lastName }}
                        @if (p.birth?.year) { <span class="rel-suggestions__year">{{ p.birth!.year }}</span> }
                      </button>
                    }
                  </div>
                }
              </div>
            </div>

            <div class="rel-panel-row">
              <button class="btn primary sm" [disabled]="!canAddRel() || savingRel()" (click)="addRelationship()">
                {{ savingRel() ? ('saving' | translate) : ('tree.relAdd' | translate) }}
              </button>
            </div>
            @if (relError()) {
              <p class="error-msg" role="alert" style="margin-top:.35rem;font-size:.78rem">{{ relError() }}</p>
            }
          </div>
        }
      </div>

      <!-- Graph canvas -->
      <div class="cy-wrap">
        @if (loadError()) {
          <div class="cy-overlay">
            <div class="empty-state">
              <span class="empty-icon">⚠️</span>
              <p>{{ loadError() }}</p>
              <button class="btn sm" (click)="load()">{{ 'retry' | translate }}</button>
            </div>
          </div>
        } @else if (loading() || graph.loading()) {
          <div class="cy-overlay">
            <div class="graph-skeleton" role="status" [attr.aria-label]="'loading' | translate">
              <div class="graph-spinner"></div>
              <p class="muted">{{ 'loading' | translate }}</p>
            </div>
          </div>
        } @else if (persons().length === 0) {
          <div class="cy-overlay">
            <div class="empty-state">
              <span class="empty-icon">🌱</span>
              <p>{{ 'tree.emptyTitle' | translate }}</p>
              <div style="display:flex;gap:.5rem;margin-top:.75rem">
                <button class="btn primary sm" [routerLink]="['/trees', treeId, 'persons', 'new']">
                  {{ 'tree.addPerson' | translate }}
                </button>
                <button class="btn sm" [routerLink]="['/trees', treeId, 'import']">
                  {{ 'tree.import' | translate }}
                </button>
              </div>
            </div>
          </div>
        }

        <div class="cy-controls">
          <button (click)="graph.fit()" [title]="'tree.fit' | translate" [attr.aria-label]="'tree.fit' | translate">⊡</button>
          <button (click)="graph.zoomIn()" [title]="'tree.zoomIn' | translate" [attr.aria-label]="'tree.zoomIn' | translate">+</button>
          <button (click)="graph.zoomOut()" [title]="'tree.zoomOut' | translate" [attr.aria-label]="'tree.zoomOut' | translate">−</button>
          <button (click)="graph.toggleLayout()" class="cy-controls__wide"
                  [title]="'tree.layoutToggle' | translate">
            {{ graph.layoutMode() === 'auto' ? ('tree.layoutTree' | translate) : ('tree.layoutAuto' | translate) }}
          </button>
          @if (graph.hasCustomLayout()) {
            <button (click)="graph.resetLayout()" [title]="'tree.resetLayout' | translate"
                    [attr.aria-label]="'tree.resetLayout' | translate">↺</button>
          }
          <button (click)="exportPng()" [title]="'tree.export' | translate" [attr.aria-label]="'tree.export' | translate">⭳</button>
        </div>

        <div class="cy-host" #cyHost
             tabindex="0"
             role="application"
             [attr.aria-label]="'tree.graphLabel' | translate"
             (keydown)="onGraphKey($event)"></div>

        <!-- Selection preview: inspect without leaving the graph -->
        @if (selectedPerson(); as p) {
          <div class="cy-preview" role="dialog" [attr.aria-label]="p.firstName + ' ' + p.lastName">
            @if (p.avatarUrl) {
              <img class="avatar-photo lg" [src]="p.avatarUrl" alt="">
            } @else {
              <div class="avatar lg" [ngClass]="sexCls(p.sex)" aria-hidden="true">{{ initials(p) }}</div>
            }
            <div class="cy-preview__info">
              <h3>{{ p.firstName }} {{ p.lastName }}</h3>
              @if (p.maidenName) { <p class="muted">{{ 'pe.maidenName' | translate }}: {{ p.maidenName }}</p> }
              <p class="muted">
                @if (p.birth) { * {{ p.birth | partialDate }} }
                @if (p.birth && p.death) { · }
                @if (p.death) { † {{ p.death | partialDate }} }
              </p>
              <div class="cy-preview__actions">
                <a class="btn primary sm" [routerLink]="['/persons', p.id]">{{ 'tree.openProfile' | translate }}</a>
                <button class="btn sm ghost" (click)="graph.select(null)">{{ 'tree.clearSelection' | translate }}</button>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .cy-wrap { position: relative; overflow: hidden; }
    .cy-host { width: 100%; height: 100%; outline: none; }
    .cy-host:focus-visible { box-shadow: inset 0 0 0 2px var(--c-accent); }

    .cy-overlay {
      position: absolute; inset: 0; z-index: 20;
      display: flex; align-items: center; justify-content: center;
      background: var(--c-bg);
    }

    .graph-skeleton { display: flex; flex-direction: column; align-items: center; gap: .75rem; }
    .graph-spinner {
      width: 34px; height: 34px; border-radius: 50%;
      border: 3px solid var(--c-border);
      border-top-color: var(--c-accent);
      animation: spin .7s linear infinite;
    }

    .cy-controls__wide { width: auto !important; padding: .15rem .4rem !important; font-size: .72rem !important; }

    .cy-preview {
      position: absolute; left: .875rem; bottom: .875rem; z-index: 15;
      display: flex; gap: .875rem; align-items: center;
      max-width: 340px; padding: .875rem 1rem;
      background: var(--c-bg);
      border: 1px solid var(--c-border);
      border-radius: var(--r-lg);
      box-shadow: 0 8px 32px rgba(0,0,0,.14);
      animation: preview-in 160ms ease-out;
    }
    .cy-preview__info { min-width: 0; }
    .cy-preview__info h3 { font-size: .95rem; margin: 0 0 .1rem; }
    .cy-preview__info p { margin: 0; font-size: .78rem; }
    .cy-preview__actions { display: flex; gap: .4rem; margin-top: .6rem; }

    @keyframes preview-in { from { opacity: 0; transform: translateY(6px); } }

    .person-sidebar__list { list-style: none; margin: 0; }
    .person-sidebar__empty { padding: .75rem; font-size: .82rem; color: var(--c-text-3); }
    .person-row { width: 100%; border: none; background: transparent; text-align: left; font: inherit; }

    .rel-search-field { margin-bottom: .4rem; }
    .rel-search-input-wrap { position: relative; }
    .rel-suggestions {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 50;
      background: var(--c-bg);
      border: 1px solid var(--c-border);
      border-radius: var(--r-md);
      box-shadow: 0 4px 16px rgba(0,0,0,.1);
      max-height: 160px; overflow-y: auto;
    }
    .rel-suggestions__item {
      display: flex; align-items: center; gap: .4rem; width: 100%;
      padding: .4rem .6rem; font-size: .82rem; text-align: left;
      background: transparent; border: none; border-radius: 0; font: inherit;
      cursor: pointer;
      &:hover, &:focus-visible { background: var(--c-accent-sub); }
    }
    .rel-suggestions__year { font-size: .7rem; color: var(--c-text-4); margin-left: auto; }

    @media (prefers-reduced-motion: reduce) {
      .graph-spinner { animation: none; }
      .cy-preview { animation: none; }
    }
  `]
})
export class TreeViewComponent implements OnInit {
  private readonly cyHost = viewChild.required<ElementRef<HTMLElement>>('cyHost');

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly graph = inject(TreeGraphService);
  readonly i18n = inject(I18nService);

  readonly treeId = this.route.snapshot.paramMap.get('treeId')!;

  readonly treeName = signal('');
  readonly persons = signal<Person[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly searchTerm = signal('');

  readonly relType = signal<UiRelType>('Parent');
  readonly fromSearch = signal('');
  readonly toSearch = signal('');
  readonly selectedFrom = signal<Person | null>(null);
  readonly selectedTo = signal<Person | null>(null);
  readonly relError = signal('');
  readonly savingRel = signal(false);

  readonly uiRelTypes = UI_REL_TYPES;
  readonly initials = initials;
  readonly sexCls = sexCls;

  private readonly searchInput$ = new Subject<string>();

  readonly filteredPersons = computed(() => {
    const t = this.searchTerm().trim().toLowerCase();
    if (!t) return this.persons();
    return this.persons().filter(p =>
      p.firstName.toLowerCase().includes(t) ||
      p.lastName.toLowerCase().includes(t) ||
      (p.maidenName?.toLowerCase().includes(t) ?? false)
    );
  });

  readonly selectedPerson = computed(() => {
    const id = this.graph.selectedId();
    return id ? this.persons().find(p => p.id === id) ?? null : null;
  });

  readonly canAddRel = computed(() => {
    const from = this.selectedFrom();
    const to = this.selectedTo();
    return !!from && !!to && from.id !== to.id;
  });

  readonly fromFiltered = computed(() => this.matchPersons(this.fromSearch(), this.selectedFrom()));
  readonly toFiltered = computed(() => this.matchPersons(this.toSearch(), this.selectedTo()));

  constructor() {
    // Sidebar filters instantly; graph dimming is debounced so large trees
    // don't restyle on every keystroke.
    this.searchInput$
      .pipe(debounceTime(150), takeUntilDestroyed())
      .subscribe(term => this.graph.searchTerm.set(term));
  }

  ngOnInit() {
    this.api.getTrees().subscribe(trees => {
      const t = trees.find(x => x.id === this.treeId);
      if (t) this.treeName.set(t.name);
    });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.loadError.set('');

    forkJoin({
      persons: this.api.getPersonsByTree(this.treeId),
      rels: this.api.getRelationships(this.treeId)
    })
      .pipe(
        catchError((e: { error?: { error?: string } }) => {
          this.loadError.set(e.error?.error ?? this.i18n.t('err.load'));
          this.loading.set(false);
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(res => {
        if (!res) return;
        const sorted = [...res.persons].sort(
          (a, b) => (a.birth?.year ?? 9999) - (b.birth?.year ?? 9999)
        );
        this.persons.set(sorted);
        this.loading.set(false);
        if (sorted.length === 0) { this.graph.loading.set(false); return; }
        void this.graph.build(this.cyHost().nativeElement, sorted, res.rels, {
          onSelect: id => this.graph.select(id),
          onOpen: id => this.open(id)
        });
      });
  }

  onSearch(term: string) {
    this.searchTerm.set(term);
    this.searchInput$.next(term);
  }

  select(id: string) { this.graph.select(id); }
  open(id: string) { this.router.navigate(['/persons', id]); }

  exportPng() {
    this.graph.exportPng(`${this.treeName() || 'family-tree'}.png`);
  }

  onGraphKey(e: KeyboardEvent) {
    switch (e.key) {
      case '+': case '=': this.graph.zoomIn(); break;
      case '-': this.graph.zoomOut(); break;
      case '0': this.graph.fit(); break;
      case 'Escape': this.graph.select(null); break;
      default: return;
    }
    e.preventDefault();
  }

  // ── Relationship panel ──────────────────────────────────────────────────────

  private matchPersons(term: string, alreadyPicked: Person | null): Person[] {
    const s = term.toLowerCase().trim();
    if (!s || alreadyPicked) return [];
    return this.persons()
      .filter(p => p.firstName.toLowerCase().includes(s) || p.lastName.toLowerCase().includes(s))
      .slice(0, 8);
  }

  onFromSearch(term: string) {
    this.fromSearch.set(term);
    const sel = this.selectedFrom();
    if (sel && `${sel.firstName} ${sel.lastName}` !== term) this.selectedFrom.set(null);
  }

  onToSearch(term: string) {
    this.toSearch.set(term);
    const sel = this.selectedTo();
    if (sel && `${sel.firstName} ${sel.lastName}` !== term) this.selectedTo.set(null);
  }

  pickFrom(p: Person) { this.selectedFrom.set(p); this.fromSearch.set(`${p.firstName} ${p.lastName}`); }
  pickTo(p: Person)   { this.selectedTo.set(p);   this.toSearch.set(`${p.firstName} ${p.lastName}`); }

  addRelationship() {
    const from = this.selectedFrom();
    const to = this.selectedTo();
    if (!from || !to) return;

    this.relError.set('');
    this.savingRel.set(true);

    // The type describes the "From" person's role: Parent means From is the parent of To.
    this.api.createRelationship(this.treeId, toApiRelationship(this.relType(), from.id, to.id)).subscribe({
      next: () => {
        this.selectedFrom.set(null); this.selectedTo.set(null);
        this.fromSearch.set(''); this.toSearch.set('');
        this.savingRel.set(false);
        this.load();
      },
      error: (e: { error?: { error?: string } }) => {
        this.relError.set(e.error?.error ?? this.i18n.t('tree.relErr'));
        this.savingRel.set(false);
      }
    });
  }
}
