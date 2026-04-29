import { Component, input, OnInit, signal, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiClient, Person, PersonRelation, RelationshipType, RELATIONSHIP_TYPES } from '../../core/api/api-client.service';

interface RelGroup { label: string; icon: string; relations: PersonRelation[]; }

@Component({
  selector: 'qs-person-relations',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="relations-wrap">
      <div class="relations-wrap__header">
        <h3>Family</h3>
        <button class="sm ghost" (click)="showForm.set(!showForm())">
          {{ showForm() ? '✕' : '+ Add' }}
        </button>
      </div>

      @if (showForm()) {
        <div class="add-rel-form">
          <label>Relationship type
            <select [(ngModel)]="newType" name="type">
              @for (t of relTypes; track t) { <option [value]="t">{{ t }}</option> }
            </select>
          </label>

          <label>{{ newType === 'Parent' ? 'Child' : 'Related person' }}
            <input [(ngModel)]="searchTerm" name="search"
                   placeholder="Search by name…"
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
            <div style="display:flex;gap:.5rem">
              <label>Start year  <input type="number" [(ngModel)]="startYear"  name="sy" placeholder="YYYY"></label>
              <label>Start month <input type="number" [(ngModel)]="startMonth" name="sm" min="1" max="12"></label>
            </div>
          }

          @if (error()) { <p class="error-msg">{{ error() }}</p> }

          <button class="primary sm" (click)="addRelation()" [disabled]="!selectedPerson()">
            Add relationship
          </button>
        </div>
      }

      @for (g of groups(); track g.label) {
        @if (g.relations.length) {
          <div class="rel-group" style="margin-bottom:.875rem">
            <p class="rel-group__label">{{ g.icon }} {{ g.label }}</p>
            <ul class="rel-group__list">
              @for (r of g.relations; track r.relationshipId) {
                <li class="rel-item">
                  <a [routerLink]="['/persons', r.relatedPersonId]">
                    {{ r.relatedFirstName }} {{ r.relatedLastName }}
                    @if (r.relatedMaidenName) {
                      <span style="color:var(--c-text-3);font-size:.8rem"> (geb. {{ r.relatedMaidenName }})</span>
                    }
                  </a>
                  @if (r.type === 'Spouse' && r.startYear) {
                    <span class="rel-year">{{ r.startYear }}</span>
                  }
                  <button class="icon-btn danger" (click)="removeRelation(r)" title="Remove">✕</button>
                </li>
              }
            </ul>
          </div>
        }
      }

      @if (relations().length === 0 && !showForm()) {
        <p style="font-size:.85rem;color:var(--c-text-4);margin:0">No family relationships recorded.</p>
      }
    </div>
  `,
  styles: [`:host { display: block; }`]
})
export class PersonRelationsComponent implements OnInit {
  readonly personId = input.required<string>();
  readonly treeId   = input.required<string>();

  private api = inject(ApiClient);

  relations       = signal<PersonRelation[]>([]);
  allTreePersons  = signal<Person[]>([]);
  showForm        = signal(false);
  error           = signal('');
  selectedPerson  = signal<Person | null>(null);

  newType: RelationshipType = 'Parent';
  searchTerm = '';
  startYear?: number;
  startMonth?: number;
  relTypes = RELATIONSHIP_TYPES;

  filtered = computed(() => {
    const s = this.searchTerm.toLowerCase().trim();
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
      { label: 'Parents',  icon: '👨‍👩‍👦', relations: rels.filter(r => r.type === 'Parent'   && r.direction === 'to') },
      { label: 'Children', icon: '👶',      relations: rels.filter(r => r.type === 'Parent'   && r.direction === 'from') },
      { label: 'Spouses',  icon: '💍',      relations: rels.filter(r => r.type === 'Spouse') },
      { label: 'Adoptive', icon: '🤝',      relations: rels.filter(r => r.type === 'Adoptive') },
    ];
  });

  ngOnInit() { this.load(); }

  load() {
    this.api.getPersonRelations(this.personId()).subscribe(r => this.relations.set(r));
    this.api.getPersonsByTree(this.treeId()).subscribe(p => this.allTreePersons.set(p));
  }

  onSearchChange(term: string) {
    const sel = this.selectedPerson();
    if (sel && `${sel.firstName} ${sel.lastName}` !== term) {
      this.selectedPerson.set(null);
    }
  }

  selectPerson(p: Person) {
    this.selectedPerson.set(p);
    this.searchTerm = `${p.firstName} ${p.lastName}`;
  }

  addRelation() {
    const other = this.selectedPerson();
    if (!other) return;
    this.error.set('');
    this.api.createRelationship(this.treeId(), {
      fromPersonId: this.personId(),
      toPersonId: other.id,
      type: this.newType,
      startYear: this.startYear,
      startMonth: this.startMonth
    } as any).subscribe({
      next: () => { this.load(); this.resetForm(); },
      error: (e: { error?: { error?: string } }) => this.error.set(e.error?.error ?? 'Failed')
    });
  }

  removeRelation(r: PersonRelation) {
    if (!confirm(`Remove relationship with ${r.relatedFirstName} ${r.relatedLastName}?`)) return;
    this.api.deleteRelationship(this.treeId(), r.relationshipId).subscribe(() =>
      this.relations.update(list => list.filter(x => x.relationshipId !== r.relationshipId))
    );
  }

  private resetForm() {
    this.selectedPerson.set(null);
    this.searchTerm = '';
    this.startYear = undefined;
    this.startMonth = undefined;
    this.showForm.set(false);
  }
}
