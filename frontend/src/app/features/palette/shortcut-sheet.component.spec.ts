import { TestBed } from '@angular/core/testing';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, expect, it, vi } from 'vitest';
import { ShortcutSheetComponent } from './shortcut-sheet.component';
import { I18nService } from '../../core/i18n/i18n.service';
import { ShortcutService } from '../../core/ui/shortcut.service';

function setup() {
  const ref = { dismiss: vi.fn() };
  const resolve = (k: string) => k;
  const i18n = { t: resolve, dynamic: resolve, lang: () => 'en' as const };
  const shortcuts = { modLabel: 'Ctrl' as const };

  TestBed.configureTestingModule({
    imports: [ShortcutSheetComponent],
    providers: [
      provideNoopAnimations(),
      { provide: MatBottomSheetRef, useValue: ref },
      { provide: I18nService, useValue: i18n },
      { provide: ShortcutService, useValue: shortcuts }
    ]
  });
  const fixture = TestBed.createComponent(ShortcutSheetComponent);
  fixture.detectChanges();
  return { fixture, ref, el: fixture.nativeElement as HTMLElement };
}

describe('ShortcutSheetComponent', () => {
  it('renders a heading with the sheet title', () => {
    const { el } = setup();
    const h2 = el.querySelector('h2');
    expect(h2).not.toBeNull();
    expect(h2?.textContent?.trim()).toBe('shortcuts.title');
    expect(h2?.id).toBe('qs-sc-title');
  });

  it('lists mod+K in a definition list built from the injected modLabel', () => {
    const { el } = setup();
    const dls = el.querySelectorAll('dl.qs-shortcuts');
    expect(dls.length).toBe(2);
    expect(dls[0].textContent).toContain('Ctrl');
    expect(dls[0].textContent).toContain('K');
  });

  it('lists the tree-view (canvas-focused) rows under their own group label, outside any dl', () => {
    const { el } = setup();
    const group = el.querySelector('.qs-shortcuts__group');
    expect(group?.tagName).toBe('P');
    expect(group?.textContent).toContain('shortcuts.tree');
    const dls = el.querySelectorAll('dl.qs-shortcuts');
    expect(dls[1].textContent).toContain('shortcuts.zoom');
    expect(dls[1].textContent).toContain('shortcuts.move');
    expect(dls[1].textContent).toContain('shortcuts.open');
  });

  it('dismisses the sheet via MatBottomSheetRef when Close is clicked', () => {
    const { el, ref } = setup();
    const buttons = Array.from(el.querySelectorAll('button'));
    const close = buttons.find(b => b.textContent?.trim() === 'close');
    expect(close).toBeDefined();
    close?.click();
    expect(ref.dismiss).toHaveBeenCalled();
  });
});
