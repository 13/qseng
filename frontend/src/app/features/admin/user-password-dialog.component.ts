import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AdminApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';
import { ToastService } from '../../core/ui/toast.service';
import { isValidationProblem } from '../../core/api/problem-details';
import { setServerErrors } from '../../core/forms/server-errors';

@Component({
  selector: 'qs-user-password-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, TranslatePipe, FormErrorsPipe],
  template: `
    <h2 mat-dialog-title>{{ title }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="qs-dialog-form">
        @if (error()) { <p class="qs-form-error" role="alert">{{ error() }}</p> }
        <mat-form-field>
          <mat-label>{{ 'admin.pw.placeholder' | translate }}</mat-label>
          <input matInput formControlName="password" type="password" autocomplete="new-password" cdkFocusInitial>
          <mat-error>{{ form.controls.password.errors | formErrors }}</mat-error>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" (click)="ref.close()">{{ 'admin.pw.cancel' | translate }}</button>
        <button matButton="filled" type="submit" [disabled]="saving()">{{ 'admin.pw.save' | translate }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`.qs-dialog-form { min-width: min(380px, 90vw); }`]
})
export class UserPasswordDialogComponent {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly data = inject<{ id: string; username: string }>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<UserPasswordDialogComponent, true | undefined>>(MatDialogRef);
  readonly title = this.i18n.t('admin.pw.title').replace('__NAME__', this.data.username);
  readonly form = inject(FormBuilder).nonNullable.group({ password: ['', [Validators.required, Validators.minLength(8)]] });
  readonly saving = signal(false);
  readonly error = signal('');

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const newPassword = this.form.getRawValue().password;
    this.saving.set(true);
    this.error.set('');
    this.api.adminChangePassword({ id: this.data.id, body: { newPassword } }).subscribe({
      next: () => this.ref.close(true),
      error: e => {
        if (isValidationProblem(e.error)) {
          const rest = setServerErrors(this.form, e.error);
          this.error.set(rest.join(' '));
        } else {
          this.toast.errorFrom(e, this.i18n.t('err.save'));
        }
        this.saving.set(false);
      }
    });
  }
}
