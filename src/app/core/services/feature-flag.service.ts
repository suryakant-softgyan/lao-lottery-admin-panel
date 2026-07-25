import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { DEFAULT_FEATURE_FLAGS } from '../constants/feature-flags.constants';
import { STORAGE_KEYS } from '../constants/app.constants';
import type { FeatureFlag } from '../models/system.model';
import { MockBackendService } from './mock-backend.service';
import { StorageService } from './storage.service';

/**
 * Feature-flag registry.
 *
 * Flags gate routes (via `featureFlagGuard`), menu entries and template blocks,
 * so a module can be switched off for an operator without a code change. State
 * is persisted locally; replace {@link load} with a `/feature-flags` call to
 * drive it from the backend.
 */
@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  private readonly storage = inject(StorageService);
  private readonly backend = inject(MockBackendService);

  private readonly flags = signal<FeatureFlag[]>(
    this.storage.get<FeatureFlag[]>(STORAGE_KEYS.featureFlags, DEFAULT_FEATURE_FLAGS),
  );

  readonly all = this.flags.asReadonly();

  /** Fast lookup set of enabled keys, recomputed whenever a flag changes. */
  private readonly enabledKeys = computed(
    () =>
      new Set(
        this.flags()
          .filter((flag) => flag.enabled)
          .map((flag) => flag.key),
      ),
  );

  readonly enabledCount = computed(() => this.enabledKeys().size);

  /** Groups flags by module for the settings screen. */
  readonly byModule = computed(() => {
    const grouped = new Map<string, FeatureFlag[]>();
    for (const flag of this.flags()) {
      const bucket = grouped.get(flag.module);
      if (bucket) {
        bucket.push(flag);
      } else {
        grouped.set(flag.module, [flag]);
      }
    }
    return [...grouped.entries()].map(([module, items]) => ({ module, items }));
  });

  /** True when the flag is on, and the user's role is in scope. */
  isEnabled(key: string, roles: readonly string[] = []): boolean {
    const flag = this.flags().find((item) => item.key === key);
    if (!flag) {
      // Unknown keys default to enabled so a missing flag never hides a screen.
      return true;
    }
    if (!flag.enabled) {
      return false;
    }
    if (flag.roles.length === 0) {
      return true;
    }
    return roles.some((role) => flag.roles.includes(role));
  }

  /** Loads the flag set. Swap the body for an HTTP call when the API exists. */
  load(): Observable<FeatureFlag[]> {
    return this.backend.respond(() => this.flags());
  }

  setEnabled(key: string, enabled: boolean, actor = 'Administrator'): void {
    this.flags.update((current) =>
      current.map((flag) =>
        flag.key === key ? { ...flag, enabled, updatedAt: new Date().toISOString(), updatedBy: actor } : flag,
      ),
    );
    this.persist();
  }

  update(key: string, changes: Partial<FeatureFlag>, actor = 'Administrator'): void {
    this.flags.update((current) =>
      current.map((flag) =>
        flag.key === key
          ? { ...flag, ...changes, updatedAt: new Date().toISOString(), updatedBy: actor }
          : flag,
      ),
    );
    this.persist();
  }

  reset(): void {
    this.flags.set(DEFAULT_FEATURE_FLAGS);
    this.persist();
  }

  private persist(): void {
    this.storage.set(STORAGE_KEYS.featureFlags, this.flags());
  }
}
