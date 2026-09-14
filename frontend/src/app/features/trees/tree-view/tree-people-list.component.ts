import { Component, inject, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PersonDto } from '../../../core/api/generated';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { initials, lifespan, sexClass } from '../../../core/models/person-helpers';
import { PeopleSort, TreeStore } from './tree.store';

@Component({
  selector: 'qs-tree-people-list',
  imports: [ReactiveFormsModule, ScrollingModule, MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule, MatButtonToggleModule, MatTooltipModule, TranslatePipe],
  template: `
    <div class="qs-people">
      <div class="qs-people__tools">
        <mat-form-field class="qs-people__filter" subscriptSizing="dynamic">
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [formControl]="filterCtrl" [placeholder]="'tree.filter' | translate" [attr.aria-label]="'tree.filter' | translate">
          @if (filterCtrl.value) { <button matIconButton matSuffix type="button" (click)="filterCtrl.setValue('')" [attr.aria-label]="'cancel' | translate"><mat-icon>close</mat-icon></button> }
        </mat-form-field>
        <mat-button-toggle-group hideSingleSelectionIndicator [value]="store.sort()" (change)="setSort($event.value)" [attr.aria-label]="'tree.sort' | translate">
          <mat-button-toggle value="birth" [matTooltip]="'tree.sort.birth' | translate" [aria-label]="'tree.sort.birth' | translate"><mat-icon>cake</mat-icon></mat-button-toggle>
          <mat-button-toggle value="name" [matTooltip]="'tree.sort.name' | translate" [aria-label]="'tree.sort.name' | translate"><mat-icon>sort_by_alpha</mat-icon></mat-button-toggle>
        </mat-button-toggle-group>
      </div>
      <cdk-virtual-scroll-viewport itemSize="56" class="qs-people__viewport" role="listbox" [attr.aria-label]="'tree.peopleList' | translate">
        <button *cdkVirtualFor="let p of store.filteredPersons(); trackBy: trackId" type="button" class="qs-people__row" role="option"
                [attr.data-person-id]="p.id" [attr.aria-selected]="store.selectedId() === p.id" [class.qs-people__row--active]="store.selectedId() === p.id"
                (click)="pick(p)" (dblclick)="openPerson(p)">
          @if (p.avatarUrl) { <img class="qs-people__avatar" [src]="p.avatarUrl" alt="" loading="lazy"> }
          @else { <span [class]="'qs-people__avatar qs-people__initials qs-sex-' + sexClass(p.sex)" aria-hidden="true">{{ initials({ firstName: p.firstName ?? '', lastName: p.lastName ?? '' }) }}</span> }
          <span class="qs-people__name">{{ p.lastName }}, {{ p.firstName }}</span>
          <span class="qs-muted qs-people__span">{{ lifespan({ firstName: '', lastName: '', birth: p.birth, death: p.death }) }}</span>
        </button>
        @if (!store.filteredPersons().length) { <p class="qs-muted qs-people__empty">{{ 'tree.noResults' | translate }}</p> }
      </cdk-virtual-scroll-viewport>
    </div>
  `,
  styles: [`
    :host, .qs-people { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .qs-people__tools { display: flex; align-items: center; gap: 8px; padding: 12px 12px 4px; }
    .qs-people__filter { flex: 1; }
    .qs-people__viewport { flex: 1; min-height: 0; }
    .qs-people__row { display: flex; align-items: center; gap: 10px; width: 100%; height: 56px; padding: 0 12px; border: 0; background: transparent; text-align: left; font: inherit; color: var(--mat-sys-on-surface); cursor: pointer; border-radius: var(--mat-sys-corner-small); }
    .qs-people__row:hover { background: var(--mat-sys-surface-container); }
    .qs-people__row--active { background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container); }
    .qs-people__avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex: 0 0 auto; }
    .qs-people__initials { display: grid; place-items: center; font-size: .75rem; font-weight: 600; color: #fff; }
    .qs-people__name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .qs-people__span { font-size: .8rem; }
    .qs-people__empty { padding: 12px; }
  `]
})
export class TreePeopleListComponent {
  readonly store = inject(TreeStore);
  readonly open = output<string>();
  readonly picked = output<string>();
  readonly filterCtrl = new FormControl(this.store.filter(), { nonNullable: true });
  readonly initials = initials; readonly lifespan = lifespan; readonly sexClass = sexClass;

  constructor() { this.filterCtrl.valueChanges.subscribe(v => this.store.setFilter(v)); }

  trackId = (_: number, p: PersonDto) => p.id ?? '';
  pick(p: PersonDto) { if (p.id) { this.store.select(p.id); this.picked.emit(p.id); } }
  openPerson(p: PersonDto) { if (p.id) this.open.emit(p.id); }
  setSort(v: string) { if (v === 'name' || v === 'birth') this.store.setSort(v as PeopleSort); }
}
