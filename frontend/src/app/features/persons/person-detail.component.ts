import { Component, OnInit, signal, inject, ViewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { ApiClient, Person, Sex } from '../../core/api/api-client.service';
import { PartialDatePipe } from '../../shared/pipes/partial-date.pipe';
import { TimelineComponent } from '../timeline/timeline.component';
import { PersonRelationsComponent } from './person-relations.component';
import { PersonMediaComponent } from './person-media.component';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

function initials(p: Person): string {
  return ((p.firstName?.[0] ?? '') + (p.lastName?.[0] ?? '')).toUpperCase();
}
function sexCls(sex: Sex): string { return sex.toLowerCase(); }

@Component({
  selector: 'qs-person-detail',
  standalone: true,
  imports: [RouterLink, NgClass, PartialDatePipe, TimelineComponent, PersonRelationsComponent, PersonMediaComponent, TranslatePipe],
  template: `
    @if (person(); as p) {
      <header class="page-header">
        <a class="back-link" [routerLink]="['/trees', p.treeId]">{{ 'pd.back' | translate }}</a>
        <h1>{{ p.firstName }} {{ p.lastName }}</h1>
        <div class="header-actions">
          <a [routerLink]="['/persons', p.id, 'edit']" class="btn sm">{{ 'edit' | translate }}</a>
        </div>
      </header>

      <div class="person-detail-grid">
        <aside class="person-aside">
          <div class="person-hero">
            @if (avatarUrl()) {
              <img class="avatar-photo lg" [src]="avatarUrl()!" [alt]="p.firstName">
            } @else {
              <div class="avatar lg" [ngClass]="sexCls(p.sex)">{{ initials(p) }}</div>
            }
            <div class="person-hero__info">
              <h2>{{ p.firstName }} {{ p.lastName }}</h2>
@if (lifespan(p)) { <p>{{ lifespan(p) }}</p> }
            </div>
          </div>

          <dl class="meta-dl">
            @if (p.birth) {
              <dt>{{ 'pd.birth' | translate }}</dt>
              <dd>
                {{ p.birth | partialDate }}
                @if (p.birthPlace) { <span class="muted"> · {{ p.birthPlace }}</span> }
              </dd>
            }
            @if (p.death) {
              <dt>{{ 'pd.death' | translate }}</dt>
              <dd>
                {{ p.death | partialDate }}
                @if (p.deathPlace) { <span class="muted"> · {{ p.deathPlace }}</span> }
              </dd>
            }
            @if (p.causeOfDeath) {
              <dt>{{ 'pd.causeOfDeath' | translate }}</dt>
              <dd>{{ p.causeOfDeath }}</dd>
            }
            @if (p.notes) {
              <dt>{{ 'pd.notes' | translate }}</dt>
              <dd style="white-space:pre-wrap">{{ p.notes }}</dd>
            }
          </dl>

          <qs-person-relations [personId]="p.id" [treeId]="p.treeId" (relAdded)="timeline.load()" />
        </aside>

        <main class="person-main">
          <qs-timeline #timeline [personId]="p.id" [treeId]="p.treeId" />
          <qs-person-media [personId]="p.id" (avatarChanged)="avatarUrl.set($event)" />
        </main>
      </div>
    } @else {
      <div class="loading">{{ 'loading' | translate }}</div>
    }
  `,
  styles: [`:host { display: block; }`]
})
export class PersonDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api   = inject(ApiClient);
  readonly i18n = inject(I18nService);

  person    = signal<Person | null>(null);
  avatarUrl = signal<string | null>(null);

  readonly initials = initials;
  readonly sexCls   = sexCls;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getPerson(id).subscribe(p => this.person.set(p));
    this.api.getPersonMedia(id).subscribe(media => {
      const photo = media.find(m => m.isAvatar) ?? media.find(m => m.kind === 'Photo');
      if (photo) this.avatarUrl.set(photo.url);
    });
  }

  lifespan(p: Person): string {
    const b = p.birth?.year;
    const d = p.death?.year;
    if (b && d) return `${this.i18n.t('pd.lifespan.b')}${b} – ${this.i18n.t('pd.lifespan.d')}${d}`;
    if (b) return `${this.i18n.t('pd.lifespan.b')} ${b}`;
    if (d) return `${this.i18n.t('pd.lifespan.d')} ${d}`;
    return '';
  }
}
