import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import type { AppError } from '../models/common.model';
import { LoggerService } from '../services/logger.service';
import { ToastService } from '../services/toast.service';

/** Maps an HTTP status onto the message an operator should actually see. */
function describe(error: HttpErrorResponse): { title: string; message: string; retriable: boolean } {
  if (error.status === 0) {
    return {
      title: 'Connection lost',
      message: 'The server could not be reached. Check your network and try again.',
      retriable: true,
    };
  }
  switch (error.status) {
    case 400:
      return {
        title: 'Invalid request',
        message: serverMessage(error, 'Please review the form and try again.'),
        retriable: false,
      };
    case 401:
      return { title: 'Session expired', message: 'Please sign in again to continue.', retriable: false };
    case 403:
      return {
        title: 'Access denied',
        message: 'You do not have permission to perform that action.',
        retriable: false,
      };
    case 404:
      return {
        title: 'Not found',
        message: serverMessage(error, 'The requested record no longer exists.'),
        retriable: false,
      };
    case 409:
      return {
        title: 'Conflict',
        message: serverMessage(error, 'This record was changed by someone else.'),
        retriable: false,
      };
    case 422:
      return {
        title: 'Validation failed',
        message: serverMessage(error, 'Some fields did not pass validation.'),
        retriable: false,
      };
    case 429:
      return {
        title: 'Too many requests',
        message: 'Please wait a moment before trying again.',
        retriable: true,
      };
    case 503:
      return {
        title: 'Service unavailable',
        message: 'The service is temporarily offline for maintenance.',
        retriable: true,
      };
    default:
      return {
        title: 'Something went wrong',
        message: serverMessage(error, 'An unexpected error occurred. The technical team has been notified.'),
        retriable: error.status >= 500,
      };
  }
}

function serverMessage(error: HttpErrorResponse, fallback: string): string {
  const body = error.error as { message?: string; error?: string } | string | null;
  if (typeof body === 'string' && body.trim()) {
    return body;
  }
  if (body && typeof body === 'object') {
    return body.message ?? body.error ?? fallback;
  }
  return fallback;
}

/**
 * Normalises every failure into an {@link AppError} and raises a toast.
 *
 * 401s are handled by the auth interceptor (silent refresh), so they are logged
 * but not surfaced twice. Requests may set `X-Quiet` to suppress the toast and
 * handle the error inline instead.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const toast = inject(ToastService);
  const logger = inject(LoggerService);

  const quiet = request.headers.has('X-Quiet');
  const forwarded = quiet ? request.clone({ headers: request.headers.delete('X-Quiet') }) : request;

  return next(forwarded).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        logger.error('Non-HTTP error reached the interceptor', error);
        return throwError(() => error);
      }

      const described = describe(error);
      const appError: AppError = {
        status: error.status,
        code: (error.error as { code?: string } | null)?.code ?? `HTTP_${error.status}`,
        message: described.message,
        details: error.message,
        traceId: error.headers?.get('X-Correlation-Id') ?? undefined,
        timestamp: new Date().toISOString(),
        retriable: described.retriable,
      };

      logger.error(`${request.method} ${request.url} failed`, appError);

      if (!quiet && error.status !== 401) {
        toast.error(described.title, described.message);
      }

      return throwError(() => appError);
    }),
  );
};
