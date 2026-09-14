import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';

@Component({
  selector: 'qs-user-password-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, TranslatePipe, FormErrorsPipe],
  template: `
    <h2 mat-dialog-title>{{ title }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="qs-dialog-form">
        <mat-form-field>
          <mat-label>{{ 'admin.pw.placeholder' | translate }}</mat-label>
          <input matInput formControlName="password" type="password" autocomplete="new-password" cdkFocusInitial>
          <mat-error>{{ form.controls.password.errors | formErrors }}</mat-error>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" (click)="ref.close()">{{ 'admin.pw.cancel' | translate }}</button>
        <button matButton="filled" type="submit">{{ 'admin.pw.save' | translate }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`.qs-dialog-form { min-width: min(380px, 90vw); }`]
})
export class UserPasswordDialogComponent {
  readonly data = inject<{ username: string }>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<UserPasswordDialogComponent, string | undefined>>(MatDialogRef);
  readonly title = inject(I18nService).t('admin.pw.title').replace('__NAME__', this.data.username);
  readonly form = inject(FormBuilder).nonNullable.group({ password: ['', [Validators.required, Validators.minLength(8)]] });

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.ref.close(this.form.getRawValue().password);
  }
}
