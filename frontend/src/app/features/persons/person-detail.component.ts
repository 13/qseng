import { Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BreadcrumbService } from '../../core/ui/breadcrumb.service';
import { initials, lifespan, sexClass } from '../../core/models/person-helpers';
import { PartialDatePipe } from '../../shared/pipes/partial-date.pipe';
import { PersonStore } from './person.store';
import { PersonFamilyComponent } from './person-family.component';
import { TimelineComponent } from '../timeline/timeline.component';
import { PersonMediaComponent } from './person-media.component';

@Component({
  selector: 'qs-person-detail',
  imports: [RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatTabsModule, MatProgressBarModule, TranslatePipe, PartialDatePipe,
            PersonFamilyComponent, TimelineComponent, PersonMediaComponent],
  template: `
    @if (store.error()) {
      <div class="qs-empty" role="alert"><mat-icon aria-hidden="true">error</mat-icon><p>{{ store.error() }}</p>
        <a matButton="outlined" routerLink="/trees">{{ 'trees.title' | translate }}</a></div>
    } @else if (store.person(); as p) {
      <header class="qs-page-header">
        <h1 tabindex="-1" class="qs-display">{{ store.fullName() }}</h1>
        <a matButton="filled" [routerLink]="['/persons', p.id, 'edit']"><mat-icon>edit</mat-icon>{{ 'pd.edit' | translate }}</a>
      </header>

      <div class="qs-person">
        <aside class="qs-person__aside">
          <mat-card appearance="outlined" class="qs-identity">
            <div class="qs-identity__hero">
              @if (store.avatarUrl(); as url) {
                <img class="qs-identity__photo" [src]="url" [alt]="store.fullName()">
              } @else {
                <div class="qs-identity__initials" [class]="'qs-identity__initials qs-sex-' + sexClass(p.sex)" aria-hidden="true">{{ initials({ firstName: p.firstName ?? '', lastName: p.lastName ?? '' }) }}</div>
              }
              <div>
                <div class="qs-identity__name qs-display">{{ store.fullName() }}</div>
                @if (p.maidenName) { <div class="qs-muted">{{ 'pd.maiden' | translate }} {{ p.maidenName }}</div> }
                @if (span(); as s) { <div class="qs-muted">{{ s }}</div> }
              </div>
            </div>
            <dl class="qs-dl">
              @if (p.birth?.year) { <dt>{{ 'pd.birth' | translate }}</dt><dd>{{ p.birth | partialDate }}@if (p.birthPlace) { <span class="qs-muted"> · {{ p.birthPlace }}</span> }</dd> }
              @if (p.death?.year) { <dt>{{ 'pd.death' | translate }}</dt><dd>{{ p.death | partialDate }}@if (p.deathPlace) { <span class="qs-muted"> · {{ p.deathPlace }}</span> }</dd> }
              @if (p.causeOfDeath) { <dt>{{ 'pd.causeOfDeath' | translate }}</dt><dd>{{ p.causeOfDeath }}</dd> }
              @if (p.notes) { <dt>{{ 'pd.notes' | translate }}</dt><dd class="qs-pre">{{ p.notes }}</dd> }
            </dl>
            <qs-person-family />
          </mat-card>
        </aside>

        <main class="qs-person__main">
          <mat-tab-group>
            <mat-tab [label]="'pd.tab.timeline' | translate">
              <div class="qs-tab-body"><qs-timeline [personId]="p.id ?? ''" [treeId]="p.treeId ?? ''" /></div>
            </mat-tab>
            <mat-tab [label]="'pd.tab.media' | translate">
              <div class="qs-tab-body"><qs-person-media [personId]="p.id ?? ''" (avatarChanged)="store.reloadMedia()" /></div>
            </mat-tab>
          </mat-tab-group>
        </main>
      </div>
    } @else {
      <mat-progress-bar mode="indeterminate" />
    }
  `,
  styles: [`
    :host { display: block; }
    .qs-person { display: grid; grid-template-columns: minmax(280px, 360px) 1fr; gap: 24px; align-items: start; }
    .qs-identity__hero { display: flex; gap: 16px; align-items: center; margin-bottom: 12px; }
    .qs-identity__photo, .qs-identity__initials { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; flex: 0 0 auto; }
    .qs-identity__initials { display: grid; place-items: center; font-weight: 600; font-size: 1.4rem; color: #fff; }
    .qs-sex-male { background: var(--qs-sex-male); } .qs-sex-female { background: var(--qs-sex-female); } .qs-sex-unknown { background: var(--qs-sex-unknown); }
    .qs-identity__name { font-size: 1.35rem; }
    .qs-dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 12px; margin: 0; }
    .qs-dl dt { color: var(--mat-sys-on-surface-variant); font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; }
    .qs-dl dd { margin: 0; }
    .qs-pre { white-space: pre-wrap; }
    .qs-tab-body { padding: 16px 0; }
    @media (max-width: 1023.98px) { .qs-person { grid-template-columns: 1fr; } }
  `]
})
export class PersonDetailComponent {
  readonly id = input.required<string>();
  readonly store = inject(PersonStore);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly i18n = inject(I18nService);

  readonly initials = initials;
  readonly sexClass = sexClass;
  readonly span = computed(() => { const p = this.store.person(); return p ? lifespan({ firstName: '', lastName: '', birth: p.birth, death: p.death }) : ''; });

  constructor() {
    effect(() => this.store.load(this.id()));
    effect(() => {
      const p = this.store.person();
      const tree = this.store.tree();
      if (!p) return;
      this.crumbs.set([
        { label: this.i18n.t('trees.title'), link: ['/trees'] },
        { label: tree?.name ?? '…', link: ['/trees', p.treeId] },
        { label: this.store.fullName() }
      ]);
    });
  }
}
