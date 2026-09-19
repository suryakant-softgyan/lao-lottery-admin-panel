import { HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { of, tap } from 'rxjs';

interface CacheEntry {
  response: HttpResponse<unknown>;
  storedAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

/** Reference data that rarely changes and is read on nearly every screen. */
const CACHEABLE_PATTERNS = [
  /\/banks/,
  /\/lottery\/types/,
  /\/reference\//,
  /\/feature-flags/,
  /assets\/i18n\//,
];

/**
 * Short-lived GET cache for reference data.
 *
 * Requests opt out with the `X-No-Cache` header; mutations anywhere in the app
 * can call {@link clearHttpCache} to invalidate.
 */
export const cacheInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.method !== 'GET' || request.headers.has('X-No-Cache')) {
    return next(request.clone({ headers: request.headers.delete('X-No-Cache') }));
  }

  if (!CACHEABLE_PATTERNS.some((pattern) => pattern.test(request.urlWithParams))) {
    return next(request);
  }

  const key = request.urlWithParams;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.storedAt < CACHE_TTL_MS) {
    return of(hit.response.clone());
  }

  return next(request).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        cache.set(key, { response: event.clone(), storedAt: Date.now() });
      }
    }),
  );
};

/** Drops cached reads — call after a mutation that invalidates reference data. */
export function clearHttpCache(pattern?: RegExp): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of [...cache.keys()]) {
    if (pattern.test(key)) {
      cache.delete(key);
    }
  }
}
