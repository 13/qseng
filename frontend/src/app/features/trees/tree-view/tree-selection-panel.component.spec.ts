import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, expect, it, vi } from 'vitest';
import { TreeSelectionPanelComponent } from './tree-selection-panel.component';
import { TreeStore } from './tree.store';
import { I18nService } from '../../../core/i18n/i18n.service';

const me = { id: 'me', firstName: 'Konrad', lastName: 'Smith', sex: 'Male' as const, birth: { year: 1843, month: 11, day: 5 }, birthPlace: 'Bregenz', death: { year: 1909 } };
const wife = { id: 'wife', firstName: 'Maria', lastName: 'Smith', sex: 'Female' as const };

function setup() {
  const store = { relativesOf: vi.fn(() => ({ parents: [], spouses: [wife], children: [] })), select: vi.fn() };
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideNoopAnimations(), { provide: TreeStore, useValue: store }, { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }] });
  const fixture = TestBed.createComponent(TreeSelectionPanelComponent);
  fixture.componentRef.setInput('person', me);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, store };
}

describe('TreeSelectionPanelComponent', () => {
  it('shows identity, lifespan, places and relative chips', () => {
    const { fixture } = setup();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Konrad Smith');
    expect(text).toContain('1843 – 1909');
    expect(text).toContain('Bregenz');
    expect(text).toContain('Maria Smith');
  });
  it('selecting a relative chip selects it in the store and emits navigate', () => {
    const { cmp, store } = setup();
    const nav = vi.fn(); cmp.navigate.subscribe(nav);
    cmp.goTo(wife);
    expect(store.select).toHaveBeenCalledWith('wife');
    expect(nav).toHaveBeenCalledWith('wife');
  });
});
