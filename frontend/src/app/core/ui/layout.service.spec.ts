import { TestBed } from '@angular/core/testing';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { LayoutService, QUERIES } from './layout.service';

function observerFor(active: string) {
  const state = (): BreakpointState => ({
    matches: true,
    breakpoints: { [QUERIES.handset]: active === 'handset', [QUERIES.tablet]: active === 'tablet', [QUERIES.desktop]: active === 'desktop' }
  });
  const subject = new BehaviorSubject<BreakpointState>(state());
  return { observe: () => subject.asObservable(), subject };
}

describe('LayoutService', () => {
  it('exposes handset / tablet / desktop as mutually exclusive signals', () => {
    const observer = observerFor('tablet');
    TestBed.configureTestingModule({ providers: [{ provide: BreakpointObserver, useValue: observer }] });
    const layout = TestBed.inject(LayoutService);
    expect(layout.tablet()).toBe(true);
    expect(layout.handset()).toBe(false);
    expect(layout.desktop()).toBe(false);
  });
});
