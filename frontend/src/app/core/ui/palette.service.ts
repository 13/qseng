import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { PersonDto, PersonsApi, TreesApi } from '../api/generated';
import type { CommandPaletteComponent, CommandPaletteData } from '../../features/palette/command-palette.component';

function lastTreeId(): string | null {
  try { return sessionStorage.getItem('qs.lastTree'); } catch { return null; }
}

/**
 * Opens the command palette (mod+K) as a top-anchored dialog. `CommandPaletteComponent`
 * itself, and everything only it needs, stays a lazy chunk; this service (which the shell
 * injects eagerly so mod+K works instantly) and its direct dependencies are the only new
 * eager weight — see the P2b Task 2 report for the resulting bundle-size accounting.
 */
@Injectable({ providedIn: 'root' })
export class PaletteService {
  private readonly dialog = inject(MatDialog);
  private readonly personsApi = inject(PersonsApi);
  private readonly treesApi = inject(TreesApi);

  private ref: MatDialogRef<CommandPaletteComponent, void> | null = null;

  async open(): Promise<void> {
    if (this.ref) { this.ref.close(); return; }

    const treeId = lastTreeId();
    const [{ CommandPaletteComponent }, persons, treeName] = await Promise.all([
      import('../../features/palette/command-palette.component'),
      treeId ? firstValueFrom(this.personsApi.personsGetByTree({ treeId })).catch((): PersonDto[] => []) : Promise.resolve<PersonDto[]>([]),
      treeId
        ? firstValueFrom(this.treesApi.treesGetAll()).then(ts => ts.find(t => t.id === treeId)?.name ?? '').catch(() => '')
        : Promise.resolve('')
    ]);

    const data: CommandPaletteData = { treeId, treeName, persons };
    this.ref = this.dialog.open(CommandPaletteComponent, {
      data, position: { top: '10vh' }, panelClass: 'qs-palette-panel', autoFocus: '[cdkFocusInitial]', restoreFocus: true
    });
    this.ref.afterClosed().subscribe(() => (this.ref = null));
  }

  /** Implemented in P2b Task 3 (shortcut sheet); reserved so the palette's
   *  'shortcuts' action and ShortcutService's '?' binding have something to call. */
  async openShortcuts(): Promise<void> {
    // no-op until Task 3 wires up the shortcut sheet
  }
}
