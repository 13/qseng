import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialogService } from './confirm-dialog.service';

describe('ConfirmDialogService', () => {
  function withResult(result: unknown) {
    const dialog = { open: vi.fn(() => ({ afterClosed: () => of(result) })) };
    TestBed.configureTestingModule({ providers: [{ provide: MatDialog, useValue: dialog }] });
    return { service: TestBed.inject(ConfirmDialogService), dialog };
  }

  it('resolves true on confirm', async () => {
    const { service } = withResult(true);
    await expect(service.confirm({ title: 'T', message: 'M' })).resolves.toBe(true);
  });

  it('resolves false when dismissed without a value', async () => {
    const { service } = withResult(undefined);
    await expect(service.confirm({ title: 'T', message: 'M' })).resolves.toBe(false);
  });

  it('resolves the password when required', async () => {
    const { service, dialog } = withResult('hunter2');
    await expect(service.confirm({ title: 'T', message: 'M', requirePassword: true })).resolves.toBe('hunter2');
    expect(dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: expect.objectContaining({ requirePassword: true }) }));
  });
});
