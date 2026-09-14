import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';
import { TreeDto, TreesApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { ToastService } from '../../core/ui/toast.service';
import { isValidationProblem } from '../../core/api/problem-details';
import { setServerErrors } from '../../core/forms/server-errors';

export type TreeFormData = { mode: 'create' } | { mode: 'rename'; tree: TreeDto };

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
        @if (error()) { <p class="qs-form-error" role="alert">{{ error() }}</p> }
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
        <button matButton="filled" type="submit" [disabled]="saving()">{{ (isRename ? 'trees.save' : 'trees.new.submit') | translate }}</button>
      </mat-dialog-actions>
    </form>
  `
})
export class TreeFormDialogComponent {
  private readonly api = inject(TreesApi);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly data = inject<TreeFormData>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<TreeFormDialogComponent, TreeDto | undefined>>(MatDialogRef);
  readonly isRename = this.data.mode === 'rename';

  readonly saving = signal(false);
  readonly error = signal('');

  readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.data.mode === 'rename' ? (this.data.tree.name ?? '') : '', [Validators.required, notBlank]],
    description: [this.data.mode === 'rename' ? (this.data.tree.description ?? '') : '']
  });

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const body = { name: v.name.trim(), description: v.description.trim() || null };
    this.saving.set(true);
    this.error.set('');
    const request$ = this.data.mode === 'rename'
      ? this.api.treesUpdate({ id: this.data.tree.id!, body })
      : this.api.treesCreate({ body });
    request$.subscribe({
      next: result => this.ref.close(result),
      error: e => {
        if (isValidationProblem(e.error)) {
          const rest = setServerErrors(this.form, e.error);
          this.error.set(rest.join(' '));
        } else {
          this.toast.errorFrom(e, this.i18n.t(this.data.mode === 'create' ? 'trees.err.create' : 'trees.err.save'));
        }
        this.saving.set(false);
      }
    });
  }
}
