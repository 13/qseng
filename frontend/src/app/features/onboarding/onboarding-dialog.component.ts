import { Component, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { PartialDate, PersonRequest, PersonsApi, RelationshipsApi, Sex, TreesApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LayoutService } from '../../core/ui/layout.service';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';
import { setServerErrors } from '../../core/forms/server-errors';
import { isValidationProblem, problemMessage } from '../../core/api/problem-details';
import { PartialDateInputComponent } from '../../shared/ui/partial-date-input.component';
import { toApiRelationship } from '../trees/tree-view/tree-graph.model';

/** Closes with the newly created tree and the "you" person, so the caller can jump straight there. */
export interface OnboardingResult {
  treeId: string;
  personId: string;
}

/**
 * First-run flow: name a tree, add yourself, then (optionally) your parents — three
 * linear steps in one dialog. Each step creates its row immediately rather than batching
 * at the end, so a failure partway through never loses already-created data; the dialog
 * just stays open on the failing step with the server's error.
 */
@Component({
  selector: 'qs-onboarding-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatStepperModule, MatButtonModule, MatFormFieldModule, MatInputModule,
            MatButtonToggleModule, PartialDateInputComponent, TranslatePipe, FormErrorsPipe],
  template: `
    <h2 mat-dialog-title>{{ 'onb.start' | translate }}</h2>
    <mat-dialog-content>
      <p class="qs-onb-hero">{{ 'onb.hero' | translate }}</p>
      <mat-stepper linear [orientation]="layout.handset() ? 'vertical' : 'horizontal'">
        <mat-step [label]="'onb.step.tree' | translate" [completed]="!!treeId()" [editable]="!treeId()">
          <form [formGroup]="treeForm" (ngSubmit)="next()" novalidate>
            <mat-form-field>
              <mat-label>{{ 'onb.treeName' | translate }}</mat-label>
              <input matInput formControlName="name" cdkFocusInitial maxlength="120">
              <mat-error>{{ treeForm.controls.name.errors | formErrors }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'onb.treeDescription' | translate }}</mat-label>
              <textarea matInput formControlName="description" rows="2" maxlength="500"></textarea>
            </mat-form-field>
            @if (error()) { <p class="qs-form-error" role="alert">{{ error() }}</p> }
            <div class="qs-onb-actions">
              <button matButton="filled" type="submit" [disabled]="saving()">{{ 'onb.next' | translate }}</button>
            </div>
          </form>
        </mat-step>

        <mat-step [label]="'onb.step.you' | translate" [completed]="!!youId()" [editable]="!youId()">
          <form [formGroup]="youForm" (ngSubmit)="next()" novalidate>
            <mat-form-field>
              <mat-label>{{ 'pe.firstName' | translate }}</mat-label>
              <input matInput formControlName="firstName" maxlength="200">
              <mat-error>{{ youForm.controls.firstName.errors | formErrors }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'pe.lastName' | translate }}</mat-label>
              <input matInput formControlName="lastName" maxlength="200">
              <mat-error>{{ youForm.controls.lastName.errors | formErrors }}</mat-error>
            </mat-form-field>
            <mat-button-toggle-group formControlName="sex" [attr.aria-label]="'sex.label' | translate">
              @for (s of sexes; track s) { <mat-button-toggle [value]="s">{{ i18n.sexLabel(s) }}</mat-button-toggle> }
            </mat-button-toggle-group>
            @if (youForm.controls.sex.invalid && youForm.controls.sex.touched) { <p class="qs-form-error" role="alert">{{ youForm.controls.sex.errors | formErrors }}</p> }
            <qs-partial-date-input formControlName="birth" [label]="'pd.birth' | translate" />
            @if (error()) { <p class="qs-form-error" role="alert">{{ error() }}</p> }
            <div class="qs-onb-actions">
              <button matButton="filled" type="submit" [disabled]="saving()">{{ 'onb.next' | translate }}</button>
            </div>
          </form>
        </mat-step>

        <mat-step [label]="'onb.step.parents' | translate">
          <div [formGroup]="parentsForm" class="qs-onb-parents">
            <fieldset formGroupName="mother">
              <legend>{{ 'onb.mother' | translate }}</legend>
              <mat-form-field><mat-label>{{ 'pe.firstName' | translate }}</mat-label><input matInput formControlName="firstName" maxlength="200"><mat-error>{{ parentsForm.controls.mother.controls.firstName.errors | formErrors }}</mat-error></mat-form-field>
              <mat-form-field><mat-label>{{ 'pe.lastName' | translate }}</mat-label><input matInput formControlName="lastName" maxlength="200"><mat-error>{{ parentsForm.controls.mother.controls.lastName.errors | formErrors }}</mat-error></mat-form-field>
              <mat-button-toggle-group formControlName="sex" [attr.aria-label]="'sex.label' | translate">
                @for (s of sexes; track s) { <mat-button-toggle [value]="s">{{ i18n.sexLabel(s) }}</mat-button-toggle> }
              </mat-button-toggle-group>
              <qs-partial-date-input formControlName="birth" [label]="'pd.birth' | translate" />
            </fieldset>
            <fieldset formGroupName="father">
              <legend>{{ 'onb.father' | translate }}</legend>
              <mat-form-field><mat-label>{{ 'pe.firstName' | translate }}</mat-label><input matInput formControlName="firstName" maxlength="200"><mat-error>{{ parentsForm.controls.father.controls.firstName.errors | formErrors }}</mat-error></mat-form-field>
              <mat-form-field><mat-label>{{ 'pe.lastName' | translate }}</mat-label><input matInput formControlName="lastName" maxlength="200"><mat-error>{{ parentsForm.controls.father.controls.lastName.errors | formErrors }}</mat-error></mat-form-field>
              <mat-button-toggle-group formControlName="sex" [attr.aria-label]="'sex.label' | translate">
                @for (s of sexes; track s) { <mat-button-toggle [value]="s">{{ i18n.sexLabel(s) }}</mat-button-toggle> }
              </mat-button-toggle-group>
              <qs-partial-date-input formControlName="birth" [label]="'pd.birth' | translate" />
            </fieldset>
          </div>
          @if (error()) { <p class="qs-form-error" role="alert">{{ error() }}</p> }
          <div class="qs-onb-actions">
            <button matButton type="button" (click)="skip()" [disabled]="saving()">{{ 'onb.skip' | translate }}</button>
            <button matButton="filled" type="button" (click)="finish()" [disabled]="saving()">{{ 'onb.finish' | translate }}</button>
          </div>
        </mat-step>
      </mat-stepper>
    </mat-dialog-content>
  `,
  styles: [`
    mat-dialog-content { overflow-x: hidden; }
    .qs-onb-hero { color: var(--mat-sys-on-surface-variant); margin-top: 0; }
    form > mat-form-field, form > qs-partial-date-input { width: 100%; }
    mat-button-toggle-group { width: 100%; margin: 8px 0; }
    .mat-button-toggle { flex: 1; }
    .qs-onb-actions { display: flex; justify-content: flex-end; gap: 8px; margin: 16px 0 8px; }
    .qs-onb-parents { display: flex; flex-direction: column; gap: 16px; }
    .qs-onb-parents fieldset { border: 1px solid var(--mat-sys-outline-variant); border-radius: var(--mat-sys-corner-medium); padding: 8px 16px 16px; }
    .qs-onb-parents fieldset > mat-form-field, .qs-onb-parents fieldset > qs-partial-date-input { width: 100%; }
    .qs-onb-parents legend { padding: 0 4px; color: var(--mat-sys-on-surface-variant); }
  `]
})
export class OnboardingDialogComponent {
  readonly ref = inject<MatDialogRef<OnboardingDialogComponent, OnboardingResult | undefined>>(MatDialogRef);
  readonly i18n = inject(I18nService);
  readonly layout = inject(LayoutService);
  private readonly treesApi = inject(TreesApi);
  private readonly personsApi = inject(PersonsApi);
  private readonly relationshipsApi = inject(RelationshipsApi);
  private readonly fb = inject(FormBuilder);

  readonly stepper = viewChild.required(MatStepper);

  readonly sexes: Sex[] = ['Male', 'Female'];
  readonly treeId = signal<string | null>(null);
  readonly youId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly treeForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: ['']
  });

  readonly youForm = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    sex: [null as Sex | null, Validators.required],
    birth: [null as PartialDate | null]
  });

  readonly parentsForm = this.fb.nonNullable.group({
    mother: this.fb.nonNullable.group({ firstName: [''], lastName: [''], sex: ['Female' as Sex], birth: [null as PartialDate | null] }),
    father: this.fb.nonNullable.group({ firstName: [''], lastName: [''], sex: ['Male' as Sex], birth: [null as PartialDate | null] })
  });

  /** Dispatches to the current step's own validate-then-create logic. */
  next(): void {
    if (this.stepper().selectedIndex === 0) this.nextFromTree();
    else if (this.stepper().selectedIndex === 1) this.nextFromYou();
  }

  private nextFromTree(): void {
    if (this.treeForm.invalid) { this.treeForm.markAllAsTouched(); return; }
    const v = this.treeForm.getRawValue();
    this.saving.set(true);
    this.error.set('');
    this.treesApi.treesCreate({ body: { name: v.name.trim(), description: v.description.trim() || null } }).subscribe({
      next: tree => {
        this.saving.set(false);
        this.treeId.set(tree.id!);
        // An accidental Escape/backdrop click must not lose a tree that already exists.
        this.ref.disableClose = true;
        this.advance();
      },
      error: e => {
        this.saving.set(false);
        if (isValidationProblem(e.error)) this.error.set(setServerErrors(this.treeForm, e.error).join(' '));
        else this.error.set(problemMessage(e, this.i18n.t('trees.err.create')));
      }
    });
  }

  private nextFromYou(): void {
    if (this.youForm.invalid) { this.youForm.markAllAsTouched(); return; }
    const treeId = this.treeId();
    if (!treeId) return;
    const v = this.youForm.getRawValue();
    const body: PersonRequest = {
      firstName: v.firstName.trim(), lastName: v.lastName.trim(), sex: v.sex ?? undefined, birth: v.birth ?? undefined,
      birthPlace: null, maidenName: null, notes: null, death: undefined, deathPlace: null, causeOfDeath: null
    };
    this.saving.set(true);
    this.error.set('');
    this.personsApi.personsCreate({ treeId, body }).subscribe({
      next: person => {
        this.saving.set(false);
        this.youId.set(person.id!);
        this.advance();
      },
      error: e => {
        this.saving.set(false);
        if (isValidationProblem(e.error)) this.error.set(setServerErrors(this.youForm, e.error).join(' '));
        else this.error.set(problemMessage(e, this.i18n.t('err.save')));
      }
    });
  }

  /**
   * Moves the stepper to the next step. `[completed]`/`[editable]` on the step elements are
   * bound to signals (`!!treeId()`, `!!youId()`) that this same callback just wrote to, but
   * Angular hasn't re-run change detection yet — so `CdkStepper`'s own linear guard would
   * still see the step as incomplete. Setting `completed` here directly (bypassing the not-yet-
   * flushed binding) unblocks it immediately; the binding settles to the same value on the
   * next check.
   */
  private advance(): void {
    const stepper = this.stepper();
    const current = stepper.steps.get(stepper.selectedIndex);
    if (current) current.completed = true;
    stepper.next();
  }

  /** Creates whichever parent rows have a first name filled in, then closes. Empty groups are skipped silently. */
  finish(): void {
    const treeId = this.treeId();
    const youId = this.youId();
    if (!treeId || !youId) return;

    const queue: FormGroup[] = [];
    for (const group of [this.parentsForm.controls.mother, this.parentsForm.controls.father]) {
      const v = group.getRawValue();
      if (!v.firstName.trim()) continue;
      if (!v.lastName.trim()) {
        group.controls.lastName.setErrors({ required: true });
        group.controls.lastName.markAsTouched();
        return;
      }
      queue.push(group);
    }

    this.saving.set(true);
    this.error.set('');
    this.createParents(treeId, youId, queue, 0);
  }

  private createParents(treeId: string, youId: string, queue: FormGroup[], idx: number): void {
    if (idx >= queue.length) {
      this.saving.set(false);
      this.ref.close({ treeId, personId: youId });
      return;
    }
    const group = queue[idx];
    const v = group.getRawValue();
    const body: PersonRequest = {
      firstName: v.firstName.trim(), lastName: v.lastName.trim(), sex: v.sex, birth: v.birth ?? undefined,
      birthPlace: null, maidenName: null, notes: null, death: undefined, deathPlace: null, causeOfDeath: null
    };
    this.personsApi.personsCreate({ treeId, body }).subscribe({
      next: parent => {
        const parentId = parent.id!;
        this.relationshipsApi.relationshipsCreate({ treeId, body: toApiRelationship('Parent', parentId, youId) }).subscribe({
          next: () => this.createParents(treeId, youId, queue, idx + 1),
          error: e => {
            this.saving.set(false);
            if (isValidationProblem(e.error)) this.error.set(setServerErrors(group, e.error).join(' '));
            else this.error.set(problemMessage(e, this.i18n.t('err.save')));
          }
        });
      },
      error: e => {
        this.saving.set(false);
        if (isValidationProblem(e.error)) this.error.set(setServerErrors(group, e.error).join(' '));
        else this.error.set(problemMessage(e, this.i18n.t('err.save')));
      }
    });
  }

  skip(): void {
    const treeId = this.treeId();
    const youId = this.youId();
    if (!treeId || !youId) return;
    this.ref.close({ treeId, personId: youId });
  }
}
