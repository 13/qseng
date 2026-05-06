import { Component, input, OnInit, output, signal, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiClient, Person, PersonRelation, RelationshipType } from '../../core/api/api-client.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PartialDateInputComponent, PartialDateValue } from '../../shared/ui/partial-date-input.component';

interface RelGroup { label: string; icon: string; relations: PersonRelation[]; }


@Component({
  selector: 'qs-person-relations',
  standalone: true,
  imports: [RouterLink, FormsModule, TranslatePipe, PartialDateInputComponent],
  template: `
    <div class="relations-wrap">
      <div class="relations-wrap__header">
        <h3>{{ 'fam.title' | translate }}</h3>
        <button class="btn sm ghost" (click)="showForm.set(!showForm())">
          {{ showForm() ? ('fam.cancel' | translate) : ('fam.add' | translate) }}
        </button>
      </div>

      @if (showForm()) {
        <div class="add-rel-form">
          <label class="field-lbl">
            {{ 'fam.type' | translate }}
            <select [(ngModel)]="newType" name="type">
              @for (t of uiRelTypes; track t) {
                <option [value]="t">{{ i18n.t('rel.' + t.toLowerCase()) }}</option>
              }
            </select>
          </label>

          @if (newType === 'Spouse')  { <p class="hint-text">{{ 'fam.spouse.hint'  | translate }}</p> }
          @if (newType === 'Parent')  { <p class="hint-text">{{ 'fam.parent.hint'  | translate }}</p> }
          @if (newType === 'Child')   { <p class="hint-text">{{ 'fam.child.hint'   | translate }}</p> }

          <label class="field-lbl">
            {{ 'fam.search' | translate }}
            <input [ngModel]="searchTerm()" name="search"
                   [placeholder]="'fam.placeholder' | translate"
                   (ngModelChange)="onSearchChange($event)"
                   autocomplete="off">
          </label>

          @if (filtered().length > 0) {
            <div class="suggestions">
              @for (p of filtered(); track p.id) {
                <div class="suggestions__item" [class.selected]="selectedPerson()?.id === p.id"
                     (click)="selectPerson(p)">
                  <span>{{ p.firstName }} {{ p.lastName }}</span>
                  @if (p.birth?.year) { <span class="year">{{ p.birth!.year }}</span> }
                </div>
              }
            </div>
          }

          @if (newType === 'Spouse' || newType === 'Adoptive') {
            <label class="field-lbl">
              {{ 'fam.date' | translate }}
              <qs-partial-date-input prefix="reldate"
                [value]="startDate" (valueChange)="startDate = $event" />
            </label>
            <label class="field-lbl" style="margin-top:.4rem">
              {{ 'fam.place' | translate }}
              <input [(ngModel)]="startPlace" name="place" [placeholder]="'fam.placePlaceholder' | translate">
            </label>
          }

          @if (error()) { <p class="error-msg">{{ error() }}</p> }

          <button class="btn primary sm" (click)="addRelation()" [disabled]="!selectedPerson()">
            {{ 'fam.addBtn' | translate }}
          </button>
        </div>
      }

      @for (g of groups(); track g.label) {
        @if (g.relations.length) {
          <div class="rel-group">
            <p class="rel-group__label">{{ g.icon }} {{ g.label }}</p>
            <ul class="rel-group__list">
              @for (r of g.relations; track r.relationshipId) {
                <li class="rel-item">
                  <a [routerLink]="['/persons', r.relatedPersonId]">
                    {{ r.relatedFirstName }} {{ r.relatedLastName }}
                  </a>
                  @if (r.type === 'Spouse' && r.startYear) {
                    <span class="rel-year">{{ r.startYear }}</span>
                  }
                  @if (r.type === 'Spouse' && r.notes) {
                    <span class="rel-place">📍 {{ r.notes }}</span>
                  }
                  <button class="icon-btn danger" (click)="removeRelation(r)" [title]="'remove' | translate">✕</button>
                </li>
              }
            </ul>
          </div>
        }
      }

      @if (relations().length === 0 && !showForm()) {
        <p class="empty-relations">{{ 'fam.noRels' | translate }}</p>
      }
    </div>
  `,
  styles: [`:host { display: block; }`]
})
export class PersonRelationsComponent implements OnInit {
  readonly personId = input.required<string>();
  readonly treeId   = input.required<string>();
  readonly relAdded = output<void>();

  private api = inject(ApiClient);
  readonly i18n = inject(I18nService);

  relations       = signal<PersonRelation[]>([]);
  allTreePersons  = signal<Person[]>([]);
  showForm        = signal(false);
  error           = signal('');
  selectedPerson  = signal<Person | null>(null);

  newType: RelationshipType | 'Child' = 'Parent';
  searchTerm = signal('');
  startDate: PartialDateValue = {};
  startPlace = '';
  uiRelTypes: (RelationshipType | 'Child')[] = ['Parent', 'Child', 'Spouse', 'Adoptive'];

  filtered = computed(() => {
    const s = this.searchTerm().toLowerCase().trim();
    const pid = this.personId();
    if (s.length < 1) return [];
    return this.allTreePersons()
      .filter(p => p.id !== pid &&
        (p.firstName.toLowerCase().includes(s) || p.lastName.toLowerCase().includes(s)))
      .slice(0, 8);
  });

  groups = computed<RelGroup[]>(() => {
    const rels = this.relations();
    return [
      { label: this.i18n.t('fam.parents'),   icon: '👨‍👩‍👦', relations: rels.filter(r => r.type === 'Parent'  && r.direction === 'to') },
      { label: this.i18n.t('fam.children'),  icon: '👶',      relations: rels.filter(r => r.type === 'Parent'  && r.direction === 'from') },
      { label: this.i18n.t('fam.spouses'),   icon: '💍',      relations: rels.filter(r => r.type === 'Spouse') },
      { label: this.i18n.t('fam.adoptive'),  icon: '🤝',      relations: rels.filter(r => r.type === 'Adoptive') },
    ];
  });

  ngOnInit() { this.load(); }

  load() {
    this.api.getPersonRelations(this.personId()).subscribe(r => this.relations.set(r));
    this.api.getPersonsByTree(this.treeId()).subscribe(p => this.allTreePersons.set(p));
  }

  onSearchChange(term: string) {
    this.searchTerm.set(term);
    const sel = this.selectedPerson();
    if (sel && `${sel.firstName} ${sel.lastName}` !== term) this.selectedPerson.set(null);
  }

  selectPerson(p: Person) {
    this.selectedPerson.set(p);
    this.searchTerm.set(`${p.firstName} ${p.lastName}`);
  }

  addRelation() {
    const other = this.selectedPerson();
    if (!other) return;
    this.error.set('');
    // 'Child' = selected person is a parent of this person → swap
    const isChild = this.newType === 'Child';
    const apiType: RelationshipType = isChild ? 'Parent' : (this.newType as RelationshipType);
    this.api.createRelationship(this.treeId(), {
      fromPersonId: isChild ? other.id          : this.personId(),
      toPersonId:   isChild ? this.personId()   : other.id,
      type: apiType,
      startYear:  this.startDate.year,
      startMonth: this.startDate.month,
      startDay:   this.startDate.day,
      notes:      this.startPlace || undefined
    } as any).subscribe({
      next: () => { this.load(); this.resetForm(); this.relAdded.emit(); },
      error: (e: { error?: { error?: string } }) => this.error.set(e.error?.error ?? this.i18n.t('err.save'))
    });
  }

  removeRelation(r: PersonRelation) {
    const name = `${r.relatedFirstName} ${r.relatedLastName}`;
    if (!confirm(this.i18n.t('fam.removeConfirm').replace('__NAME__', name))) return;
    this.api.deleteRelationship(this.treeId(), r.relationshipId).subscribe(() =>
      this.relations.update(list => list.filter(x => x.relationshipId !== r.relationshipId))
    );
  }

  private resetForm() {
    this.selectedPerson.set(null);
    this.searchTerm.set('');
    this.startDate = {};
    this.startPlace = '';
    this.showForm.set(false);
  }
}
