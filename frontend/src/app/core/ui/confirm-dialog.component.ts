import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '../i18n/translate.pipe';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** When true the dialog resolves with the entered password instead of `true`. */
  requirePassword?: boolean;
}

@Component({
  selector: 'qs-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule, TranslatePipe],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
      @if (data.requirePassword) {
        <mat-form-field style="width:100%">
          <mat-label>{{ 'login.password' | translate }}</mat-label>
          <input matInput type="password" autocomplete="current-password"
                 [ngModel]="password()" (ngModelChange)="password.set($event)" (keydown.enter)="confirm()">
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton (click)="ref.close(false)">{{ data.cancelLabel ?? ('cancel' | translate) }}</button>
      <button matButton="filled" [class.qs-destructive]="data.destructive" cdkFocusInitial
              [disabled]="data.requirePassword && !password()" (click)="confirm()">
        {{ data.confirmLabel ?? ('delete' | translate) }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .qs-destructive { --mat-button-filled-container-color: var(--mat-sys-error); --mat-button-filled-label-text-color: var(--mat-sys-on-error); }
  `]
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<ConfirmDialogComponent, boolean | string>>(MatDialogRef);
  readonly password = signal('');

  confirm() {
    if (this.data.requirePassword) {
      if (!this.password()) return;
      this.ref.close(this.password());
    } else {
      this.ref.close(true);
    }
  }
}
