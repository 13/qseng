import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AdminApi, UserSummaryDto } from '../../core/api/generated';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FormErrorsPipe } from '../../core/forms/form-errors.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { ToastService } from '../../core/ui/toast.service';
import { isValidationProblem } from '../../core/api/problem-details';
import { setServerErrors } from '../../core/forms/server-errors';

@Component({
  selector: 'qs-user-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatCheckboxModule, TranslatePipe, FormErrorsPipe],
  template: `
    <h2 mat-dialog-title>{{ 'admin.create.title' | translate }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="qs-dialog-form">
        @if (error()) { <p class="qs-form-error" role="alert">{{ error() }}</p> }
        <mat-form-field>
          <mat-label>{{ 'admin.create.username' | translate }}</mat-label>
          <input matInput formControlName="username" autocomplete="off" cdkFocusInitial>
          <mat-error>{{ form.controls.username.errors | formErrors }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'admin.create.displayName' | translate }}</mat-label>
          <input matInput formControlName="displayName">
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'admin.create.email' | translate }}</mat-label>
          <input matInput formControlName="email" type="email">
          <mat-error>{{ form.controls.email.errors | formErrors }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'admin.create.password' | translate }}</mat-label>
          <input matInput formControlName="password" type="password" autocomplete="new-password">
          <mat-error>{{ form.controls.password.errors | formErrors }}</mat-error>
        </mat-form-field>
        <mat-checkbox formControlName="isAdmin">{{ 'admin.create.isAdmin' | translate }}</mat-checkbox>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" (click)="ref.close()">{{ 'admin.create.cancel' | translate }}</button>
        <button matButton="filled" type="submit" [disabled]="saving()">{{ 'admin.create.submit' | translate }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`.qs-dialog-form { display: flex; flex-direction: column; gap: 4px; min-width: min(440px, 90vw); }`]
})
export class UserFormDialogComponent {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly ref = inject<MatDialogRef<UserFormDialogComponent, UserSummaryDto | undefined>>(MatDialogRef);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', Validators.required],
    displayName: [''],
    email: ['', Validators.email],
    password: ['', [Validators.required, Validators.minLength(8)]],
    isAdmin: [false]
  });

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const body = { username: v.username.trim(), displayName: v.displayName.trim() || null, email: v.email.trim() || null, password: v.password, isAdmin: v.isAdmin };
    this.saving.set(true);
    this.error.set('');
    this.api.adminCreateUser({ body }).subscribe({
      next: result => this.ref.close(result),
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
