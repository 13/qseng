import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it } from 'vitest';
import { pendingInterceptor } from './pending.interceptor';
import { PendingRequestsService } from './pending-requests.service';

describe('pendingInterceptor', () => {
  it('counts in-flight requests and returns to zero on error too', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([pendingInterceptor])), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);
    const pending = TestBed.inject(PendingRequestsService);

    http.get('/a').subscribe();
    http.get('/b').subscribe({ error: () => {} });
    expect(pending.count()).toBe(2);

    ctrl.expectOne('/a').flush({});
    expect(pending.count()).toBe(1);
    ctrl.expectOne('/b').flush('x', { status: 500, statusText: 'err' });
    expect(pending.busy()).toBe(false);
  });
});
