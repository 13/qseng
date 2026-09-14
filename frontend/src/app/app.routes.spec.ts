import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { searchRedirect } from './app.routes';

@Component({ template: '<h1>tree</h1>' }) class Dummy {}

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'trees/:treeId/search', redirectTo: searchRedirect },
        { path: 'trees/:treeId', component: Dummy }
      ])
    ]
  });
  return TestBed.inject(Router);
}

describe('searchRedirect', () => {
  it('preserves the q query param when redirecting to the tree view', async () => {
    const router = setup();
    await router.navigateByUrl('/trees/t1/search?q=foo');
    expect(router.url).toBe('/trees/t1?q=foo');
  });

  it('drops the query string entirely when q is absent', async () => {
    const router = setup();
    await router.navigateByUrl('/trees/t1/search');
    expect(router.url).toBe('/trees/t1');
  });

  it('encodes special characters in q', async () => {
    const router = setup();
    await router.navigateByUrl(`/trees/t1/search?q=${encodeURIComponent('a b&c')}`);
    expect(router.url).toContain('q=a%20b%26c');
  });
});
