import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { isToastedGlobally, problemMessage } from '../api/problem-details';

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

  /** For HTTP failures in components: skips statuses the interceptor already toasted. */
  errorFrom(err: unknown, fallback: string, opts: ToastOptions = {}) {
    if (isToastedGlobally(err)) return;
    this.error(problemMessage(err, fallback), opts);
  }

  private show(message: string, panelClass: string, defaultDuration: number, opts: ToastOptions) {
    const ref = this.snack.open(message, opts.action, {
      panelClass,
      duration: opts.duration ?? defaultDuration,
      politeness: panelClass === 'qs-toast-error' ? 'assertive' : 'polite'
    });
    if (opts.onAction) ref.onAction().subscribe(opts.onAction);
  }
}
