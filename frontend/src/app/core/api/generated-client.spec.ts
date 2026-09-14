import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { PersonsApi, TreesApi, TreeDto, Sex } from './generated';

describe('generated API client', () => {
  it('calls the expected URL and types the response', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(TreesApi);
    const http = TestBed.inject(HttpTestingController);

    let trees: TreeDto[] = [];
    api.treesGetAll().subscribe(t => (trees = t));

    const req = http.expectOne('/api/v1/trees');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 't1', name: 'Familie', createdAt: '2026-01-01T00:00:00Z', personCount: 3 }]);

    expect(trees[0].name).toBe('Familie');
    http.verify();
  });

  it('serialises path params and bodies', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(PersonsApi);
    const http = TestBed.inject(HttpTestingController);
    const sex: Sex = 'Female';

    api.personsCreate({ treeId: 'abc', body: { firstName: 'Ada', lastName: 'L', sex } }).subscribe();

    const req = http.expectOne('/api/v1/trees/abc/persons');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ firstName: 'Ada', lastName: 'L', sex: 'Female' });
    req.flush({ id: 'p1', treeId: 'abc', firstName: 'Ada', lastName: 'L', sex: 'Female' });
    http.verify();
  });
});
