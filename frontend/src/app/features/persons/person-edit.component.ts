import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiClient, Person, PartialDate, SEX_OPTIONS, Sex } from '../../core/api/api-client.service';

@Component({
  selector: 'qs-person-edit',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <header class="page-header">
      <a class="back-link" [routerLink]="isNew ? ['/trees', treeId] : ['/persons', personId]">← Back</a>
      <h1>{{ isNew ? 'New Person' : 'Edit Person' }}</h1>
    </header>

    <div class="edit-page">
      <!-- Basic Info -->
      <div class="field-section">
        <h3 class="field-section__title">Basic Info</h3>
        <div class="form-row">
          <label>First name <input [(ngModel)]="form.firstName" name="firstName" required placeholder="Max"></label>
          <label>Last name <input [(ngModel)]="form.lastName" name="lastName" required placeholder="Mustermann"></label>
          <label>Maiden name <input [(ngModel)]="form.maidenName" name="maidenName" placeholder="Huber"></label>
          <label>Sex
            <select [(ngModel)]="form.sex" name="sex">
              @for (s of sexOptions; track s) { <option [value]="s">{{ s }}</option> }
            </select>
          </label>
        </div>
      </div>

      <!-- Birth -->
      <div class="field-section">
        <h3 class="field-section__title">Birth</h3>
        <div class="date-row">
          <label>Year  <input type="number" [(ngModel)]="birthYear"  name="by" placeholder="YYYY"></label>
          <label>Month <input type="number" [(ngModel)]="birthMonth" name="bm" min="1" max="12" placeholder="MM"></label>
          <label>Day   <input type="number" [(ngModel)]="birthDay"   name="bd" min="1" max="31" placeholder="DD"></label>
          <label style="flex-direction:row;align-items:center;gap:.4rem;white-space:nowrap;padding-top:1.4rem">
            <input type="checkbox" [(ngModel)]="birthApprox" name="ba" style="width:auto">
            Approx.
          </label>
        </div>
        <label>Place <input [(ngModel)]="form.birthPlace" name="birthPlace" placeholder="Vienna, Austria"></label>
      </div>

      <!-- Death -->
      <div class="field-section">
        <h3 class="field-section__title">Death</h3>
        <div class="date-row">
          <label>Year  <input type="number" [(ngModel)]="deathYear"  name="dy" placeholder="YYYY"></label>
          <label>Month <input type="number" [(ngModel)]="deathMonth" name="dm" min="1" max="12" placeholder="MM"></label>
          <label>Day   <input type="number" [(ngModel)]="deathDay"   name="dd" min="1" max="31" placeholder="DD"></label>
          <label style="flex-direction:row;align-items:center;gap:.4rem;white-space:nowrap;padding-top:1.4rem">
            <input type="checkbox" [(ngModel)]="deathApprox" name="da" style="width:auto">
            Approx.
          </label>
        </div>
        <label>Place <input [(ngModel)]="form.deathPlace" name="deathPlace" placeholder="Salzburg, Austria"></label>
      </div>

      <!-- Notes -->
      <div class="field-section">
        <h3 class="field-section__title">Notes</h3>
        <label>
          <textarea [(ngModel)]="form.notes" name="notes" rows="4"
                    placeholder="Any additional notes about this person…"></textarea>
        </label>
      </div>

      @if (error()) { <p class="error-msg">{{ error() }}</p> }

      <div class="form-actions">
        <button class="primary" (click)="save()" [disabled]="saving()">
          {{ saving() ? 'Saving…' : (isNew ? 'Create Person' : 'Save Changes') }}
        </button>
        @if (!isNew) {
          <button class="danger" (click)="deletePerson()">Delete Person</button>
        }
      </div>
    </div>
  `,
  styles: [`
    .date-row { display: grid; grid-template-columns: 1fr 80px 80px auto; gap: .5rem; align-items: flex-end; }
    @media (max-width: 480px) { .date-row { grid-template-columns: 1fr 1fr; } }
  `]
})
export class PersonEditComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiClient);

  personId = '';
  treeId = '';
  isNew = false;
  saving = signal(false);
  error = signal('');
  sexOptions = SEX_OPTIONS;

  form: Partial<Person> = { firstName: '', lastName: '', sex: 'Unknown' };
  birthYear?: number; birthMonth?: number; birthDay?: number; birthApprox = false;
  deathYear?: number; deathMonth?: number; deathDay?: number; deathApprox = false;

  ngOnInit() {
    this.personId = this.route.snapshot.paramMap.get('id') ?? '';
    this.treeId = this.route.snapshot.paramMap.get('treeId') ?? '';
    this.isNew = !this.personId || this.route.snapshot.url.some(s => s.path === 'new');

    if (!this.isNew) {
      this.api.getPerson(this.personId).subscribe(p => {
        this.form = { ...p };
        this.treeId = p.treeId;
        this.birthYear = p.birth?.year;  this.birthMonth = p.birth?.month;  this.birthDay = p.birth?.day;
        this.birthApprox = p.birth?.approx ?? false;
        this.deathYear = p.death?.year;  this.deathMonth = p.death?.month;  this.deathDay = p.death?.day;
        this.deathApprox = p.death?.approx ?? false;
      });
    }
  }

  save() {
    this.saving.set(true);
    this.error.set('');
    const birth: PartialDate | undefined = this.birthYear
      ? { year: this.birthYear, month: this.birthMonth, day: this.birthDay, approx: this.birthApprox || undefined }
      : undefined;
    const death: PartialDate | undefined = this.deathYear
      ? { year: this.deathYear, month: this.deathMonth, day: this.deathDay, approx: this.deathApprox || undefined }
      : undefined;
    const body = { ...this.form, birth, death };

    const req = this.isNew
      ? this.api.createPerson(this.treeId, body)
      : this.api.updatePerson(this.personId, body);

    req.subscribe({
      next: (p: Person) => this.router.navigate(['/persons', p.id]),
      error: (e: { error?: { error?: string } }) => {
        this.error.set(e.error?.error ?? 'Save failed');
        this.saving.set(false);
      }
    });
  }

  deletePerson() {
    if (!confirm(`Delete ${this.form.firstName} ${this.form.lastName}? This cannot be undone.`)) return;
    this.api.deletePerson(this.personId).subscribe(() => this.router.navigate(['/trees', this.treeId]));
  }
}
