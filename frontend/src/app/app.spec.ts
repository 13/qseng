import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { AuthService } from './core/auth/auth.service';
import { I18nService } from './core/i18n/i18n.service';

@Component({ template: '<h1 tabindex="-1">page</h1>' }) class Dummy {}

function setup(authenticated: boolean) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'login', component: Dummy, data: { layout: 'auth' } },
        { path: 'trees', component: Dummy }
      ]),
      { provide: AuthService, useValue: { isAuthenticated: () => authenticated, isAdmin: () => false, displayName: () => 'Demo Admin', username: () => 'demo', logout: vi.fn() } },
      { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k, lang: () => 'en', setLang: vi.fn() } }
    ]
  });
  return TestBed.createComponent(App);
}

describe('App shell', () => {
  it('hides the toolbar on auth-layout routes even when a session exists', async () => {
    const fixture = setup(true);
    await TestBed.inject(Router).navigateByUrl('/login');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-toolbar')).toBeNull();
  });

  it('shows toolbar, brand and user initials on app routes', async () => {
    const fixture = setup(true);
    await TestBed.inject(Router).navigateByUrl('/trees');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('mat-toolbar')).not.toBeNull();
    expect(el.querySelector('.qs-user__avatar')?.textContent?.trim()).toBe('DA');
  });

  it('focuses the page heading on a path change but not on a query-only navigation', async () => {
    // document.activeElement comparisons are unreliable in jsdom here, so this asserts via
    // a spy on HTMLElement.prototype.focus instead (call count stays 1 after the query-only nav).
    // The component under test queries the global `document` (not the fixture) for "main h1",
    // so the fixture is attached to document.body for the duration of the test. It also uses
    // autoDetectChanges() rather than manual detectChanges(): the focus call is scheduled with
    // queueMicrotask from a router-events subscription, and without autoDetectChanges the
    // isolated fixture's view is not kept in sync with the app's own microtask-scheduled
    // (zoneless) change detection, so the heading would not exist in the DOM yet when the
    // focus microtask runs.
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    const fixture = setup(true);
    document.body.appendChild(fixture.nativeElement);
    fixture.autoDetectChanges();
    try {
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/trees');
      await new Promise(r => queueMicrotask(() => r(undefined)));
      expect(focusSpy).toHaveBeenCalledTimes(1);

      await router.navigateByUrl('/trees?q=smith');
      await new Promise(r => queueMicrotask(() => r(undefined)));
      expect(focusSpy).toHaveBeenCalledTimes(1);
    } finally {
      fixture.nativeElement.remove();
    }
  });
});
