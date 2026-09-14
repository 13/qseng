import { Injectable, Injector, inject } from '@angular/core';
import type { MatDialogRef } from '@angular/material/dialog';
import type { CommandPaletteData } from '../../features/palette/command-palette.component';

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

  private ref: MatDialogRef<unknown> | null = null;

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
      data, position: { top: '10vh' }, panelClass: 'qs-palette-panel', autoFocus: '[cdkFocusInitial]', restoreFocus: true
    });
    this.ref.afterClosed().subscribe(() => (this.ref = null));
  }

  /** Implemented in P2b Task 3 (shortcut sheet); reserved so the palette's
   *  'shortcuts' action and ShortcutService's '?' binding have something to call.
   *  Kept a no-op stub so `MatBottomSheet` is never pulled in eagerly. */
  async openShortcuts(): Promise<void> {
    // no-op until Task 3 wires up the shortcut sheet
  }
}
