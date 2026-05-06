import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;
  return inject(Router).createUrlTree(['/login']);
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated() && auth.isAdmin()) return true;
  const router = inject(Router);
  return auth.isAuthenticated()
    ? router.createUrlTree(['/trees'])
    : router.createUrlTree(['/login']);
};
