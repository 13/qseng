import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth/auth.service';

/** Refreshing on a 401 from these would loop. */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

function isAuthEndpoint(req: HttpRequest<unknown>): boolean {
  return AUTH_ENDPOINTS.some(path => req.url.includes(path));
}

/**
 * Access tokens are short-lived, and the server rejects them outright once a
 * user is deactivated or their sessions are revoked. On a 401 we attempt exactly
 * one refresh (shared across concurrent requests) and replay; if that fails the
 * session is genuinely over.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  const endSession = () => {
    auth.clear();
    void router.navigate(['/login']);
  };

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401) return throwError(() => err);

      if (isAuthEndpoint(req)) return throwError(() => err);

      if (!auth.isAuthenticated()) {
        endSession();
        return throwError(() => err);
      }

      return auth.refreshSession().pipe(
        switchMap(session =>
          next(req.clone({ setHeaders: { Authorization: `Bearer ${session.accessToken}` } }))
        ),
        catchError(refreshErr => {
          endSession();
          return throwError(() => refreshErr);
        })
      );
    })
  );
};
