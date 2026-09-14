import { Injector, inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';

export interface HasUnsavedChanges { hasUnsavedChanges(): boolean; }

// A plain function export can't be restubbed from the spec: under this project's vitest
// runner, module namespace exports are native (frozen) ESM bindings, so vi.spyOn on a bare
// `export const loadConfirmDialog = ...` throws "Cannot redefine property". Wrapping the
// loader in a mutable object sidesteps that — the export binding is still frozen, but its
// `.load` property is an ordinary, reassignable object property.
export const confirmDialogLoader = { load: () => import('../../core/ui/confirm-dialog.service') };

/** Loads the Material dialog only when there is something to ask, keeping MatDialog out of the initial bundle. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = async component => {
  if (!component.hasUnsavedChanges()) return true;
  const injector = inject(Injector);
  const i18n = inject(I18nService);
  let confirmDialogModule;
  try {
    confirmDialogModule = await confirmDialogLoader.load();
  } catch {
    // The chunk failed to load: a dirty form must not silently allow navigation, so stay put.
    return false;
  }
  const ok = await injector.get(confirmDialogModule.ConfirmDialogService).confirm({
    title: i18n.t('pe.unsavedTitle'), message: i18n.t('pe.unsavedMessage'), confirmLabel: i18n.t('pe.discard'), destructive: true
  });
  return ok === true;
};
