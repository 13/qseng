import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { TimelineEvent, TimelineEventType, TIMELINE_EVENT_TYPES, PartialDate } from '../../core/api/api-client.service';
import { TimelineService } from './timeline.service';
import { TimelineEventCardComponent } from './timeline-event-card.component';

@Component({
  selector: 'qs-timeline',
  standalone: true,
  imports: [FormsModule, TimelineEventCardComponent],
  animations: [
    trigger('slide', [
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
        <h3>Timeline</h3>
        <button class="sm ghost" (click)="showAdd.set(!showAdd())">
          {{ showAdd() ? '✕ Cancel' : '+ Add Event' }}
        </button>
      </div>

      @if (showAdd()) {
        <div class="add-event-form" @slide>
          <div class="form-row">
            <label>Type
              <select [(ngModel)]="newType" name="type">
                @for (t of eventTypes; track t) { <option [value]="t">{{ t }}</option> }
              </select>
            </label>
            <label>Title <input [(ngModel)]="newTitle" name="title" required placeholder="Event title"></label>
          </div>
          <div class="form-row">
            <label>Year  <input type="number" [(ngModel)]="newYear"  name="y" placeholder="YYYY"></label>
            <label>Month <input type="number" [(ngModel)]="newMonth" name="m" min="1" max="12"></label>
            <label>Day   <input type="number" [(ngModel)]="newDay"   name="d" min="1" max="31"></label>
            <label>Location <input [(ngModel)]="newLocation" name="loc" placeholder="City, Country"></label>
          </div>
          <label>Description
            <textarea [(ngModel)]="newDesc" name="desc" rows="2" placeholder="Optional details…"></textarea>
          </label>
          <div class="form-actions">
            <button class="primary sm" (click)="addEvent()" [disabled]="!newTitle.trim()">Add Event</button>
          </div>
        </div>
      }

      @if (events().length === 0) {
        <div class="empty-state" style="padding:2rem 0">
          <span class="empty-icon">📅</span>
          <p>No events recorded yet.</p>
        </div>
      } @else {
        <div class="timeline-track">
          @for (group of decades(); track group.decade) {
            <div class="decade-group">
              <p class="decade-label">{{ group.decade >= 9990 ? 'Unknown date' : group.decade + 's' }}</p>
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
  styles: [`:host { display: block; }`]
})
export class TimelineComponent implements OnInit {
  readonly personId = input.required<string>();
  private readonly svc = inject(TimelineService);

  events   = signal<TimelineEvent[]>([]);
  showAdd  = signal(false);
  eventTypes = TIMELINE_EVENT_TYPES;

  newType: TimelineEventType = 'Custom';
  newTitle = '';
  newLocation = '';
  newDesc = '';
  newYear?: number;
  newMonth?: number;
  newDay?: number;

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
      .sort(([a], [b]) => a - b)
      .map(([decade, events]) => ({ decade, events }));
  });

  ngOnInit() { this.load(); }

  load() { this.svc.list(this.personId()).subscribe(e => this.events.set(e)); }

  addEvent() {
    if (!this.newTitle.trim()) return;
    const start: PartialDate | undefined = this.newYear
      ? { year: this.newYear, month: this.newMonth, day: this.newDay }
      : undefined;
    this.svc.add(this.personId(), {
      type: this.newType,
      title: this.newTitle.trim(),
      location: this.newLocation || undefined,
      description: this.newDesc || undefined,
      start
    }).subscribe(ev => {
      this.events.update(list => [...list, ev].sort((a, b) =>
        (a.start?.year ?? 9999) - (b.start?.year ?? 9999)));
      this.newTitle = '';
      this.newLocation = '';
      this.newDesc = '';
      this.newYear = undefined;
      this.newMonth = undefined;
      this.newDay = undefined;
      this.showAdd.set(false);
    });
  }

  onSaved(original: TimelineEvent, patch: Partial<TimelineEvent>) {
    this.svc.update(this.personId(), original.id, patch).subscribe(updated =>
      this.events.update(list => list.map(e => e.id === updated.id ? updated : e))
    );
  }

  onRemoved(id: string) {
    if (!confirm('Delete this event?')) return;
    this.svc.remove(this.personId(), id).subscribe(() =>
      this.events.update(list => list.filter(e => e.id !== id))
    );
  }
}
