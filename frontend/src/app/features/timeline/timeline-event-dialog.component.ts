import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { PartialDate, PersonDto, TimelineApi, TimelineEventDto, TimelineEventRequest, TimelineEventType } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ToastService } from '../../core/ui/toast.service';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';
import { setServerErrors } from '../../core/forms/server-errors';
import { isValidationProblem } from '../../core/api/problem-details';
import { fullName } from '../../core/models/person-helpers';
import { PartialDateInputComponent } from '../../shared/ui/partial-date-input.component';

export const TIMELINE_EVENT_TYPES: TimelineEventType[] = ['Birth', 'Death', 'Marriage', 'Move', 'Occupation', 'Education', 'Custom'];

export interface TimelineEventDialogData { personId: string; treePersons: PersonDto[]; event?: TimelineEventDto; }

@Component({
  selector: 'qs-timeline-event-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatAutocompleteModule, MatButtonModule,
            TranslatePipe, FormErrorsPipe, PartialDateInputComponent],
  template: `
    <h2 mat-dialog-title>{{ (data.event ? 'tl.dialog.edit' : 'tl.dialog.add') | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="qs-dialog-form">
        <mat-form-field>
          <mat-label>{{ 'tl.type' | translate }}</mat-label>
          <mat-select formControlName="type">
            @for (t of types; track t) { <mat-option [value]="t">{{ i18n.eventLabel(t) }}</mat-option> }
          </mat-select>
        </mat-form-field>
        @if (form.controls.type.value === 'Marriage') {
          <mat-form-field>
            <mat-label>{{ 'tl.marriage.spouse' | translate }}</mat-label>
            <input matInput formControlName="spouse" [matAutocomplete]="auto" autocomplete="off">
            <mat-autocomplete #auto="matAutocomplete" (optionSelected)="pickSpouseEvent($event)" [displayWith]="display">
              @for (p of spouseCandidates(); track p.id) { <mat-option [value]="p">{{ display(p) }}</mat-option> }
            </mat-autocomplete>
            <mat-hint>{{ 'tl.marriage.hint' | translate }}</mat-hint>
          </mat-form-field>
        }
        <mat-form-field>
          <mat-label>{{ 'tl.eventTitle' | translate }}</mat-label>
          <input matInput formControlName="title" maxlength="200">
          <mat-error>{{ form.controls.title.errors | formErrors }}</mat-error>
        </mat-form-field>
        <qs-partial-date-input formControlName="start" [label]="'tl.dialog.start' | translate" />
        <qs-partial-date-input formControlName="end" [label]="'tl.dialog.end' | translate" />
        <mat-form-field>
          <mat-label>{{ 'tl.place' | translate }}</mat-label>
          <input matInput formControlName="location" maxlength="200">
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'tl.desc' | translate }}</mat-label>
          <textarea matInput formControlName="description" rows="3" maxlength="2000"></textarea>
        </mat-form-field>
        @if (error()) { <p class="qs-form-error" role="alert">{{ error() }}</p> }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" (click)="ref.close()">{{ 'cancel' | translate }}</button>
        <button matButton="filled" type="submit" [disabled]="saving()">{{ 'tl.save' | translate }}</button>
      </mat-dialog-actions>
    </form>
  `
})
export class TimelineEventDialogComponent {
  readonly data = inject<TimelineEventDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<TimelineEventDialogComponent, TimelineEventDto | undefined>>(MatDialogRef);
  readonly i18n = inject(I18nService);
  private readonly api = inject(TimelineApi);
  private readonly toast = inject(ToastService);

  readonly types = TIMELINE_EVENT_TYPES;
  readonly saving = signal(false);
  readonly error = signal('');

  readonly form = inject(FormBuilder).nonNullable.group({
    type: [(this.data.event?.type ?? 'Custom') as TimelineEventType],
    title: [this.data.event?.title ?? '', Validators.required],
    spouse: [''],
    start: [(this.data.event?.start ?? null) as PartialDate | null],
    end: [(this.data.event?.end ?? null) as PartialDate | null],
    location: [this.data.event?.location ?? ''],
    description: [this.data.event?.description ?? '']
  });

  private readonly spouseTerm = toSignal(this.form.controls.spouse.valueChanges, { initialValue: '' });
  readonly spouseCandidates = computed(() => {
    const t = this.spouseTerm();
    if (typeof t !== 'string' || !t.trim()) return [];
    const q = t.trim().toLowerCase();
    return this.data.treePersons.filter(p => p.id !== this.data.personId && `${p.firstName ?? ''} ${p.lastName ?? ''}`.toLowerCase().includes(q)).slice(0, 8);
  });

  readonly display = (p: PersonDto | string | null) => (typeof p === 'string' ? p : p ? fullName({ firstName: p.firstName ?? '', lastName: p.lastName ?? '' }) : '');

  pickSpouse(p: PersonDto) {
    this.form.controls.spouse.setValue(this.display(p));
    const marriage = this.i18n.eventLabel('Marriage');
    const current = this.form.controls.title.value;
    if (!current || current === marriage || current.startsWith(`${marriage} –`)) {
      this.form.controls.title.setValue(`${marriage} – ${this.display(p)}`);
    }
  }
  pickSpouseEvent(e: MatAutocompleteSelectedEvent) { this.pickSpouse(e.option.value as PersonDto); }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const body: TimelineEventRequest = {
      type: v.type, title: v.title.trim(), location: v.location.trim() || null, description: v.description.trim() || null,
      start: v.start ?? undefined, end: v.end ?? undefined, metadataJson: null
    };
    this.saving.set(true);
    this.error.set('');
    const req = this.data.event?.id
      ? this.api.timelineUpdate({ personId: this.data.personId, id: this.data.event.id, body })
      : this.api.timelineAdd({ personId: this.data.personId, body });
    req.subscribe({
      next: ev => this.ref.close(ev),
      error: e => {
        if (isValidationProblem(e.error)) this.error.set(setServerErrors(this.form, e.error).join(' '));
        else this.toast.errorFrom(e, this.i18n.t('err.save'));
        this.saving.set(false);
      }
    });
  }
}
