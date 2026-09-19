import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { retry, timer } from 'rxjs';

/** Only idempotent reads are safe to replay automatically. */
const RETRIABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const RETRIABLE_STATUSES = new Set([0, 408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 2;

/**
 * Exponential-backoff retry for transient read failures.
 *
 * Mutations are never retried — replaying a POST could double-credit a wallet.
 */
export const retryInterceptor: HttpInterceptorFn = (request, next) => {
  if (!RETRIABLE_METHODS.has(request.method)) {
    return next(request);
  }

  return next(request).pipe(
    retry({
      count: MAX_ATTEMPTS,
      delay: (error: unknown, retryCount: number) => {
        const status = error instanceof HttpErrorResponse ? error.status : -1;
        if (!RETRIABLE_STATUSES.has(status)) {
          throw error;
        }
        // 400ms, then 800ms, with jitter to avoid a synchronised retry storm.
        const backoff = 400 * 2 ** (retryCount - 1);
        return timer(backoff + Math.random() * 200);
      },
    }),
  );
};
