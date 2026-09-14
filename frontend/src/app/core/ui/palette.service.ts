import { Injectable, Injector, inject } from '@angular/core';
import type { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import type { MatDialogRef } from '@angular/material/dialog';
import type { CommandPaletteData } from '../../features/palette/command-palette.component';
import { I18nService } from '../i18n/i18n.service';

function lastTreeId(): string | null {
  try { return sessionStorage.getItem('qs.lastTree'); } catch { return null; }
}

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

  async open(): Promise<void> {
    if (this.ref) { this.ref.close(); return; }

    const treeId = lastTreeId();
    const [{ MatDialog }, { CommandPaletteComponent }] = await Promise.all([
      import('@angular/material/dialog'),
      import('../../features/palette/command-palette.component')
    ]);
    const dialog = this.injector.get(MatDialog);

    const data: CommandPaletteData = { treeId };
    this.ref = dialog.open(CommandPaletteComponent, {
      data, position: { top: '10vh' }, panelClass: 'qs-palette-panel', autoFocus: '[cdkFocusInitial]', restoreFocus: true,
      width: 'min(640px, 95vw)', maxWidth: '95vw'
    });
    this.ref.afterClosed().subscribe(() => (this.ref = null));
  }

  /** Opens the keyboard-shortcut sheet (mirrors `open()`'s lazy-import shape so
   *  `MatBottomSheet` and `ShortcutSheetComponent` stay a lazy chunk). */
  async openShortcuts(): Promise<void> {
    if (this.sheetRef) { this.sheetRef.dismiss(); return; }

    const [{ MatBottomSheet }, { ShortcutSheetComponent }] = await Promise.all([
      import('@angular/material/bottom-sheet'),
      import('../../features/palette/shortcut-sheet.component')
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
  }
}
