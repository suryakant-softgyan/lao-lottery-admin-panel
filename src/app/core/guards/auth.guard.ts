import { inject } from '@angular/core';
import { Router, type CanActivateChildFn, type CanActivateFn } from '@angular/router';

import { AuthService } from '../authentication/auth.service';
import { TokenService } from '../authentication/token.service';

/**
 * Blocks unauthenticated access and remembers the attempted URL so the user
 * lands where they meant to go after signing in.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const tokens = inject(TokenService);
  const router = inject(Router);

  if (auth.isAuthenticated() && !tokens.isExpired()) {
    return true;
  }

  auth.setRedirectUrl(state.url);
  const reason = tokens.hasToken() ? 'expired' : undefined;
  return router.createUrlTree(['/auth/login'], { queryParams: reason ? { reason } : undefined });
};

export const authChildGuard: CanActivateChildFn = (route, state) => authGuard(route, state);

/** Keeps signed-in users away from the login/reset screens. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true;
};
