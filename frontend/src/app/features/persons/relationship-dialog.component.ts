import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { PartialDate, PersonDto, PersonRequest, PersonsApi, RelationshipDto, RelationshipRequest, RelationshipsApi, Sex } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ToastService } from '../../core/ui/toast.service';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';
import { setServerErrors } from '../../core/forms/server-errors';
import { isValidationProblem, problemMessage } from '../../core/api/problem-details';
import { fullName, lifespan } from '../../core/models/person-helpers';
import { PartialDateInputComponent } from '../../shared/ui/partial-date-input.component';
import { UI_REL_TYPES, UiRelType, toApiRelationship } from '../trees/tree-view/tree-graph.model';

export interface RelationshipDialogData {
  treeId: string;
  persons: PersonDto[];
  /** When set, the dialog asks only for the other person (person page). */
  anchor?: PersonDto;
  presetType?: UiRelType;
  /** Preselects the "existing person" / "new person" toggle; defaults to the last choice remembered this session. */
  mode?: 'existing' | 'new';
}

/** Closes with the linked relationship and, in "new person" mode, the person that was created for it. */
export interface RelationshipDialogResult {
  relationship: RelationshipDto;
  /** The type chosen in the dialog (`form.controls.type.value`) — use this for toast wording, not `relationship.type`. */
  uiType: UiRelType;
  created?: PersonDto;
}

function matches(p: PersonDto, term: string): boolean {
  const t = term.toLowerCase();
  return `${p.firstName ?? ''} ${p.lastName ?? ''} ${p.maidenName ?? ''}`.toLowerCase().includes(t);
}

@Component({
  selector: 'qs-relationship-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatAutocompleteModule,
            MatButtonModule, MatButtonToggleModule, TranslatePipe, FormErrorsPipe, PartialDateInputComponent],
  template: `
    <h2 mat-dialog-title>{{ 'rel.dialog.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="qs-dialog-form">
        <mat-form-field>
          <mat-label>{{ 'rel.dialog.type' | translate }}</mat-label>
          <mat-select formControlName="type">
            @for (t of types; track t) { <mat-option [value]="t">{{ i18n.dynamic('rel.' + t.toLowerCase()) }}</mat-option> }
          </mat-select>
          <mat-hint>{{ 'rel.dialog.roleHint' | translate }}</mat-hint>
        </mat-form-field>

        @if (data.anchor) {
          <mat-button-toggle-group hideSingleSelectionIndicator [value]="mode()" (change)="setMode($event.value)" [attr.aria-label]="'rel.mode.label' | translate">
            <mat-button-toggle value="existing">{{ 'rel.mode.existing' | translate }}</mat-button-toggle>
            <mat-button-toggle value="new">{{ 'rel.mode.new' | translate }}</mat-button-toggle>
          </mat-button-toggle-group>
        }

        @if (!data.anchor) {
          <mat-form-field>
            <mat-label>{{ 'rel.dialog.from' | translate }}</mat-label>
            <input matInput formControlName="from" [matAutocomplete]="fromAuto" autocomplete="off">
            <mat-autocomplete #fromAuto="matAutocomplete" (optionSelected)="pickFrom($event)" [displayWith]="display">
              @for (p of fromCandidates(); track p.id) { <mat-option [value]="p">{{ label(p) }}</mat-option> }
            </mat-autocomplete>
            <mat-error>{{ form.controls.from.errors | formErrors }}</mat-error>
          </mat-form-field>
        }

        @if (mode() === 'existing' || !data.anchor) {
          <mat-form-field>
            <mat-label>{{ (data.anchor ? 'rel.dialog.person' : 'rel.dialog.to') | translate }}</mat-label>
            <input matInput formControlName="person" [matAutocomplete]="auto" autocomplete="off">
            <mat-autocomplete #auto="matAutocomplete" (optionSelected)="pickFromEvent($event)" [displayWith]="display">
              @for (p of candidates(); track p.id) { <mat-option [value]="p">{{ label(p) }}</mat-option> }
            </mat-autocomplete>
            <mat-error>{{ form.controls.person.errors | formErrors }}</mat-error>
          </mat-form-field>
        } @else {
          <div class="qs-new-person-block" [formGroup]="newForm">
            <mat-form-field><mat-label>{{ 'rel.new.firstName' | translate }}</mat-label><input matInput formControlName="firstName" maxlength="200" cdkFocusInitial><mat-error>{{ newForm.controls.firstName.errors | formErrors }}</mat-error></mat-form-field>
            <mat-form-field><mat-label>{{ 'rel.new.lastName' | translate }}</mat-label><input matInput formControlName="lastName" maxlength="200"><mat-error>{{ newForm.controls.lastName.errors | formErrors }}</mat-error></mat-form-field>
            <mat-button-toggle-group formControlName="sex" [attr.aria-label]="'rel.new.sex' | translate"
              [attr.aria-describedby]="newForm.controls.sex.invalid && newForm.controls.sex.touched ? 'qs-rel-sex-error' : null"
              [attr.aria-invalid]="newForm.controls.sex.invalid && newForm.controls.sex.touched">
              @for (s of sexes; track s) { <mat-button-toggle [value]="s">{{ i18n.sexLabel(s) }}</mat-button-toggle> }
            </mat-button-toggle-group>
            @if (newForm.controls.sex.invalid && newForm.controls.sex.touched) { <p class="qs-form-error" role="alert" id="qs-rel-sex-error">{{ newForm.controls.sex.errors | formErrors }}</p> }
            <qs-partial-date-input formControlName="birth" [label]="'pd.birth' | translate" />
            <mat-form-field><mat-label>{{ 'rel.new.birthPlace' | translate }}</mat-label><input matInput formControlName="birthPlace" maxlength="200"></mat-form-field>
          </div>
        }

        @if (form.controls.type.value === 'Spouse' || form.controls.type.value === 'Adoptive') {
          <qs-partial-date-input formControlName="startDate" [label]="'rel.dialog.date' | translate" />
          <mat-form-field>
            <mat-label>{{ 'rel.dialog.place' | translate }}</mat-label>
            <input matInput formControlName="place" maxlength="200">
          </mat-form-field>
        }

        @if (error()) { <p class="qs-form-error" role="alert">{{ error() }}</p> }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" (click)="ref.close()">{{ 'cancel' | translate }}</button>
        <button matButton="filled" type="submit" [disabled]="saving()">{{ 'rel.dialog.submit' | translate }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    mat-dialog-content { overflow-x: hidden; }
    mat-dialog-content > mat-form-field, mat-dialog-content > qs-partial-date-input { width: 100%; }
    mat-button-toggle-group { width: 100%; }
    .mat-button-toggle { flex: 1; }
    mat-dialog-content > mat-button-toggle-group { margin: 20px 0 8px; }
    .qs-new-person-block { display: flex; flex-direction: column; gap: 4px; }
    .qs-new-person-block > * { width: 100%; }
  `]
})
export class RelationshipDialogComponent {
  readonly data = inject<RelationshipDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<RelationshipDialogComponent, RelationshipDialogResult | undefined>>(MatDialogRef);
  readonly i18n = inject(I18nService);
  private readonly api = inject(RelationshipsApi);
  private readonly persons = inject(PersonsApi);
  private readonly toast = inject(ToastService);

  readonly types = UI_REL_TYPES;
  readonly sexes: Sex[] = ['Male', 'Female'];
  readonly saving = signal(false);
  readonly error = signal('');
  private readonly picked = signal<PersonDto | null>(null);
  private readonly pickedFrom = signal<PersonDto | null>(null);

  readonly mode = signal<'existing' | 'new'>(this.data.mode ?? this.storedMode());

  readonly form = inject(FormBuilder).nonNullable.group({
    type: [this.data.presetType ?? ('Parent' as UiRelType)],
    from: [''],
    person: ['', Validators.required],
    startDate: [null as PartialDate | null],
    place: ['']
  });

  readonly newForm = inject(FormBuilder).nonNullable.group({
    firstName: ['', Validators.required],
    lastName: [this.data.presetType === 'Spouse' ? '' : (this.data.anchor?.lastName ?? ''), Validators.required],
    sex: [null as Sex | null, Validators.required],
    birth: [null as PartialDate | null],
    birthPlace: ['']
  });

  private readonly personTerm = toSignal(this.form.controls.person.valueChanges, { initialValue: '' });
  private readonly fromTerm = toSignal(this.form.controls.from.valueChanges, { initialValue: '' });

  readonly candidates = computed(() => this.filter(this.personTerm(), this.data.anchor?.id ?? this.pickedFrom()?.id));
  readonly fromCandidates = computed(() => this.filter(this.fromTerm(), this.picked()?.id));

  constructor() {
    this.form.controls.person.valueChanges.pipe(takeUntilDestroyed()).subscribe(v => {
      const p = this.picked();
      if (typeof v === 'string' && p && v !== this.display(p)) this.picked.set(null);
    });
    this.form.controls.from.valueChanges.pipe(takeUntilDestroyed()).subscribe(v => {
      const p = this.pickedFrom();
      if (typeof v === 'string' && p && v !== this.display(p)) this.pickedFrom.set(null);
    });
    // Keep the new-person surname following the chosen relation type, but only while the
    // user hasn't typed one themselves — `setValue` below doesn't mark the control dirty.
    this.form.controls.type.valueChanges.pipe(takeUntilDestroyed()).subscribe(type => {
      if (!this.newForm.controls.lastName.pristine) return;
      this.newForm.controls.lastName.setValue(type === 'Spouse' ? '' : (this.data.anchor?.lastName ?? ''));
    });
  }

  private filter(term: unknown, excludeId: string | undefined): PersonDto[] {
    if (typeof term !== 'string' || term.trim().length < 1) return [];
    return this.data.persons.filter(p => p.id !== excludeId && matches(p, term.trim())).slice(0, 8);
  }

  readonly display = (p: PersonDto | string | null) => (typeof p === 'string' ? p : p ? fullName({ firstName: p.firstName ?? '', lastName: p.lastName ?? '' }) : '');
  label(p: PersonDto) { const l = lifespan({ firstName: '', lastName: '', birth: p.birth, death: p.death }); return `${this.display(p)}${l ? ` (${l})` : ''}`; }

  pick(p: PersonDto) { this.picked.set(p); this.form.controls.person.setValue(this.display(p)); }
  pickFromEvent(e: MatAutocompleteSelectedEvent) { this.pick(e.option.value as PersonDto); }
  pickFromPerson(p: PersonDto) { this.pickedFrom.set(p); this.form.controls.from.setValue(this.display(p)); }
  pickFrom(e: MatAutocompleteSelectedEvent) { this.pickFromPerson(e.option.value as PersonDto); }

  private storedMode(): 'existing' | 'new' {
    try { return sessionStorage.getItem('qs.relMode') === 'new' ? 'new' : 'existing'; } catch { return 'existing'; }
  }

  setMode(m: 'existing' | 'new') {
    this.mode.set(m);
    try { sessionStorage.setItem('qs.relMode', m); } catch { /* private browsing etc.: mode just won't stick */ }
  }

  save() {
    const anchor = this.data.anchor;
    if (this.mode() === 'new' && anchor) { this.saveNew(anchor); return; }
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const other = this.picked();
    if (!other || !other.id) {
      this.form.controls.person.setErrors({ required: true });
      this.form.controls.person.markAsTouched();
      return;
    }
    const roleHolder = anchor ? other : this.pickedFrom();
    const counterpart = anchor ?? other;
    if (!roleHolder || !roleHolder.id) {
      this.form.controls.from.setErrors({ required: true });
      this.form.controls.from.markAsTouched();
      return;
    }
    if (!counterpart.id) {
      this.form.controls.person.setErrors({ required: true });
      this.form.controls.person.markAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.api.relationshipsCreate({ treeId: this.data.treeId, body: this.relationshipBody(roleHolder.id, counterpart.id) }).subscribe({
      next: rel => this.ref.close({ relationship: rel, uiType: this.form.controls.type.value }),
      error: e => {
        if (isValidationProblem(e.error)) this.error.set(setServerErrors(this.form, e.error).join(' '));
        else this.toast.errorFrom(e, this.i18n.t('tree.relErr'));
        this.saving.set(false);
      }
    });
  }

  /** Same edge-building the "existing person" path uses, shared with the new-person link step. */
  private relationshipBody(roleHolderId: string, counterpartId: string): RelationshipRequest {
    const v = this.form.getRawValue();
    const edge = toApiRelationship(v.type, roleHolderId, counterpartId);
    const withDate = v.type === 'Spouse' || v.type === 'Adoptive';
    return {
      ...edge,
      startYear: withDate ? v.startDate?.year ?? null : null,
      startMonth: withDate ? v.startDate?.month ?? null : null,
      startDay: withDate ? v.startDate?.day ?? null : null,
      notes: withDate && v.place.trim() ? v.place.trim() : null
    };
  }

  private saveNew(anchor: PersonDto) {
    if (this.newForm.invalid) { this.newForm.markAllAsTouched(); return; }
    if (!anchor.id) return;
    const nv = this.newForm.getRawValue();
    const body: PersonRequest = {
      firstName: nv.firstName.trim(), lastName: nv.lastName.trim(), sex: nv.sex ?? undefined,
      birth: nv.birth ?? undefined, birthPlace: nv.birthPlace.trim() || null,
      maidenName: null, notes: null, death: undefined, deathPlace: null, causeOfDeath: null
    };
    this.saving.set(true);
    this.error.set('');
    this.persons.personsCreate({ treeId: this.data.treeId, body }).subscribe({
      next: created => this.linkCreated(created, anchor),
      error: e => {
        if (isValidationProblem(e.error)) this.error.set(setServerErrors(this.newForm, e.error).join(' '));
        else this.error.set(problemMessage(e, this.i18n.t('err.save')));
        this.saving.set(false);
      }
    });
  }

  private linkCreated(created: PersonDto, anchor: PersonDto) {
    if (!created.id || !anchor.id) { this.saving.set(false); return; }
    const createdId = created.id;
    this.api.relationshipsCreate({ treeId: this.data.treeId, body: this.relationshipBody(createdId, anchor.id) }).subscribe({
      next: rel => this.ref.close({ relationship: rel, uiType: this.form.controls.type.value, created }),
      error: e => {
        if (isValidationProblem(e.error)) this.error.set(setServerErrors(this.form, e.error).join(' '));
        else this.error.set(problemMessage(e, this.i18n.t('tree.relErr')));
        this.saving.set(false);
        this.persons.personsDelete({ id: createdId }).subscribe({ error: () => undefined });
      }
    });
  }
}
