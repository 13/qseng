import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmDialogService } from '../../core/ui/confirm-dialog.service';
import { I18nService } from '../../core/i18n/i18n.service';

export interface HasUnsavedChanges { hasUnsavedChanges(): boolean; }

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = async component => {
  if (!component.hasUnsavedChanges()) return true;
  const i18n = inject(I18nService);
  const ok = await inject(ConfirmDialogService).confirm({
    title: i18n.t('pe.unsavedTitle'), message: i18n.t('pe.unsavedMessage'), confirmLabel: i18n.t('pe.discard'), destructive: true
  });
  return ok === true;
};
