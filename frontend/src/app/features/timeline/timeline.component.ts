import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { animate, style, transition, triscobar } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { ApiClient, Person, TimelineEvent, TimelineEventType, TIMELINE_EVENT_TYPES, PartialDate } from '../../core/api/api-client.service';
import { TimelineService } from './timeline.service';
import { TimelineEventCardComponent } from './timeline-event-card.component';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PartialDateInputComponent, PartialDateValue } from '../../shared/ui/partial-date-input.component';

@Component({
  selector: 'qs-timeline',
  standalone: true,
  imports: [FormsModule, TimelineEventCardComponent, TranslatePipe, PartialDateInputComponent],
  animations: [
    triscobar('slide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(6px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('140ms ease-in', style({ opacity: 0, transform: 'translateY(-4px)' }))
      ])
    ])
  ],
  template: `
    <div class="timeline-wrap">
      <div class="timeline-wrap__header">
        <h3>{{ 'tl.title' | translate }}</h3>
        <button class="btn sm ghost" (click)="showAdd.set(!showAdd())">
          {{ showAdd() ? ('tl.cancel' | translate) : ('tl.addEvent' | translate) }}
        </button>
      </div>

      @if (showAdd()) {
        <div class="add-event-form" @slide>
          <div class="form-row">
            <label class="field-lbl">
              {{ 'tl.type' | translate }}
              <select [(ngModel)]="newType" name="type" (ngModelChange)="onTypeChange($event)">
                @for (t of eventTypes; track t) {
                  <option [value]="t">{{ i18n.eventLabel(t) }}</option>
                }
              </select>
            </label>
            <label class="field-lbl">
              {{ 'tl.eventTitle' | translate }}
              <input [(ngModel)]="newTitle" name="title" required [placeholder]="'tl.eventTitle' | translate">
            </label>
          </div>

          @if (newType === 'Marriage' && treeId()) {
            <div class="rel-search-field" style="position:relative">
              <label class="field-lbl">
                {{ 'tl.marriage.spouse' | translate }}
                <input [ngModel]="spouseSearch()" (ngModelChange)="spouseSearch.set($event); selectedSpouse.set(null)"
                       [placeholder]="'tl.marriage.spousePlaceholder' | translate"
                       autocomplete="off">
              </label>
              @if (spouseFiltered().length > 0 && !selectedSpouse()) {
                <div class="rel-suggestions">
                  @for (p of spouseFiltered(); track p.id) {
                    <div class="rel-suggestions__item" (click)="pickSpouse(p)">
                      {{ p.firstName }} {{ p.lastName }}
                      @if (p.birth?.year) { <span style="font-size:.7rem;color:var(--c-text-4);margin-left:auto">{{ p.birth!.year }}</span> }
                    </div>
                  }
                </div>
              }
            </div>
          }

          <qs-partial-date-input prefix="tl_new" [value]="newDate" (valueChange)="newDate = $event" />

          <label class="field-lbl" style="margin-top:.5rem">
            {{ 'tl.place' | translate }}
            <input [(ngModel)]="newLocation" name="loc">
          </label>
          <label class="field-lbl" style="margin-top:.5rem">
            {{ 'tl.desc' | translate }}
            <textarea [(ngModel)]="newDesc" name="desc" rows="2"></textarea>
          </label>
          <div class="form-actions">
            <button class="btn primary sm" (click)="addEvent()" [disabled]="!newTitle.trim()">
              {{ 'tl.add' | translate }}
            </button>
          </div>
        </div>
      }

      @if (events().length === 0) {
        <div class="empty-state" style="padding:2rem 0">
          <span class="empty-icon">📅</span>
          <p>{{ 'tl.noEvents' | translate }}</p>
        </div>
      } @else {
        <div class="timeline-track">
          @for (group of decades(); track group.decade) {
            <div class="decade-group">
              <p class="decade-label">
                {{ group.decade >= 9990 ? ('tl.unknownDate' | translate) : (group.decade + ('tl.era' | translate)) }}
              </p>
              @for (e of group.events; track e.id) {
                <div class="tl-item" @slide>
                  <span class="tl-dot" [attr.data-type]="e.type"></span>
                  <qs-timeline-event-card
                    [ev]="e"
                    (saved)="onSaved(e, $event)"
                    (removed)="onRemoved(e.id)" />
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .rel-search-field { position: relative; }
    .rel-suggestions {
      position: absolute;
      top: 100%; left: 0; right: 0;
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
export class TimelineComponent implements OnInit {
  readonly personId = input.required<string>();
  readonly treeId   = input<string>('');

  private readonly svc = inject(TimelineService);
  private readonly api = inject(ApiClient);
  readonly i18n = inject(I18nService);

  events     = signal<TimelineEvent[]>([]);
  showAdd    = signal(false);
  eventTypes = TIMELINE_EVENT_TYPES;

  treePersons    = signal<Person[]>([]);
  spouseSearch   = signal('');
  selectedSpouse = signal<Person | null>(null);

  spouseFiltered = computed(() => {
    const s = this.spouseSearch().toLowerCase().trim();
    if (!s || this.selectedSpouse()) return [];
    return this.treePersons()
      .filter(p => p.id !== this.personId() &&
        (p.firstName.toLowerCase().includes(s) || p.lastName.toLowerCase().includes(s)))
      .slice(0, 8);
  });

  newType: TimelineEventType = 'Custom';
  newTitle    = '';
  newLocation = '';
  newDesc     = '';
  newDate: PartialDateValue = {};

  decades = computed(() => {
    const groups = new Map<number, TimelineEvent[]>();
    for (const e of this.events()) {
      const y = e.start?.year ?? 9999;
      const decade = Math.floor(y / 10) * 10;
      const arr = groups.get(decade) ?? [];
      arr.push(e);
      groups.set(decade, arr);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => {
        if (a >= 9990) return 1;   // unknown-date group always last
        if (b >= 9990) return -1;
        return b - a;              // newest decade first
      })
      .map(([decade, events]) => ({ decade, events }));
  });

  ngOnInit() {
    this.load();
    const tid = this.treeId();
    if (tid) this.api.getPersonsByTree(tid).subscribe(p => this.treePersons.set(p));
  }

  load() { this.svc.list(this.personId()).subscribe(e => this.events.set(e)); }

  onTypeChange(type: TimelineEventType) {
    if (type === 'Marriage' && !this.newTitle) this.newTitle = this.i18n.eventLabel('Marriage');
    if (type !== 'Marriage') { this.spouseSearch.set(''); this.selectedSpouse.set(null); }
  }

  pickSpouse(p: Person) {
    this.selectedSpouse.set(p);
    this.spouseSearch.set(`${p.firstName} ${p.lastName}`);
    if (!this.newTitle || this.newTitle === this.i18n.eventLabel('Marriage')) {
      this.newTitle = `${this.i18n.eventLabel('Marriage')} – ${p.firstName} ${p.lastName}`;
    }
  }

  addEvent() {
    if (!this.newTitle.trim()) return;
    const start: PartialDate | undefined = this.newDate.year
      ? { year: this.newDate.year, month: this.newDate.month, day: this.newDate.day }
      : undefined;
    this.svc.add(this.personId(), {
      type: this.newType,
      title: this.newTitle.trim(),
      location: this.newLocation || undefined,
      description: this.newDesc || undefined,
      start
    }).subscribe(ev => {
      this.events.update(list => [...list, ev].sort((a, b) =>
        (b.start?.year ?? -1) - (a.start?.year ?? -1)));
      this.newTitle    = '';
      this.newLocation = '';
      this.newDesc     = '';
      this.newDate     = {};
      this.spouseSearch.set('');
      this.selectedSpouse.set(null);
      this.showAdd.set(false);
    });
  }

  onSaved(original: TimelineEvent, patch: Partial<TimelineEvent>) {
    this.svc.update(this.personId(), original.id, patch).subscribe(updated =>
      this.events.update(list => list.map(e => e.id === updated.id ? updated : e))
    );
  }

  onRemoved(id: string) {
    if (!confirm(this.i18n.t('tl.deleteConfirm'))) return;
    this.svc.remove(this.personId(), id).subscribe(() =>
      this.events.update(list => list.filter(e => e.id !== id))
    );
  }
}
