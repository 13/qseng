import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';

export interface TreeFormData { name?: string; description?: string | null; }
export interface TreeFormResult { name: string; description: string | null; }

/** Rejects whitespace-only names. */
function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim().length ? null : { required: true };
}

@Component({
  selector: 'qs-tree-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, TranslatePipe, FormErrorsPipe],
  template: `
    <h2 mat-dialog-title>{{ (isRename ? 'trees.new.rename' : 'trees.new.title') | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="qs-dialog-form">
        <mat-form-field>
          <mat-label>{{ 'trees.new.name' | translate }}</mat-label>
          <input matInput formControlName="name" cdkFocusInitial maxlength="120">
          <mat-error>{{ form.controls.name.errors | formErrors }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'trees.new.desc' | translate }} ({{ 'optional' | translate }})</mat-label>
          <textarea matInput formControlName="description" rows="2" maxlength="500"></textarea>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" (click)="ref.close()">{{ 'cancel' | translate }}</button>
        <button matButton="filled" type="submit">{{ (isRename ? 'trees.save' : 'trees.new.submit') | translate }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`.qs-dialog-form { display: flex; flex-direction: column; gap: 4px; min-width: min(420px, 90vw); }`]
})
export class TreeFormDialogComponent {
  readonly data = inject<TreeFormData>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<TreeFormDialogComponent, TreeFormResult | undefined>>(MatDialogRef);
  readonly isRename = this.data.name !== undefined;

  readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.data.name ?? '', [Validators.required, notBlank]],
    description: [this.data.description ?? '']
  });

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.ref.close({ name: v.name.trim(), description: v.description.trim() || null });
  }
}
