import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { isToastedGlobally, problemMessage } from '../api/problem-details';
import { I18nService } from '../i18n/i18n.service';

export interface ToastOptions {
  action?: string;
  onAction?: () => void;
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snack = inject(MatSnackBar);
  private readonly i18n = inject(I18nService);

  success(message: string, opts: ToastOptions = {}) { this.show(message, 'qs-toast-success', 4000, opts); }
  info(message: string, opts: ToastOptions = {})    { this.show(message, 'qs-toast-info', 4000, opts); }
  error(message: string, opts: ToastOptions = {})   { this.show(message, 'qs-toast-error', 6000, opts); }

  /** For HTTP failures in components: skips statuses the interceptor already toasted. */
  errorFrom(err: unknown, fallback: string, opts: ToastOptions = {}) {
    if (isToastedGlobally(err)) return;
    this.error(problemMessage(err, fallback), opts);
  }

  /** "Deleted · Undo": runs `onUndo` when the action is clicked; a failing undo is reported once. */
  undoable(message: string, onUndo: () => void | Promise<void>, durationMs = 6000) {
    const ref = this.snack.open(message, this.i18n.t('undo'), { panelClass: 'qs-toast-info', duration: durationMs, politeness: 'polite' });
    ref.onAction().subscribe(() => {
      Promise.resolve().then(onUndo).catch(err => this.errorFrom(err, this.i18n.t('err.restore')));
    });
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
