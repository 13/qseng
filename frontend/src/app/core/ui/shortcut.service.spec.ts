import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ShortcutService } from './shortcut.service';

function key(target: Element, init: KeyboardEventInit) {
  const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(ev);
  return ev;
}

describe('ShortcutService', () => {
  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    document.body.innerHTML = '<input id="i"><div id="d"></div>';
    return TestBed.inject(ShortcutService);
  }

  it('fires mod+k from the document but not plain k', () => {
    const svc = setup();
    const h = vi.fn();
    svc.register('mod+k', h);
    key(document.body, { key: 'k', ctrlKey: true });
    key(document.body, { key: 'k' });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('ignores ? typed into an input unless allowInInputs', () => {
    const svc = setup();
    const h = vi.fn(); const s = vi.fn();
    svc.register('?', h);
    svc.register('mod+s', s, { allowInInputs: true });
    const input = document.getElementById('i')!;
    key(input, { key: '?' });
    key(input, { key: 's', ctrlKey: true });
    expect(h).not.toHaveBeenCalled();
    expect(s).toHaveBeenCalledTimes(1);
  });

  it('prevents the browser default for handled combos and stops after unregister', () => {
    const svc = setup();
    const off = svc.register('mod+k', () => undefined);
    expect(key(document.body, { key: 'k', ctrlKey: true }).defaultPrevented).toBe(true);
    off();
    expect(key(document.body, { key: 'k', ctrlKey: true }).defaultPrevented).toBe(false);
  });

  it('mod+k still fires inside an input (palette is reachable while typing)', () => {
    const svc = setup();
    const h = vi.fn();
    svc.register('mod+k', h);
    key(document.getElementById('i')!, { key: 'k', ctrlKey: true });
    expect(h).toHaveBeenCalledTimes(1);
  });
});
