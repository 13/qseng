import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  it('opens a snackbar with the right panel class and calls onAction', () => {
    const onAction = new Subject<void>();
    const ref = { onAction: () => onAction.asObservable() } as unknown as MatSnackBarRef<TextOnlySnackBar>;
    const snack = { open: vi.fn(() => ref) };
    TestBed.configureTestingModule({ providers: [{ provide: MatSnackBar, useValue: snack }] });

    const toast = TestBed.inject(ToastService);
    const handler = vi.fn();
    toast.error('Boom', { action: 'Retry', onAction: handler });

    expect(snack.open).toHaveBeenCalledWith('Boom', 'Retry', expect.objectContaining({ panelClass: 'qs-toast-error', duration: 6000 }));
    onAction.next();
    expect(handler).toHaveBeenCalled();
  });

  it('success uses the default duration', () => {
    const ref = { onAction: () => new Subject<void>() } as unknown as MatSnackBarRef<TextOnlySnackBar>;
    const snack = { open: vi.fn(() => ref) };
    TestBed.configureTestingModule({ providers: [{ provide: MatSnackBar, useValue: snack }] });
    TestBed.inject(ToastService).success('Saved');
    expect(snack.open).toHaveBeenCalledWith('Saved', undefined, expect.objectContaining({ panelClass: 'qs-toast-success', duration: 4000 }));
  });

  it('errorFrom skips statuses the interceptor already toasted, but toasts others with the problem detail', () => {
    const ref = { onAction: () => new Subject<void>() } as unknown as MatSnackBarRef<TextOnlySnackBar>;
    const snack = { open: vi.fn(() => ref) };
    TestBed.configureTestingModule({ providers: [{ provide: MatSnackBar, useValue: snack }] });
    const toast = TestBed.inject(ToastService);

    toast.errorFrom(new HttpErrorResponse({ status: 500 }), 'x');
    expect(snack.open).not.toHaveBeenCalled();

    toast.errorFrom(new HttpErrorResponse({ status: 409, error: { status: 409, title: 'Conflict', detail: 'Taken' } }), 'x');
    expect(snack.open).toHaveBeenCalledWith('Taken', undefined, expect.objectContaining({ panelClass: 'qs-toast-error', duration: 6000 }));
  });
});
