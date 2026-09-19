import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, debounceTime, filter, forkJoin, groupBy, mergeMap, of } from 'rxjs';

import { environment } from '@env/environment';
import { PermissionService } from '../authentication/permission.service';
import { STORAGE_KEYS } from '../constants/app.constants';
import { LoggerService } from './logger.service';
import { StorageService } from './storage.service';
import { ThemeService } from './theme.service';

/** Tenant-wide documents, stored as `panel.<key>` settings on the API (shared by every administrator). */
const PLATFORM_KEYS = new Set<string>([
  'settings.general',
  'settings.financial',
  'settings.notifications',
  STORAGE_KEYS.branding,
  STORAGE_KEYS.regional,
]);

/** Personal documents, stored as `/me/preferences/<key>` (follow the user across devices). */
const PERSONAL_KEYS = new Set<string>([
  STORAGE_KEYS.theme,
  STORAGE_KEYS.dashboardLayout,
  STORAGE_KEYS.favourites,
  STORAGE_KEYS.pinned,
  STORAGE_KEYS.tablePrefs,
]);

const QUIET = { headers: { 'X-Quiet': '1' } };

/**
 * Keeps the panel's configuration — which the screens read and write through {@link StorageService}
 * — in step with the API. Local storage stays as the instant, offline-friendly cache; the server is
 * the source of truth that is pulled once per session and pushed on every change.
 */
@Injectable({ providedIn: 'root' })
export class RemoteConfigService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly theme = inject(ThemeService);
  private readonly permissions = inject(PermissionService);
  private readonly logger = inject(LoggerService);

  private hydrating = false;
  private started = false;

  start(): void {
    if (environment.useMockData || this.started) {
      return;
    }
    this.started = true;
    this.pull();

    this.storage.changes$
      .pipe(
        filter(({ key }) => !this.hydrating && (PLATFORM_KEYS.has(key) || PERSONAL_KEYS.has(key))),
        groupBy(({ key }) => key),
        mergeMap((group) => group.pipe(debounceTime(800))),
      )
      .subscribe(({ key, value }) => this.push(key, value));
  }

  private pull(): void {
    forkJoin({
      personal: this.http
        .get<Record<string, unknown>>(`${environment.apiBaseUrl}/me/preferences`, QUIET)
        .pipe(catchError(() => of({} as Record<string, unknown>))),
      platform: this.http
        .get<{ settings?: Record<string, string> }>(`${environment.apiBaseUrl}/public/bootstrap`, {
          params: { audience: 'ADMIN' },
          ...QUIET,
        })
        .pipe(catchError(() => of({ settings: {} as Record<string, string> }))),
      restricted: this.permissions.has('settings.view')
        ? this.http
            .get<{ key: string; value: string }[]>(`${environment.apiBaseUrl}/admin/settings`, {
              params: { group: 'panel' },
              ...QUIET,
            })
            .pipe(catchError(() => of([] as { key: string; value: string }[])))
        : of([] as { key: string; value: string }[]),
    }).subscribe(({ personal, platform, restricted }) => {
      this.hydrating = true;
      try {
        const documents = new Map<string, unknown>();
        Object.entries(platform.settings ?? {}).forEach(([key, value]) => this.collect(documents, key, value));
        restricted.forEach((setting) => this.collect(documents, setting.key, setting.value));
        Object.entries(personal).forEach(([key, value]) => documents.set(key, value));

        documents.forEach((value, key) => {
          if (key === STORAGE_KEYS.theme) {
            this.theme.update(value as Parameters<ThemeService['update']>[0]);
          } else if (key === STORAGE_KEYS.branding) {
            this.theme.updateBranding(value as Parameters<ThemeService['updateBranding']>[0]);
          } else if (key === STORAGE_KEYS.regional) {
            this.theme.updateRegional(value as Parameters<ThemeService['updateRegional']>[0]);
          } else if (PLATFORM_KEYS.has(key) || PERSONAL_KEYS.has(key)) {
            this.storage.set(key, value);
          }
        });
      } finally {
        this.hydrating = false;
      }
    });
  }

  private collect(documents: Map<string, unknown>, settingKey: string, raw: string): void {
    if (!settingKey.startsWith('panel.') || !raw) {
      return;
    }
    try {
      documents.set(settingKey.slice('panel.'.length), JSON.parse(raw));
    } catch {
      this.logger.warn(`RemoteConfig: setting ${settingKey} is not valid JSON`);
    }
  }

  private push(key: string, value: unknown): void {
    const request = PLATFORM_KEYS.has(key)
      ? this.http.put(`${environment.apiBaseUrl}/admin/settings`, { [`panel.${key}`]: JSON.stringify(value) }, QUIET)
      : this.http.put(`${environment.apiBaseUrl}/me/preferences/${encodeURIComponent(key)}`, value ?? {}, QUIET);
    request.subscribe({
      error: (error) => this.logger.warn(`RemoteConfig: could not save "${key}" to the server`, error),
    });
  }
}
