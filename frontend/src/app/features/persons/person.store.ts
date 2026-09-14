import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MediaApi, MediaDto, PersonDto, PersonRelationDto, PersonsApi, TimelineApi, TimelineEventDto, TreeDto, TreesApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { problemMessage } from '../../core/api/problem-details';
import { fullName } from '../../core/models/person-helpers';

/** One source of truth for the person routes; provided per route so it dies with the page. */
@Injectable()
export class PersonStore {
  private readonly personsApi = inject(PersonsApi);
  private readonly treesApi = inject(TreesApi);
  private readonly timelineApi = inject(TimelineApi);
  private readonly mediaApi = inject(MediaApi);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _person = signal<PersonDto | null>(null);
  private readonly _tree = signal<TreeDto | null>(null);
  private readonly _relations = signal<PersonRelationDto[]>([]);
  private readonly _timeline = signal<TimelineEventDto[]>([]);
  private readonly _media = signal<MediaDto[]>([]);
  private readonly _treePersons = signal<PersonDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal('');

  readonly person = this._person.asReadonly();
  readonly tree = this._tree.asReadonly();
  readonly relations = this._relations.asReadonly();
  readonly timeline = this._timeline.asReadonly();
  readonly media = this._media.asReadonly();
  readonly treePersons = this._treePersons.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly fullName = computed(() => { const p = this._person(); return p ? fullName({ firstName: p.firstName ?? '', lastName: p.lastName ?? '' }) : ''; });
  readonly avatarUrl = computed(() => {
    const m = this._media();
    return (m.find(x => x.isAvatar) ?? m.find(x => x.kind === 'Photo'))?.url ?? this._person()?.avatarUrl ?? null;
  });

  load(personId: string) {
    this._loading.set(true);
    this._error.set('');
    this.personsApi.personsGetById({ id: personId }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => {
        this._person.set(p);
        const treeId = p.treeId ?? '';
        forkJoin({
          trees: this.treesApi.treesGetAll().pipe(catchError(() => of([] as TreeDto[]))),
          relations: this.personsApi.personsGetRelations({ id: personId }).pipe(catchError(() => of([] as PersonRelationDto[]))),
          timeline: this.timelineApi.timelineGet({ personId }).pipe(catchError(() => of([] as TimelineEventDto[]))),
          media: this.mediaApi.mediaGetMedia({ personId }).pipe(catchError(() => of([] as MediaDto[]))),
          persons: this.personsApi.personsGetByTree({ treeId }).pipe(catchError(() => of([] as PersonDto[])))
        }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(r => {
          this._tree.set(r.trees.find(t => t.id === treeId) ?? null);
          this._relations.set(r.relations);
          this._timeline.set(r.timeline);
          this._media.set(r.media);
          this._treePersons.set(r.persons);
          this._loading.set(false);
        });
      },
      error: e => { this._error.set(problemMessage(e, this.i18n.t('err.load'))); this._loading.set(false); }
    });
  }

  reloadRelations() { const id = this._person()?.id; if (id) this.personsApi.personsGetRelations({ id }).subscribe(r => this._relations.set(r)); }
  reloadTimeline() { const personId = this._person()?.id; if (personId) this.timelineApi.timelineGet({ personId }).subscribe(t => this._timeline.set(t)); }
  reloadMedia() { const personId = this._person()?.id; if (personId) this.mediaApi.mediaGetMedia({ personId }).subscribe(m => this._media.set(m)); }

  setPerson(p: PersonDto) { this._person.set(p); }
  upsertEvent(e: TimelineEventDto) { this._timeline.update(list => list.some(x => x.id === e.id) ? list.map(x => (x.id === e.id ? e : x)) : [...list, e]); }
  removeEvent(id: string) { this._timeline.update(list => list.filter(e => e.id !== id)); }
  addMedia(m: MediaDto) { this._media.update(list => [...list, m]); }
  removeMedia(id: string) { this._media.update(list => list.filter(m => m.id !== id)); }
  setAvatar(id: string) { this._media.update(list => list.map(m => ({ ...m, isAvatar: m.id === id }))); }
}
