import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { environment } from '@env/environment';
import { StorageService } from '../services/storage.service';
import { STORAGE_KEYS } from '../constants/app.constants';

/**
 * Rewrites relative URLs onto the configured API base and stamps the tenant and
 * correlation headers every backend request is expected to carry.
 *
 * Absolute URLs (assets, i18n JSON, third-party endpoints) pass through
 * untouched.
 */
export const apiUrlInterceptor: HttpInterceptorFn = (request, next) => {
  const storage = inject(StorageService);

  const isAbsolute = /^https?:\/\//i.test(request.url);
  const isLocalAsset = request.url.startsWith('assets/') || request.url.startsWith('/assets/');

  const url =
    isAbsolute || isLocalAsset || request.url.startsWith(environment.apiBaseUrl)
      ? request.url
      : `${environment.apiBaseUrl}/${request.url.replace(/^\//, '')}`;

  if (isLocalAsset || isAbsolute) {
    return next(request.clone({ url }));
  }

  const tenantId = storage.get<string>(STORAGE_KEYS.tenant, environment.defaultTenantId);
  const language = storage.get<string>(STORAGE_KEYS.language, environment.defaultLanguage);

  return next(
    request.clone({
      url,
      setHeaders: {
        'X-Tenant-Id': tenantId,
        'Accept-Language': language,
        'X-Client-Version': environment.appVersion,
        // Correlates a browser action with the server-side trace.
        'X-Correlation-Id': crypto.randomUUID(),
      },
    }),
  );
};
