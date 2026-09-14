import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { TreeFormDialogComponent } from './tree-form-dialog.component';
import { I18nService } from '../../core/i18n/i18n.service';

describe('TreeFormDialogComponent', () => {
  it('prefills for rename, validates name, and closes with trimmed values', () => {
    const ref = { close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { name: 'Familie', description: null } },
        { provide: MatDialogRef, useValue: ref },
        { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }
      ]
    });
    const fixture = TestBed.createComponent(TreeFormDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    expect(cmp.isRename).toBe(true);
    expect(cmp.form.value.name).toBe('Familie');

    cmp.form.setValue({ name: '   ', description: '' });
    cmp.save();
    expect(ref.close).not.toHaveBeenCalled();

    cmp.form.setValue({ name: '  Escobar ', description: ' Tirol ' });
    cmp.save();
    expect(ref.close).toHaveBeenCalledWith({ name: 'Escobar', description: 'Tirol' });
  });
});
