import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface ToastOptions {
  action?: string;
  onAction?: () => void;
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snack = inject(MatSnackBar);

  success(message: string, opts: ToastOptions = {}) { this.show(message, 'qs-toast-success', 4000, opts); }
  info(message: string, opts: ToastOptions = {})    { this.show(message, 'qs-toast-info', 4000, opts); }
  error(message: string, opts: ToastOptions = {})   { this.show(message, 'qs-toast-error', 6000, opts); }

  private show(message: string, panelClass: string, defaultDuration: number, opts: ToastOptions) {
    const ref = this.snack.open(message, opts.action, {
      panelClass,
      duration: opts.duration ?? defaultDuration,
      politeness: panelClass === 'qs-toast-error' ? 'assertive' : 'polite'
    });
    if (opts.onAction) ref.onAction().subscribe(opts.onAction);
  }
}
