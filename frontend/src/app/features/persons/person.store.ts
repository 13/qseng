import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { MediaApi, MediaDto, PersonDto, PersonRelationDto, PersonsApi, TimelineApi, TimelineEventDto, TreeDto, TreesApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { problemMessage } from '../../core/api/problem-details';
import { ToastService } from '../../core/ui/toast.service';
import { fullName } from '../../core/models/person-helpers';

/** One source of truth for the person routes; provided per route so it dies with the page. */
@Injectable()
export class PersonStore {
  private readonly personsApi = inject(PersonsApi);
  private readonly treesApi = inject(TreesApi);
  private readonly timelineApi = inject(TimelineApi);
  private readonly mediaApi = inject(MediaApi);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private inflight?: Subscription;
  private loadSeq = 0;
  private relSeq = 0;
  private timelineSeq = 0;
  private mediaSeq = 0;

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
    this.inflight?.unsubscribe();
    this._person.set(null);
    this._tree.set(null);
    this._relations.set([]);
    this._timeline.set([]);
    this._media.set([]);
    this._treePersons.set([]);
    this._loading.set(true);
    this._error.set('');
    const requestId = ++this.loadSeq;

    this.inflight = this.personsApi.personsGetById({ id: personId }).pipe(
      switchMap(p => {
        if (requestId === this.loadSeq) this._person.set(p);
        const treeId = p.treeId ?? '';
        return forkJoin({
          trees: this.treesApi.treesGetAll().pipe(catchError(() => of([] as TreeDto[]))),
          relations: this.personsApi.personsGetRelations({ id: personId }).pipe(catchError(() => of([] as PersonRelationDto[]))),
          timeline: this.timelineApi.timelineGet({ personId }).pipe(catchError(() => of([] as TimelineEventDto[]))),
          media: this.mediaApi.mediaGetMedia({ personId }).pipe(catchError(() => of([] as MediaDto[]))),
          persons: this.personsApi.personsGetByTree({ treeId }).pipe(catchError(() => of([] as PersonDto[])))
        }).pipe(map(r => ({ p, r })));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: ({ p, r }) => {
        if (requestId !== this.loadSeq) return;
        const treeId = p.treeId ?? '';
        this._tree.set(r.trees.find(t => t.id === treeId) ?? null);
        this._relations.set(r.relations);
        this._timeline.set(r.timeline);
        this._media.set(r.media);
        this._treePersons.set(r.persons);
        this._loading.set(false);
      },
      error: e => {
        if (requestId !== this.loadSeq) return;
        this._error.set(problemMessage(e, this.i18n.t('err.load')));
        this._loading.set(false);
      }
    });
  }

  reloadRelations() {
    const id = this._person()?.id;
    if (!id) return;
    const requestId = ++this.relSeq;
    this.personsApi.personsGetRelations({ id }).subscribe({
      next: r => { if (requestId === this.relSeq) this._relations.set(r); },
      error: e => { if (requestId === this.relSeq) this.toast.errorFrom(e, this.i18n.t('err.load')); }
    });
  }
  reloadTimeline() {
    const personId = this._person()?.id;
    if (!personId) return;
    const requestId = ++this.timelineSeq;
    this.timelineApi.timelineGet({ personId }).subscribe({
      next: t => { if (requestId === this.timelineSeq) this._timeline.set(t); },
      error: e => { if (requestId === this.timelineSeq) this.toast.errorFrom(e, this.i18n.t('err.load')); }
    });
  }
  reloadMedia() {
    const personId = this._person()?.id;
    if (!personId) return;
    const requestId = ++this.mediaSeq;
    this.mediaApi.mediaGetMedia({ personId }).subscribe({
      next: m => { if (requestId === this.mediaSeq) this._media.set(m); },
      error: e => { if (requestId === this.mediaSeq) this.toast.errorFrom(e, this.i18n.t('err.load')); }
    });
  }

  setPerson(p: PersonDto) { this._person.set(p); }
  upsertEvent(e: TimelineEventDto) { this._timeline.update(list => list.some(x => x.id === e.id) ? list.map(x => (x.id === e.id ? e : x)) : [...list, e]); }
  removeEvent(id: string) { this._timeline.update(list => list.filter(e => e.id !== id)); }
  addMedia(m: MediaDto) { this._media.update(list => [...list, m]); }
  removeMedia(id: string) { this._media.update(list => list.filter(m => m.id !== id)); }
  setAvatar(id: string) { this._media.update(list => list.map(m => ({ ...m, isAvatar: m.id === id }))); }
}
