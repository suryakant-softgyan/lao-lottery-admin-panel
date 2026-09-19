import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '@env/environment';
import type { Page, PageQuery } from '../models/common.model';
import { deepClone } from '../utilities/object.util';
import type { QueryOptions } from '../utilities/query.util';
import { MockBackendService } from './mock-backend.service';

/**
 * Repository base class implementing the mock ↔ REST switch.
 *
 * A concrete repository supplies a seeded dataset and a resource path. While
 * `environment.useMockData` is true every call is served from the in-memory
 * collection through {@link MockBackendService}; flip the flag and the exact
 * same methods issue HTTP requests against `apiBaseUrl/resourcePath`.
 *
 * Subclasses override `queryOptions` to declare which fields quick-search
 * scans and which field the date-range filter applies to.
 */
export abstract class BaseRepository<T extends { id: string }, P = Partial<T>> {
  protected readonly http = inject(HttpClient);
  protected readonly backend = inject(MockBackendService);

  /** REST resource path, e.g. `users`. */
  protected abstract readonly resourcePath: string;

  /** Seeded records. Lazily created so start-up cost is paid on first use. */
  protected abstract seed(): T[];

  /** Search/date-field configuration for the in-memory query engine. */
  protected queryOptions: QueryOptions = {};

  private cache: T[] | null = null;

  /** Live, mutable view of the mock dataset. */
  protected get records(): T[] {
    this.cache ??= this.seed();
    return this.cache;
  }

  protected set records(value: T[]) {
    this.cache = value;
  }

  protected get baseUrl(): string {
    return `${environment.apiBaseUrl}/${this.resourcePath}`;
  }

  /** Serialises a {@link PageQuery} into query parameters for the real API. */
  protected toHttpParams(query: PageQuery): Record<string, string> {
    const params: Record<string, string> = {
      page: String(query.page),
      size: String(query.size),
    };
    if (query.search) {
      params['search'] = query.search;
    }
    if (query.sort?.active && query.sort.direction) {
      params['sort'] = `${query.sort.active},${query.sort.direction}`;
    }
    if (query.dateRange?.from) {
      params['from'] = query.dateRange.from;
    }
    if (query.dateRange?.to) {
      params['to'] = query.dateRange.to;
    }
    if (query.filters?.length) {
      params['filters'] = JSON.stringify(query.filters);
    }
    for (const [key, value] of Object.entries(query.quick ?? {})) {
      if (value !== null && value !== undefined && value !== '' && value !== 'ALL') {
        params[key] = Array.isArray(value) ? value.join(',') : String(value);
      }
    }
    return params;
  }

  /** Paged list. */
  list(query: PageQuery): Observable<Page<T>> {
    if (!environment.useMockData) {
      return this.http.get<Page<T>>(this.baseUrl, { params: this.toHttpParams(query) });
    }
    return this.backend
      .respondWithPage(this.records, query, this.queryOptions)
      .pipe(map((page) => ({ ...page, content: deepClone(page.content) })));
  }

  /** Every record matching the query, unpaged — used by exports and charts. */
  all(): Observable<T[]> {
    if (!environment.useMockData) {
      return this.http.get<T[]>(`${this.baseUrl}/all`);
    }
    return this.backend.respond(() => deepClone(this.records));
  }

  getById(id: string): Observable<T> {
    if (!environment.useMockData) {
      return this.http.get<T>(`${this.baseUrl}/${id}`);
    }
    const found = this.records.find((record) => record.id === id);
    return found
      ? this.backend.respond(() => deepClone(found))
      : this.backend.notFound<T>(this.resourcePath, id);
  }

  create(payload: P): Observable<T> {
    if (!environment.useMockData) {
      return this.http.post<T>(this.baseUrl, payload);
    }
    return this.backend.respond(() => {
      const created = this.buildFromPayload(payload);
      this.records = [created, ...this.records];
      return deepClone(created);
    });
  }

  update(id: string, payload: P): Observable<T> {
    if (!environment.useMockData) {
      return this.http.put<T>(`${this.baseUrl}/${id}`, payload);
    }
    const index = this.records.findIndex((record) => record.id === id);
    if (index === -1) {
      return this.backend.notFound<T>(this.resourcePath, id);
    }
    return this.backend.respond(() => {
      const merged = this.mergePayload(this.records[index] as T, payload);
      this.records[index] = merged;
      return deepClone(merged);
    });
  }

  /** Partial update used by inline edits and status toggles. */
  patch(id: string, changes: Partial<T>): Observable<T> {
    if (!environment.useMockData) {
      return this.http.patch<T>(`${this.baseUrl}/${id}`, changes);
    }
    const index = this.records.findIndex((record) => record.id === id);
    if (index === -1) {
      return this.backend.notFound<T>(this.resourcePath, id);
    }
    return this.backend.respond(() => {
      const merged = {
        ...(this.records[index] as T),
        ...changes,
        updatedAt: new Date().toISOString(),
      } as T;
      this.records[index] = merged;
      return deepClone(merged);
    });
  }

  delete(id: string): Observable<void> {
    if (!environment.useMockData) {
      return this.http.delete<void>(`${this.baseUrl}/${id}`);
    }
    return this.backend.respond(() => {
      this.records = this.records.filter((record) => record.id !== id);
      return undefined as void;
    });
  }

  deleteMany(ids: readonly string[]): Observable<void> {
    if (!environment.useMockData) {
      return this.http.request<void>('delete', this.baseUrl, { body: { ids } });
    }
    return this.backend.respond(() => {
      const doomed = new Set(ids);
      this.records = this.records.filter((record) => !doomed.has(record.id));
      return undefined as void;
    });
  }

  /** Bulk status change shared by nearly every module's bulk-action bar. */
  bulkPatch(ids: readonly string[], changes: Partial<T>): Observable<T[]> {
    if (!environment.useMockData) {
      return this.http.patch<T[]>(`${this.baseUrl}/bulk`, { ids, changes });
    }
    return this.backend.respond(() => {
      const targets = new Set(ids);
      const touched: T[] = [];
      this.records = this.records.map((record) => {
        if (!targets.has(record.id)) {
          return record;
        }
        const merged = { ...record, ...changes, updatedAt: new Date().toISOString() } as T;
        touched.push(merged);
        return merged;
      });
      return deepClone(touched);
    });
  }

  /** Generates the identifier used for newly created mock records. */
  protected nextId(): string {
    return `${this.resourcePath}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Builds a full entity from a create payload. Subclasses override this to fill
   * in derived fields (codes, denormalised names, zeroed counters).
   */
  protected buildFromPayload(payload: P): T {
    const now = new Date().toISOString();
    return {
      ...(payload as unknown as T),
      id: this.nextId(),
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Merges an update payload onto an existing entity. */
  protected mergePayload(existing: T, payload: P): T {
    return {
      ...existing,
      ...(payload as unknown as Partial<T>),
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };
  }
}
