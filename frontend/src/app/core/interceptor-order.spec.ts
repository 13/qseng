import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { pendingInterceptor } from './ui/pending.interceptor';
import { authInterceptor } from './auth/auth.interceptor';
import { errorInterceptor } from './error.interceptor';
import { PendingRequestsService } from './ui/pending-requests.service';
import { AuthResponse, AuthService } from './auth/auth.service';
import { ToastService } from './ui/toast.service';
import { I18nService } from './i18n/i18n.service';

describe('interceptor order', () => {
  it('keeps a pending count through a 401 refresh-and-replay, with the replay authorized', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([pendingInterceptor, authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => true,
            token: () => 'old',
            refreshSession: () => of({ accessToken: 'new' } as unknown as AuthResponse),
            clear: vi.fn()
          }
        },
        { provide: ToastService, useValue: { error: vi.fn(), success: vi.fn(), info: vi.fn() } },
        { provide: I18nService, useValue: { t: (k: string) => k } },
        { provide: Router, useValue: { navigate: vi.fn(), url: '/x' } }
      ]
    });

    const http = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);
    const pending = TestBed.inject(PendingRequestsService);

    let body: unknown;
    http.get('/api/v1/trees').subscribe(b => (body = b));

    const first = ctrl.expectOne('/api/v1/trees');
    expect(first.request.headers.get('Authorization')).toBe('Bearer old');
    first.flush('', { status: 401, statusText: 'u' });

    expect(pending.count()).toBe(1);

    const replay = ctrl.expectOne('/api/v1/trees');
    expect(replay.request.headers.get('Authorization')).toBe('Bearer new');
    replay.flush([]);

    expect(body).toEqual([]);
    expect(pending.count()).toBe(0);
  });
});
