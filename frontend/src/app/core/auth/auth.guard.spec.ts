import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { adminGuard, authGuard } from './auth.guard';
import { AuthService } from './auth.service';

function run(guard: typeof authGuard, auth: { isAuthenticated: boolean; isAdmin: boolean }, url = '/trees/1') {
  TestBed.configureTestingModule({
    providers: [{ provide: AuthService, useValue: { isAuthenticated: () => auth.isAuthenticated, isAdmin: () => auth.isAdmin } }]
  });
  const state = { url } as RouterStateSnapshot;
  return TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, state));
}

function asUrl(result: unknown): string {
  expect(result).toBeInstanceOf(UrlTree);
  return TestBed.inject(Router).serializeUrl(result as UrlTree);
}

describe('authGuard', () => {
  it('allows authenticated users', () => {
    expect(run(authGuard, { isAuthenticated: true, isAdmin: false })).toBe(true);
  });
  it('redirects anonymous users to login with returnUrl', () => {
    expect(asUrl(run(authGuard, { isAuthenticated: false, isAdmin: false }, '/persons/42'))).toBe('/login?returnUrl=%2Fpersons%2F42');
  });
});

describe('adminGuard', () => {
  it('allows admins', () => {
    expect(run(adminGuard, { isAuthenticated: true, isAdmin: true })).toBe(true);
  });
  it('sends non-admin users to trees', () => {
    expect(asUrl(run(adminGuard, { isAuthenticated: true, isAdmin: false }))).toBe('/trees');
  });
  it('sends anonymous users to login with returnUrl', () => {
    expect(asUrl(run(adminGuard, { isAuthenticated: false, isAdmin: false }, '/admin/users'))).toBe('/login?returnUrl=%2Fadmin%2Fusers');
  });
});
