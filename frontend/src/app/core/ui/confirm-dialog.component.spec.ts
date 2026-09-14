import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { I18nService } from '../i18n/i18n.service';

describe('ConfirmDialogComponent', () => {
  function setup(requirePassword: boolean) {
    TestBed.resetTestingModule();
    const ref = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [provideNoopAnimations(), { provide: MatDialogRef, useValue: ref },
        { provide: MAT_DIALOG_DATA, useValue: { title: 'T', message: 'M', requirePassword } },
        { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }]
    });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
    return { fixture, ref };
  }
  it('closes with true without a password requirement', () => {
    const { fixture, ref } = setup(false);
    fixture.componentInstance.confirm();
    expect(ref.close).toHaveBeenCalledWith(true);
  });
  it('closes with the typed password when one is required', () => {
    const { fixture, ref } = setup(true);
    fixture.componentInstance.confirm();
    expect(ref.close).not.toHaveBeenCalled();
    fixture.componentInstance.password.setValue('secret');
    fixture.componentInstance.confirm();
    expect(ref.close).toHaveBeenCalledWith('secret');
  });
});
