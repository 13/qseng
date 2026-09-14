import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent, ConfirmOptions } from './confirm-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly dialog = inject(MatDialog);

  /** Resolves `true` (or the password when `requirePassword`) on confirm, `false` on cancel/escape. */
  async confirm(opts: ConfirmOptions): Promise<boolean | string> {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmOptions, boolean | string | undefined>(ConfirmDialogComponent, {
      data: opts, width: '420px', maxWidth: '95vw', autoFocus: opts.requirePassword ? 'input' : 'dialog', restoreFocus: true
    });
    return (await firstValueFrom(ref.afterClosed())) ?? false;
  }
}
