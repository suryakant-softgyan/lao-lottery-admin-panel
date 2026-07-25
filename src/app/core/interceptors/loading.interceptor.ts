import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';

import { LoadingService } from '../services/loading.service';

/**
 * Drives the shell's global progress bar.
 *
 * Requests can opt out with the `X-Silent` header — used by polling widgets
 * (system health, notification counts) that should not flash the bar.
 */
export const loadingInterceptor: HttpInterceptorFn = (request, next) => {
  const loading = inject(LoadingService);

  if (request.headers.has('X-Silent')) {
    return next(request.clone({ headers: request.headers.delete('X-Silent') }));
  }

  loading.start();
  return next(request).pipe(finalize(() => loading.stop()));
};
