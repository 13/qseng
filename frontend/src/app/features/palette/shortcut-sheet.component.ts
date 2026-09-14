import { Component, inject } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ShortcutService } from '../../core/ui/shortcut.service';

/**
 * Opened by `PaletteService.openShortcuts()` — reachable via the `?` key, the
 * palette's "shortcuts" action, and the user menu. Lists the shell's global
 * shortcuts plus the tree canvas's own keybindings.
 */
@Component({
  selector: 'qs-shortcut-sheet',
  imports: [MatButtonModule, TranslatePipe],
  template: `
    <h2 id="qs-sc-title">{{ 'shortcuts.title' | translate }}</h2>
    <dl class="qs-shortcuts">
      <div><dt><kbd class="qs-kbd">{{ mod }}</kbd>+<kbd class="qs-kbd">K</kbd></dt><dd>{{ 'shortcuts.palette' | translate }}</dd></div>
      <div><dt><kbd class="qs-kbd">?</kbd></dt><dd>{{ 'shortcuts.sheet' | translate }}</dd></div>
      <div><dt><kbd class="qs-kbd">{{ mod }}</kbd>+<kbd class="qs-kbd">S</kbd></dt><dd>{{ 'shortcuts.save' | translate }}</dd></div>
      <div><dt><kbd class="qs-kbd">Esc</kbd></dt><dd>{{ 'shortcuts.close' | translate }}</dd></div>
    </dl>
    <p class="qs-shortcuts__group">{{ 'shortcuts.tree' | translate }}</p>
    <dl class="qs-shortcuts">
      <div><dt><kbd class="qs-kbd">+</kbd><kbd class="qs-kbd">-</kbd><kbd class="qs-kbd">0</kbd></dt><dd>{{ 'shortcuts.zoom' | translate }}</dd></div>
      <div><dt><kbd class="qs-kbd">&uarr;</kbd><kbd class="qs-kbd">&darr;</kbd><kbd class="qs-kbd">&larr;</kbd><kbd class="qs-kbd">&rarr;</kbd></dt><dd>{{ 'shortcuts.move' | translate }}</dd></div>
      <div><dt><kbd class="qs-kbd">Enter</kbd></dt><dd>{{ 'shortcuts.open' | translate }}</dd></div>
    </dl>
    <button matButton (click)="ref.dismiss()" class="qs-shortcuts__close">{{ 'close' | translate }}</button>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 12px; padding: 20px 24px 16px; }
    h2 { margin: 0; font-size: 1.1rem; }
    .qs-shortcuts { margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .qs-shortcuts > div { display: flex; align-items: baseline; gap: 12px; }
    .qs-shortcuts dt { flex: 0 0 auto; min-width: 100px; display: flex; gap: 4px; }
    .qs-shortcuts dd { margin: 0; color: var(--mat-sys-on-surface-variant); }
    .qs-shortcuts__group { margin: 0; font-size: .8rem; font-weight: 500; color: var(--mat-sys-on-surface-variant); }
    .qs-shortcuts__close { align-self: flex-end; }
  `]
})
export class ShortcutSheetComponent {
  readonly ref = inject(MatBottomSheetRef<ShortcutSheetComponent, void>);
  readonly mod = inject(ShortcutService).modLabel;
}
