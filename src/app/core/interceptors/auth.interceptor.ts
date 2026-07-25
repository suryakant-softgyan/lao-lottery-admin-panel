import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';

import { AuthService } from '../authentication/auth.service';
import { TokenService } from '../authentication/token.service';

/** Endpoints that must never carry (or retry with) an access token. */
const PUBLIC_PATHS = ['/auth/login', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];

/** Guards against a refresh stampede when several requests 401 at once. */
let refreshInFlight = false;
const refreshedToken = new BehaviorSubject<string | null>(null);

/**
 * Attaches the bearer token and transparently recovers from a 401 by refreshing
 * once and replaying the failed requests. If the refresh itself fails the
 * session is terminated.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const tokens = inject(TokenService);
  const auth = inject(AuthService);

  const isPublic = PUBLIC_PATHS.some((path) => request.url.includes(path));
  const accessToken = tokens.accessToken;

  const authorised =
    accessToken && !isPublic
      ? request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
      : request;

  return next(authorised).pipe(
    catchError((error: unknown) => {
      const is401 = error instanceof HttpErrorResponse && error.status === 401;
      if (!is401 || isPublic || !tokens.refreshToken) {
        return throwError(() => error);
      }

      if (refreshInFlight) {
        // Queue behind the in-flight refresh, then replay.
        return refreshedToken.pipe(
          filter((token): token is string => token !== null),
          take(1),
          switchMap((token) => next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
        );
      }

      refreshInFlight = true;
      refreshedToken.next(null);

      return auth.refreshToken().pipe(
        switchMap((issued) => {
          refreshInFlight = false;
          refreshedToken.next(issued.accessToken);
          return next(request.clone({ setHeaders: { Authorization: `Bearer ${issued.accessToken}` } }));
        }),
        catchError((refreshError: unknown) => {
          refreshInFlight = false;
          auth.logout('unauthorised');
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
