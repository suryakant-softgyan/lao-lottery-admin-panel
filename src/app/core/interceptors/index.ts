import type { HttpInterceptorFn } from '@angular/common/http';

import { apiUrlInterceptor } from './api-url.interceptor';
import { authInterceptor } from './auth.interceptor';
import { cacheInterceptor } from './cache.interceptor';
import { errorInterceptor } from './error.interceptor';
import { loadingInterceptor } from './loading.interceptor';
import { retryInterceptor } from './retry.interceptor';

export * from './api-url.interceptor';
export * from './auth.interceptor';
export * from './cache.interceptor';
export * from './error.interceptor';
export * from './loading.interceptor';
export * from './retry.interceptor';

/**
 * Interceptor order matters:
 *  1. URL/tenant rewriting so every later stage sees the final URL;
 *  2. cache, to short-circuit before doing any auth work;
 *  3. auth, to attach the token (and refresh on 401);
 *  4. loading, so the bar covers the real request window;
 *  5. retry, before the error mapper so retries are invisible to the user;
 *  6. error, closest to the caller, translating failures into AppError.
 */
export const HTTP_INTERCEPTORS_CHAIN: HttpInterceptorFn[] = [
  apiUrlInterceptor,
  cacheInterceptor,
  authInterceptor,
  loadingInterceptor,
  retryInterceptor,
  errorInterceptor,
];
