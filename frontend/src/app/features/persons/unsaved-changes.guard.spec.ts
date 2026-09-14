import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { unsavedChangesGuard } from './unsaved-changes.guard';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { I18nService } from '../../core/i18n/i18n.service';

function run(dirty: boolean, confirmResult: boolean) {
  const confirm = { confirm: vi.fn(async () => confirmResult) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: ConfirmDialogService, useValue: confirm }, { provide: I18nService, useValue: { t: (k: string) => k } }] });
  const result = TestBed.runInInjectionContext(() => unsavedChangesGuard({ hasUnsavedChanges: () => dirty }, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot));
  return { result, confirm };
}

describe('unsavedChangesGuard', () => {
  it('passes silently when clean', async () => { const { result, confirm } = run(false, false); await expect(result).resolves.toBe(true); expect(confirm.confirm).not.toHaveBeenCalled(); });
  it('asks and honours the answer when dirty', async () => {
    await expect(run(true, false).result).resolves.toBe(false);
    await expect(run(true, true).result).resolves.toBe(true);
  });
});
