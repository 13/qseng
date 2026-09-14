import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { confirmDialogLoader, unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  function run(dirty: boolean, answer: boolean | string) {
    TestBed.resetTestingModule();
    const confirm = vi.fn().mockResolvedValue(answer);
    TestBed.configureTestingModule({ providers: [
      { provide: ConfirmDialogService, useValue: { confirm } },
      { provide: I18nService, useValue: { t: (k: string) => k } }
    ] });
    const result = TestBed.runInInjectionContext(() =>
      unsavedChangesGuard({ hasUnsavedChanges: () => dirty }, {} as never, {} as never, {} as never));
    return { result: Promise.resolve(result as Promise<boolean> | boolean), confirm };
  }
  it('passes without asking when the form is clean', async () => {
    const { result, confirm } = run(false, true);
    expect(await result).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
  it('asks and honours the answer when dirty', async () => {
    expect(await run(true, true).result).toBe(true);
    expect(await run(true, false).result).toBe(false);
  });

  describe('when the confirm-dialog chunk fails to load', () => {
    const originalLoad = confirmDialogLoader.load;
    afterEach(() => { confirmDialogLoader.load = originalLoad; });

    it('blocks navigation without asking', async () => {
      confirmDialogLoader.load = vi.fn().mockRejectedValue(new Error('chunk load failed'));
      TestBed.resetTestingModule();
      const confirm = vi.fn();
      TestBed.configureTestingModule({ providers: [
        { provide: ConfirmDialogService, useValue: { confirm } },
        { provide: I18nService, useValue: { t: (k: string) => k } }
      ] });
      const result = await TestBed.runInInjectionContext(() =>
        unsavedChangesGuard({ hasUnsavedChanges: () => true }, {} as never, {} as never, {} as never));
      expect(result).toBe(false);
      expect(confirm).not.toHaveBeenCalled();
    });
  });
});
