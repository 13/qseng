import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { PartialDate, PersonDto, RelationshipDto, RelationshipRequest, RelationshipsApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ToastService } from '../../core/ui/toast.service';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';
import { setServerErrors } from '../../core/forms/server-errors';
import { isValidationProblem } from '../../core/api/problem-details';
import { fullName, lifespan } from '../../core/models/person-helpers';
import { PartialDateInputComponent } from '../../shared/ui/partial-date-input.component';
import { UI_REL_TYPES, UiRelType, toApiRelationship } from '../trees/tree-view/tree-graph.model';

export interface RelationshipDialogData {
  treeId: string;
  persons: PersonDto[];
  /** When set, the dialog asks only for the other person (person page). */
  anchor?: PersonDto;
  presetType?: UiRelType;
}

function matches(p: PersonDto, term: string): boolean {
  const t = term.toLowerCase();
  return `${p.firstName ?? ''} ${p.lastName ?? ''} ${p.maidenName ?? ''}`.toLowerCase().includes(t);
}

@Component({
  selector: 'qs-relationship-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatAutocompleteModule,
            MatButtonModule, TranslatePipe, FormErrorsPipe, PartialDateInputComponent],
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

        @if (!data.anchor) {
          <mat-form-field>
            <mat-label>{{ 'rel.dialog.from' | translate }}</mat-label>
            <input matInput formControlName="from" [matAutocomplete]="fromAuto" autocomplete="off">
            <mat-autocomplete #fromAuto="matAutocomplete" (optionSelected)="pickFrom($event)" [displayWith]="display">
              @for (p of fromCandidates(); track p.id) { <mat-option [value]="p">{{ label(p) }}</mat-option> }
            </mat-autocomplete>
          </mat-form-field>
        }

        <mat-form-field>
          <mat-label>{{ (data.anchor ? 'rel.dialog.person' : 'rel.dialog.to') | translate }}</mat-label>
          <input matInput formControlName="person" [matAutocomplete]="auto" autocomplete="off">
          <mat-autocomplete #auto="matAutocomplete" (optionSelected)="pickFromEvent($event)" [displayWith]="display">
            @for (p of candidates(); track p.id) { <mat-option [value]="p">{{ label(p) }}</mat-option> }
          </mat-autocomplete>
          <mat-error>{{ form.controls.person.errors | formErrors }}</mat-error>
        </mat-form-field>

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
  `
})
export class RelationshipDialogComponent {
  readonly data = inject<RelationshipDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<RelationshipDialogComponent, RelationshipDto | undefined>>(MatDialogRef);
  readonly i18n = inject(I18nService);
  private readonly api = inject(RelationshipsApi);
  private readonly toast = inject(ToastService);

  readonly types = UI_REL_TYPES;
  readonly saving = signal(false);
  readonly error = signal('');
  private readonly picked = signal<PersonDto | null>(null);
  private readonly pickedFrom = signal<PersonDto | null>(null);

  readonly form = inject(FormBuilder).nonNullable.group({
    type: [this.data.presetType ?? ('Parent' as UiRelType)],
    from: [''],
    person: ['', Validators.required],
    startDate: [null as PartialDate | null],
    place: ['']
  });

  private readonly personTerm = toSignal(this.form.controls.person.valueChanges, { initialValue: '' });
  private readonly fromTerm = toSignal(this.form.controls.from.valueChanges, { initialValue: '' });

  readonly candidates = computed(() => this.filter(this.personTerm(), this.data.anchor?.id ?? this.pickedFrom()?.id));
  readonly fromCandidates = computed(() => this.filter(this.fromTerm(), this.picked()?.id));

  private filter(term: unknown, excludeId: string | undefined): PersonDto[] {
    if (typeof term !== 'string' || term.trim().length < 1) return [];
    return this.data.persons.filter(p => p.id !== excludeId && matches(p, term.trim())).slice(0, 8);
  }

  readonly display = (p: PersonDto | string | null) => (typeof p === 'string' ? p : p ? fullName({ firstName: p.firstName ?? '', lastName: p.lastName ?? '' }) : '');
  label(p: PersonDto) { const l = lifespan({ firstName: '', lastName: '', birth: p.birth, death: p.death }); return `${this.display(p)}${l ? ` (${l})` : ''}`; }

  pick(p: PersonDto) { this.picked.set(p); this.form.controls.person.setValue(this.display(p)); }
  pickFromEvent(e: MatAutocompleteSelectedEvent) { this.pick(e.option.value as PersonDto); }
  pickFrom(e: MatAutocompleteSelectedEvent) { const p = e.option.value as PersonDto; this.pickedFrom.set(p); this.form.controls.from.setValue(this.display(p)); }

  save() {
    const other = this.picked();
    const roleHolder = this.data.anchor ? other : this.pickedFrom();
    const counterpart = this.data.anchor ?? other;
    if (!other || !roleHolder || !counterpart || !roleHolder.id || !counterpart.id) {
      this.form.controls.person.setErrors({ required: true });
      this.form.controls.person.markAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const edge = toApiRelationship(v.type, roleHolder.id, counterpart.id);
    const withDate = v.type === 'Spouse' || v.type === 'Adoptive';
    const body: RelationshipRequest = {
      ...edge,
      startYear: withDate ? v.startDate?.year ?? null : null,
      startMonth: withDate ? v.startDate?.month ?? null : null,
      startDay: withDate ? v.startDate?.day ?? null : null,
      notes: withDate && v.place.trim() ? v.place.trim() : null
    };
    this.saving.set(true);
    this.error.set('');
    this.api.relationshipsCreate({ treeId: this.data.treeId, body }).subscribe({
      next: rel => this.ref.close(rel),
      error: e => {
        if (isValidationProblem(e.error)) this.error.set(setServerErrors(this.form, e.error).join(' '));
        else this.toast.errorFrom(e, this.i18n.t('tree.relErr'));
        this.saving.set(false);
      }
    });
  }
}
