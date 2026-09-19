import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

import { STORAGE_PREFIX } from '../constants/app.constants';
import { LoggerService } from './logger.service';

/**
 * Namespaced, JSON-aware wrapper over Web Storage.
 *
 * Every read is defensive: private-browsing modes and quota failures must never
 * take the portal down, so failures degrade to an in-memory map.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly document = inject(DOCUMENT);
  private readonly logger = inject(LoggerService);
  /** Fallback used when Web Storage is unavailable or throws. */
  private readonly memory = new Map<string, string>();

  private readonly available = this.detectAvailability();

  private get window(): (Window & typeof globalThis) | null {
    return this.document.defaultView;
  }

  private key(key: string): string {
    return `${STORAGE_PREFIX}:${key}`;
  }

  private detectAvailability(): boolean {
    try {
      const probe = `${STORAGE_PREFIX}:probe`;
      this.window?.localStorage.setItem(probe, '1');
      this.window?.localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  private store(session: boolean): Storage | null {
    if (!this.available) {
      return null;
    }
    return session ? (this.window?.sessionStorage ?? null) : (this.window?.localStorage ?? null);
  }

  /** Reads and parses a value, returning `fallback` when absent or corrupt. */
  get<T>(key: string, fallback: T, session = false): T {
    const namespaced = this.key(key);
    try {
      const raw = this.store(session)?.getItem(namespaced) ?? this.memory.get(namespaced) ?? null;
      if (raw === null) {
        return fallback;
      }
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(`StorageService: unable to read "${key}"`, error);
      return fallback;
    }
  }

  set<T>(key: string, value: T, session = false): void {
    const namespaced = this.key(key);
    const raw = JSON.stringify(value);
    try {
      const store = this.store(session);
      if (store) {
        store.setItem(namespaced, raw);
      } else {
        this.memory.set(namespaced, raw);
      }
    } catch (error) {
      // Quota exceeded — keep the value in memory so the session still works.
      this.memory.set(namespaced, raw);
      this.logger.warn(`StorageService: unable to persist "${key}"`, error);
    }
  }

  remove(key: string, session = false): void {
    const namespaced = this.key(key);
    this.memory.delete(namespaced);
    try {
      this.store(session)?.removeItem(namespaced);
    } catch (error) {
      this.logger.warn(`StorageService: unable to remove "${key}"`, error);
    }
  }

  /** Clears only this application's namespaced keys. */
  clearNamespace(session = false): void {
    const store = this.store(session);
    if (store) {
      const doomed: string[] = [];
      for (let index = 0; index < store.length; index++) {
        const key = store.key(index);
        if (key?.startsWith(`${STORAGE_PREFIX}:`)) {
          doomed.push(key);
        }
      }
      doomed.forEach((key) => store.removeItem(key));
    }
    this.memory.clear();
  }

  has(key: string, session = false): boolean {
    const namespaced = this.key(key);
    return (this.store(session)?.getItem(namespaced) ?? this.memory.get(namespaced)) !== undefined;
  }
}
