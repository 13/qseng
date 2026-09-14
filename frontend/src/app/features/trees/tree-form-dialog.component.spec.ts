import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TreeFormDialogComponent } from './tree-form-dialog.component';
import { TreesApi } from '../../core/api/generated';
import { I18nService } from '../../core/i18n/i18n.service';
import { ToastService } from '../../core/ui/toast.service';

const i18n = { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } };

function setup(data: unknown, api: Partial<{ treesCreate: unknown; treesUpdate: unknown }> = {}) {
  const ref = { close: vi.fn() };
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), errorFrom: vi.fn() };
  const apiValue = {
    treesCreate: vi.fn(() => of({ id: 't3', name: 'Escobar' })),
    treesUpdate: vi.fn(() => of({ id: 't1', name: 'Escobar' })),
    ...api
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: ref },
      { provide: TreesApi, useValue: apiValue },
      { provide: ToastService, useValue: toast },
      i18n
    ]
  });
  const fixture = TestBed.createComponent(TreeFormDialogComponent);
  fixture.detectChanges();
  return { fixture, ref, api: apiValue, toast, cmp: fixture.componentInstance };
}

describe('TreeFormDialogComponent', () => {
  it('prefills for rename, validates name, and calls the API with trimmed values, closing with the DTO', () => {
    const { cmp, ref, api } = setup({ mode: 'rename', tree: { id: 't1', name: 'Familie', description: null } });
    expect(cmp.isRename).toBe(true);
    expect(cmp.form.value.name).toBe('Familie');

    cmp.form.setValue({ name: '   ', description: '' });
    cmp.save();
    expect(ref.close).not.toHaveBeenCalled();
    expect(api.treesUpdate).not.toHaveBeenCalled();

    cmp.form.setValue({ name: '  Escobar ', description: ' Tirol ' });
    cmp.save();
    expect(api.treesUpdate).toHaveBeenCalledWith({ id: 't1', body: { name: 'Escobar', description: 'Tirol' } });
    expect(ref.close).toHaveBeenCalledWith({ id: 't1', name: 'Escobar' });
  });

  it('create mode calls treesCreate and closes with the created DTO', () => {
    const { cmp, ref, api } = setup({ mode: 'create' });
    expect(cmp.isRename).toBe(false);
    cmp.form.setValue({ name: 'New Tree', description: '' });
    cmp.save();
    expect(api.treesCreate).toHaveBeenCalledWith({ body: { name: 'New Tree', description: null } });
    expect(ref.close).toHaveBeenCalledWith({ id: 't3', name: 'Escobar' });
  });

  it('maps a validation problem onto the form and does not close, without a duplicate toast', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { status: 400, title: 'Bad Request', errors: { name: ['Taken.'] } }
    });
    const { cmp, ref, toast } = setup({ mode: 'create' }, { treesCreate: vi.fn(() => throwError(() => error)) });
    cmp.form.setValue({ name: 'Dup', description: '' });
    cmp.save();
    expect(ref.close).not.toHaveBeenCalled();
    expect(cmp.form.controls.name.errors).toEqual({ server: 'Taken.' });
    expect(toast.errorFrom).not.toHaveBeenCalled();
  });

  it('toasts other failures via errorFrom and stays open', () => {
    const error = new HttpErrorResponse({ status: 500 });
    const { cmp, ref, toast } = setup({ mode: 'create' }, { treesCreate: vi.fn(() => throwError(() => error)) });
    cmp.form.setValue({ name: 'New', description: '' });
    cmp.save();
    expect(ref.close).not.toHaveBeenCalled();
    expect(toast.errorFrom).toHaveBeenCalledWith(error, 'trees.err.create');
  });
});
