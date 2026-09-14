import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { PersonDto } from '../../../core/api/generated';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { PartialDatePipe } from '../../../shared/pipes/partial-date.pipe';
import { fullName, initials, lifespan, sexClass } from '../../../core/models/person-helpers';
import { TreeStore } from './tree.store';

@Component({
  selector: 'qs-tree-selection-panel',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatChipsModule, TranslatePipe, PartialDatePipe],
  template: `
    <div class="qs-sel">
      <div class="qs-sel__head">
        @if (person().avatarUrl) { <img class="qs-avatar qs-avatar--56" [src]="person().avatarUrl" alt=""> }
        @else { <span [class]="'qs-avatar qs-avatar--56 qs-avatar__initials qs-sex-' + sexClass(person().sex)" aria-hidden="true">{{ initials({ firstName: person().firstName ?? '', lastName: person().lastName ?? '' }) }}</span> }
        <div class="qs-sel__id">
          <div class="qs-display qs-sel__name">{{ name() }}</div>
          @if (person().maidenName) { <div class="qs-muted">{{ 'pd.maiden' | translate }} {{ person().maidenName }}</div> }
          @if (span()) { <div class="qs-muted">{{ span() }}</div> }
        </div>
        <button matIconButton (click)="closed.emit()" [attr.aria-label]="'tree.closePanel' | translate"><mat-icon>close</mat-icon></button>
      </div>
      <dl class="qs-sel__dl">
        @if (person().birth?.year) { <dt>{{ 'pd.birth' | translate }}</dt><dd>{{ person().birth | partialDate }}@if (person().birthPlace) { · {{ person().birthPlace }} }</dd> }
        @if (person().death?.year) { <dt>{{ 'pd.death' | translate }}</dt><dd>{{ person().death | partialDate }}@if (person().deathPlace) { · {{ person().deathPlace }} }</dd> }
      </dl>
      @for (g of groups(); track g.key) {
        @if (g.items.length) {
          <p class="qs-sel__label">{{ g.key | translate }}</p>
          <mat-chip-set>@for (r of g.items; track r.id) { <mat-chip (click)="goTo(r)" (keydown.enter)="goTo(r)" (keydown.space)="$event.preventDefault(); goTo(r)" tabindex="0" role="button">{{ fullName({ firstName: r.firstName ?? '', lastName: r.lastName ?? '' }) }}</mat-chip> }</mat-chip-set>
        }
      }
      <div class="qs-sel__actions">
        <a matButton="filled" [routerLink]="['/persons', person().id]">{{ 'tree.openProfile' | translate }}</a>
        <a matButton="outlined" [routerLink]="['/persons', person().id, 'edit']">{{ 'tree.edit' | translate }}</a>
        <button matButton (click)="addRelation.emit(person())"><mat-icon>person_add</mat-icon>{{ 'tree.addRel' | translate }}</button>
      </div>
    </div>
  `,
  styles: [`
    .qs-sel { display: flex; flex-direction: column; gap: 10px; padding: 16px; }
    .qs-sel__head { display: flex; align-items: center; gap: 12px; }
    .qs-sel__id { flex: 1; min-width: 0; }
    .qs-sel__name { font-size: 1.25rem; }
    .qs-sel__dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 10px; margin: 0; }
    .qs-sel__dl dt { color: var(--mat-sys-on-surface-variant); }
    .qs-sel__dl dd { margin: 0; }
    .qs-sel__label { margin: 4px 0 2px; font-size: .75rem; letter-spacing: .06em; text-transform: uppercase; color: var(--mat-sys-on-surface-variant); }
    .qs-sel__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
  `]
})
export class TreeSelectionPanelComponent {
  readonly person = input.required<PersonDto>();
  readonly closed = output<void>();
  readonly navigate = output<string>();
  readonly addRelation = output<PersonDto>();
  private readonly store = inject(TreeStore);
  readonly initials = initials; readonly fullName = fullName; readonly sexClass = sexClass;

  readonly name = computed(() => fullName({ firstName: this.person().firstName ?? '', lastName: this.person().lastName ?? '' }));
  readonly span = computed(() => lifespan({ firstName: '', lastName: '', birth: this.person().birth, death: this.person().death }));
  readonly groups = computed(() => {
    const r = this.store.relativesOf(this.person().id ?? '');
    return [{ key: 'tree.parents' as const, items: r.parents }, { key: 'tree.spouses' as const, items: r.spouses }, { key: 'tree.children' as const, items: r.children }];
  });

  goTo(p: PersonDto) { if (p.id) { this.store.select(p.id); this.navigate.emit(p.id); } }
}
