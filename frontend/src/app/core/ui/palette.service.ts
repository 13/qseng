import { Injectable, Injector, inject } from '@angular/core';
import type { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import type { MatDialogRef } from '@angular/material/dialog';
import type { CommandPaletteData } from '../../features/palette/command-palette.component';
import { I18nService } from '../i18n/i18n.service';

function lastTreeId(): string | null {
  try { return sessionStorage.getItem('qs.lastTree'); } catch { return null; }
}

/** True while a `MatDialog`/`MatBottomSheet` overlay is on screen — used to refuse opening
 *  the palette or the shortcut sheet on top of another modal. Both use the CDK's global
 *  positioning strategy, which wraps every such overlay's pane in this class. */
function anotherOverlayOpen(): boolean {
  // A modal (MatDialog, MatBottomSheet) always paints an opaque backdrop; snackbars have none and
  // menus/autocompletes use the transparent one, so neither of those blocks the palette.
  return !!document.querySelector('.cdk-overlay-container .cdk-overlay-backdrop:not(.cdk-overlay-transparent-backdrop)');
}

// Same rationale as `unsaved-changes.guard.ts`'s `confirmDialogLoader`: a bare `export const
// load = () => import(...)` can't be restubbed from a spec (frozen ESM export bindings), so
// the dynamic imports live behind a mutable object's properties instead.
export const paletteLoader = {
  palette: () => import('../../features/palette/command-palette.component'),
  dialog: () => import('@angular/material/dialog'),
  sheet: () => import('../../features/palette/shortcut-sheet.component'),
  sheetModule: () => import('@angular/material/bottom-sheet')
};

/**
 * Opens the command palette (mod+K) as a top-anchored dialog. `CommandPaletteComponent`
 * itself, everything only it needs, and `MatDialog`/CDK dialog+overlay, all stay a lazy
 * chunk; this service (which the shell injects eagerly so mod+K works instantly) only
 * holds an `Injector` eagerly — see the P2b Task 2 report for the bundle-size accounting.
 */
@Injectable({ providedIn: 'root' })
export class PaletteService {
  private readonly injector = inject(Injector);
  private readonly i18n = inject(I18nService);

  private ref: MatDialogRef<unknown> | null = null;
  private sheetRef: MatBottomSheetRef<unknown> | null = null;
  // Guards the dynamic-import window in both open() and openShortcuts(): without it, a
  // double mod+K (or mod+K then quickly ?) fired while the chunk is still loading would
  // race two opens against each other before `this.ref`/`this.sheetRef` is set.
  private opening = false;

  async open(): Promise<void> {
    if (this.ref) { this.ref.close(); return; }
    if (this.opening || anotherOverlayOpen()) return;

    this.opening = true;
    try {
      const treeId = lastTreeId();
      const [{ MatDialog }, { CommandPaletteComponent }] = await Promise.all([
        paletteLoader.dialog(),
        paletteLoader.palette()
      ]);
      const dialog = this.injector.get(MatDialog);

      const data: CommandPaletteData = { treeId };
      this.ref = dialog.open(CommandPaletteComponent, {
        data, position: { top: '10vh' }, panelClass: 'qs-palette-panel', autoFocus: '[cdkFocusInitial]', restoreFocus: true,
        width: 'min(640px, 95vw)', maxWidth: '95vw'
      });
      this.ref.afterClosed().subscribe(() => (this.ref = null));
    } finally {
      this.opening = false;
    }
  }

  /** Opens the keyboard-shortcut sheet (mirrors `open()`'s lazy-import shape so
   *  `MatBottomSheet` and `ShortcutSheetComponent` stay a lazy chunk). */
  async openShortcuts(): Promise<void> {
    if (this.sheetRef) { this.sheetRef.dismiss(); return; }
    if (this.opening || anotherOverlayOpen()) return;

    this.opening = true;
    try {
      const [{ MatBottomSheet }, { ShortcutSheetComponent }] = await Promise.all([
        paletteLoader.sheetModule(),
        paletteLoader.sheet()
      ]);
      const sheet = this.injector.get(MatBottomSheet);

      // MatBottomSheetConfig in this Angular Material version has no `ariaLabelledBy` (only
      // `ariaLabel`), so it can't be wired to the sheet's own <h2 id="qs-sc-title"> from here;
      // panelClass is the only config this version supports for that purpose.
      this.sheetRef = sheet.open(ShortcutSheetComponent, {
        panelClass: ['qs-sheet', 'qs-sheet--auto'],
        // MatBottomSheetConfig has no ariaLabelledBy; the translated title names the dialog instead.
        ariaLabel: this.i18n.t('shortcuts.title')
      });
      this.sheetRef.afterDismissed().subscribe(() => (this.sheetRef = null));
    } finally {
      this.opening = false;
    }
  }
}
