import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { ApiClient, Person, Sex } from '../../core/api/api-client.service';
import { PartialDatePipe } from '../../shared/pipes/partial-date.pipe';
import { TimelineComponent } from '../timeline/timeline.component';
import { PersonRelationsComponent } from './person-relations.component';

function initials(p: Person): string {
  return ((p.firstName?.[0] ?? '') + (p.lastName?.[0] ?? '')).toUpperCase();
}
function sexCls(sex: Sex): string {
  return sex.toLowerCase();
}
function lifespan(p: Person): string {
  const b = p.birth?.year;
  const d = p.death?.year;
  if (b && d) return `${b} – ${d}`;
  if (b) return `b. ${b}`;
  if (d) return `d. ${d}`;
  return '';
}

@Component({
  selector: 'qs-person-detail',
  standalone: true,
  imports: [RouterLink, NgClass, PartialDatePipe, TimelineComponent, PersonRelationsComponent],
  template: `
    @if (person(); as p) {
      <header class="page-header">
        <a class="back-link" [routerLink]="['/trees', p.treeId]">← Tree</a>
        <h1>{{ p.firstName }} {{ p.lastName }}</h1>
        @if (p.sex !== 'Unknown') {
          <span class="badge" [ngClass]="sexCls(p.sex)">{{ p.sex }}</span>
        }
        <div class="header-actions">
          <a [routerLink]="['/persons', p.id, 'edit']" class="btn sm">Edit</a>
        </div>
      </header>

      <div class="person-detail-grid">
        <aside class="person-aside">
          <!-- Hero row -->
          <div class="person-hero">
            <div class="avatar lg" [ngClass]="sexCls(p.sex)">{{ initials(p) }}</div>
            <div class="person-hero__info">
              <h2>{{ p.firstName }} {{ p.lastName }}</h2>
              @if (p.maidenName) { <p>geb. {{ p.maidenName }}</p> }
              @if (lifespan(p)) { <p>{{ lifespan(p) }}</p> }
            </div>
          </div>

          <!-- Vital stats -->
          <dl class="meta-dl">
            @if (p.birth) {
              <dt>Born</dt>
              <dd>
                {{ p.birth | partialDate }}
                @if (p.birthPlace) { <span class="muted"> · {{ p.birthPlace }}</span> }
              </dd>
            }
            @if (p.death) {
              <dt>Died</dt>
              <dd>
                {{ p.death | partialDate }}
                @if (p.deathPlace) { <span class="muted"> · {{ p.deathPlace }}</span> }
              </dd>
            }
            @if (p.notes) {
              <dt>Notes</dt>
              <dd style="white-space:pre-wrap">{{ p.notes }}</dd>
            }
          </dl>

          <!-- Relationships -->
          <qs-person-relations [personId]="p.id" [treeId]="p.treeId" />
        </aside>

        <main class="person-main">
          <qs-timeline [personId]="p.id" />
        </main>
      </div>
    } @else {
      <div class="loading">Loading…</div>
    }
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class PersonDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiClient);

  person = signal<Person | null>(null);

  readonly initials = initials;
  readonly sexCls = sexCls;
  readonly lifespan = lifespan;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getPerson(id).subscribe(p => this.person.set(p));
  }
}
