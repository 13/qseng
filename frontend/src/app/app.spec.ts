import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { AuthService } from './core/auth/auth.service';
import { I18nService } from './core/i18n/i18n.service';

@Component({ template: '<h1>page</h1>' }) class Dummy {}

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
});
