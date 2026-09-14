import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PersonDto, PersonsApi, RelationshipDto, RelationshipsApi, TreeDto, TreesApi } from '../../../core/api/generated';
import { I18nService } from '../../../core/i18n/i18n.service';
import { problemMessage } from '../../../core/api/problem-details';
import { LineageIndex, indexLineage, personSearchText } from './tree-graph.model';

export type PeopleSort = 'name' | 'birth';

const byBirth = (a: PersonDto, b: PersonDto) =>
  (a.birth?.year ?? 9999) - (b.birth?.year ?? 9999) || byName(a, b);
const byName = (a: PersonDto, b: PersonDto) =>
  `${a.lastName ?? ''} ${a.firstName ?? ''}`.localeCompare(`${b.lastName ?? ''} ${b.firstName ?? ''}`);

/** One source of truth for the tree view; provided on the `trees/:treeId` route. */
@Injectable()
export class TreeStore {
  private readonly personsApi = inject(PersonsApi);
  private readonly relsApi = inject(RelationshipsApi);
  private readonly treesApi = inject(TreesApi);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private treeId = '';

  private readonly _tree = signal<TreeDto | null>(null);
  private readonly _persons = signal<PersonDto[]>([]);
  private readonly _relationships = signal<RelationshipDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal('');
  private readonly _selectedId = signal<string | null>(null);
  private readonly _filter = signal('');
  private readonly _sort = signal<PeopleSort>('birth');

  readonly tree = this._tree.asReadonly();
  readonly persons = this._persons.asReadonly();
  readonly relationships = this._relationships.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selectedId = this._selectedId.asReadonly();
  readonly filter = this._filter.asReadonly();
  readonly sort = this._sort.asReadonly();

  readonly lineage = computed<LineageIndex>(() => indexLineage(this._relationships()));
  readonly filteredPersons = computed(() => {
    const q = this._filter().trim().toLowerCase();
    const list = q ? this._persons().filter(p => personSearchText(p).includes(q)) : [...this._persons()];
    return list.sort(this._sort() === 'name' ? byName : byBirth);
  });
  readonly selectedPerson = computed(() => { const id = this._selectedId(); return id ? this.personById(id) ?? null : null; });

  load(treeId: string) {
    this.treeId = treeId;
    this._loading.set(true);
    this._error.set('');
    forkJoin({
      trees: this.treesApi.treesGetAll().pipe(catchError(() => of([] as TreeDto[]))),
      persons: this.personsApi.personsGetByTree({ treeId }),
      rels: this.relsApi.relationshipsGetByTree({ treeId }).pipe(catchError(() => of([] as RelationshipDto[])))
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => {
        this._tree.set(r.trees.find(t => t.id === treeId) ?? null);
        this._persons.set([...r.persons].sort(byBirth));
        this._relationships.set(r.rels);
        this._loading.set(false);
      },
      error: e => { this._error.set(problemMessage(e, this.i18n.t('err.load'))); this._loading.set(false); }
    });
  }
  reload() { if (this.treeId) this.load(this.treeId); }

  select(id: string | null) { this._selectedId.set(id); }
  setFilter(text: string) { this._filter.set(text); }
  setSort(sort: PeopleSort) { this._sort.set(sort); }
  personById(id: string): PersonDto | undefined { return this._persons().find(p => p.id === id); }

  relativesOf(id: string) {
    const idx = this.lineage();
    const pick = (ids: Set<string> | undefined) => [...(ids ?? [])].map(x => this.personById(x)).filter((p): p is PersonDto => !!p);
    return { parents: pick(idx.parentsOf.get(id)), spouses: pick(idx.spousesOf.get(id)), children: pick(idx.childrenOf.get(id)) };
  }
}
