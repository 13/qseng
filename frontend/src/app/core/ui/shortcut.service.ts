import { DestroyRef, Injectable, inject } from '@angular/core';

export type ShortcutCombo = 'mod+k' | 'mod+s' | '?' | 'Escape';
export interface ShortcutOptions { allowInInputs?: boolean }
interface Entry { handler: (ev: KeyboardEvent) => void; allowInInputs: boolean }

const ALWAYS: ReadonlySet<ShortcutCombo> = new Set(['mod+k', 'Escape']);

/** One document-level keydown listener; components register combos and get an unregister function back. */
@Injectable({ providedIn: 'root' })
export class ShortcutService {
  private readonly entries = new Map<ShortcutCombo, Entry[]>();
  readonly isMac = typeof navigator !== 'undefined' && /^Mac/i.test(navigator.platform ?? '');
  readonly modLabel: 'Ctrl' | '⌘' = this.isMac ? '⌘' : 'Ctrl';

  constructor() {
    const onKey = (ev: KeyboardEvent) => this.dispatch(ev);
    document.addEventListener('keydown', onKey);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('keydown', onKey));
  }

  register(combo: ShortcutCombo, handler: (ev: KeyboardEvent) => void, opts: ShortcutOptions = {}): () => void {
    const entry: Entry = { handler, allowInInputs: opts.allowInInputs ?? false };
    const list = this.entries.get(combo) ?? [];
    list.push(entry);
    this.entries.set(combo, list);
    return () => { const l = this.entries.get(combo) ?? []; const i = l.indexOf(entry); if (i >= 0) l.splice(i, 1); };
  }

  private comboOf(ev: KeyboardEvent): ShortcutCombo | null {
    const mod = this.isMac ? ev.metaKey : ev.ctrlKey;
    if (mod && !ev.shiftKey && !ev.altKey && ev.key.toLowerCase() === 'k') return 'mod+k';
    if (mod && !ev.shiftKey && !ev.altKey && ev.key.toLowerCase() === 's') return 'mod+s';
    if (!mod && !ev.altKey && ev.key === '?') return '?';
    if (ev.key === 'Escape') return 'Escape';
    return null;
  }

  private static inEditable(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el || !el.closest) return false;
    return !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
  }

  private dispatch(ev: KeyboardEvent) {
    const combo = this.comboOf(ev);
    if (!combo) return;
    const editable = ShortcutService.inEditable(ev.target);
    const inOverlay = !!(ev.target as HTMLElement | null)?.closest?.('.cdk-overlay-container');
    const list = (this.entries.get(combo) ?? []).slice().reverse();  // last registered wins
    for (const e of list) {
      if (editable && !e.allowInInputs && !ALWAYS.has(combo)) continue;
      if (inOverlay && !ALWAYS.has(combo)) continue;
      ev.preventDefault();
      e.handler(ev);
      return;
    }
  }
}
