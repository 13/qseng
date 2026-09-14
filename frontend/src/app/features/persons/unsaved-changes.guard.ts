import { Injector, inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';

export interface HasUnsavedChanges { hasUnsavedChanges(): boolean; }

/** Loads the Material dialog only when there is something to ask, keeping MatDialog out of the initial bundle. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = async component => {
  if (!component.hasUnsavedChanges()) return true;
  const injector = inject(Injector);
  const i18n = inject(I18nService);
  const { ConfirmDialogService } = await import('../../core/ui/confirm-dialog.service');
  const ok = await injector.get(ConfirmDialogService).confirm({
    title: i18n.t('pe.unsavedTitle'), message: i18n.t('pe.unsavedMessage'), confirmLabel: i18n.t('pe.discard'), destructive: true
  });
  return ok === true;
};
