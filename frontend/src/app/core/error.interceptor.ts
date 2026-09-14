import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { I18nService } from './i18n/i18n.service';
import { ToastService } from './ui/toast.service';
import { problemMessage } from './api/problem-details';

/** Refreshing on a 401 from these would loop. */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

function isAuthEndpoint(req: HttpRequest<unknown>): boolean {
  return AUTH_ENDPOINTS.some(path => req.url.includes(path));
}

/**
 * 401: one shared refresh then replay, else end the session (returnUrl kept).
 * 403: toast. 5xx / network: toast. 400/404/409 are rethrown for the caller
 * (forms map validation errors; resources show not-found views).
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const toast = inject(ToastService);
  const i18n = inject(I18nService);

  const endSession = () => {
    auth.clear();
    const current = router.url;
    const returnUrl = current.startsWith('/login') ? undefined : current;
    void router.navigate(['/login'], { queryParams: returnUrl ? { returnUrl } : {} });
  };

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        if (isAuthEndpoint(req) || !auth.isAuthenticated()) {
          if (!isAuthEndpoint(req)) endSession();
          return throwError(() => err);
        }
        return auth.refreshSession().pipe(
          switchMap(session => next(req.clone({ setHeaders: { Authorization: `Bearer ${session.accessToken}` } }))),
          catchError(refreshErr => { endSession(); return throwError(() => refreshErr); })
        );
      }
      if (err.status === 403) toast.error(problemMessage(err, i18n.t('err.forbidden')));
      else if (err.status === 0 || err.status >= 500) toast.error(problemMessage(err, i18n.t('err.server')));
      return throwError(() => err);
    })
  );
};
