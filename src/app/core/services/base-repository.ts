import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, forkJoin, map, of, tap, throwError } from 'rxjs';

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
    if (!environment.useMockData) {
      // Live mode never touches the seed: synchronous helpers see the rows most recently fetched.
      return this.liveRows;
    }
    this.cache ??= this.seed();
    return this.cache;
  }

  private liveRows: T[] = [];

  /** Remembers fetched rows for the synchronous helpers (option lists, look-ups). */
  protected remember(rows: readonly T[]): void {
    const byId = new Map(this.liveRows.map((row) => [row.id, row]));
    rows.forEach((row) => byId.set(row.id, row));
    this.liveRows = [...byId.values()].slice(-500);
  }

  /** Number of rows matching the given API filters (a `size=1` page read). */
  protected liveCount(path: string, params: Record<string, string> = {}): Observable<number> {
    return this.http
      .get<Page<unknown>>(this.api(path), { params: { ...params, page: '0', size: '1' } })
      .pipe(map((page) => page.totalElements ?? 0));
  }

  /**
   * Live counterpart of {@link patch}. The API has no generic PATCH: every state change is an explicit
   * command (suspend, approve, freeze …), so repositories translate the changed fields into one.
   */
  protected livePatch(id: string, changes: Partial<T>): Observable<T> {
    void id;
    void changes;
    return throwError(() => new Error(`${this.resourcePath}: this change is not supported by the API`));
  }

  protected set records(value: T[]) {
    this.cache = value;
  }

  /** Path of the live collection below `apiBaseUrl`. Back-office resources live under `admin/`. */
  protected get livePath(): string {
    return `admin/${this.resourcePath}`;
  }

  protected get baseUrl(): string {
    return `${environment.apiBaseUrl}/${environment.useMockData ? this.resourcePath : this.livePath}`;
  }

  protected get live(): boolean {
    return !environment.useMockData;
  }

  protected api(path: string): string {
    return `${environment.apiBaseUrl}/${path.replace(/^\//, '')}`;
  }

  /** API record → panel model. Override when the shapes differ. */
  protected fromApi(record: unknown): T {
    return record as T;
  }

  /** Panel payload → API request body. Override when the shapes differ. */
  protected toApi(payload: P): unknown {
    return payload;
  }

  /** GETs a paged API collection and maps every row. */
  protected livePage<R>(
    path: string,
    query: PageQuery,
    mapper: (row: unknown) => R,
    extra: Record<string, string | number | boolean | null | undefined> = {},
  ): Observable<Page<R>> {
    const params = this.toHttpParams(query);
    for (const [key, value] of Object.entries(extra)) {
      if (value !== null && value !== undefined && value !== '') {
        params[key] = String(value);
      }
    }
    return this.http
      .get<Page<unknown>>(this.api(path), { params })
      .pipe(map((page) => ({ ...page, content: (page.content ?? []).map(mapper) })));
  }

  /** Aliases sent by the panel's filter chips → the API's parameter names. Override per repository. */
  protected paramAliases: Record<string, string> = {};

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
      params['sort'] = query.sort.active;
      params['direction'] = query.sort.direction;
    }
    if (query.dateRange?.from) {
      params['from'] = query.dateRange.from.slice(0, 10);
    }
    if (query.dateRange?.to) {
      params['to'] = query.dateRange.to.slice(0, 10);
    }
    // The advanced filter builder is applied server side only for simple equality criteria.
    for (const criterion of query.filters ?? []) {
      if (criterion.operator === 'eq' && criterion.value !== null && criterion.value !== undefined) {
        params[criterion.field] = String(criterion.value);
      }
    }
    for (const [key, value] of Object.entries(query.quick ?? {})) {
      if (value !== null && value !== undefined && value !== '' && value !== 'ALL') {
        params[this.paramAliases[key] ?? key] = Array.isArray(value) ? value.join(',') : String(value);
      }
    }
    return params;
  }

  /** Paged list. */
  list(query: PageQuery): Observable<Page<T>> {
    if (!environment.useMockData) {
      return this.livePage(this.livePath, query, (row) => this.fromApi(row)).pipe(
        tap((page) => this.remember(page.content)),
      );
    }
    return this.backend
      .respondWithPage(this.records, query, this.queryOptions)
      .pipe(map((page) => ({ ...page, content: deepClone(page.content) })));
  }

  /** Every record matching the query, unpaged — used by exports and charts. */
  all(): Observable<T[]> {
    if (!environment.useMockData) {
      // The API caps a page at 200 rows; that is plenty for pickers, charts and exports.
      return this.livePage(this.livePath, { page: 0, size: 200 }, (row) => this.fromApi(row)).pipe(
        map((page) => page.content),
        tap((rows) => this.remember(rows)),
      );
    }
    return this.backend.respond(() => deepClone(this.records));
  }

  getById(id: string): Observable<T> {
    if (!environment.useMockData) {
      return this.http.get<unknown>(`${this.baseUrl}/${id}`).pipe(map((row) => this.fromApi(row)));
    }
    const found = this.records.find((record) => record.id === id);
    return found
      ? this.backend.respond(() => deepClone(found))
      : this.backend.notFound<T>(this.resourcePath, id);
  }

  create(payload: P): Observable<T> {
    if (!environment.useMockData) {
      return this.http.post<unknown>(this.baseUrl, this.toApi(payload)).pipe(map((row) => this.fromApi(row)));
    }
    return this.backend.respond(() => {
      const created = this.buildFromPayload(payload);
      this.records = [created, ...this.records];
      return deepClone(created);
    });
  }

  update(id: string, payload: P): Observable<T> {
    if (!environment.useMockData) {
      return this.http
        .put<unknown>(`${this.baseUrl}/${id}`, this.toApi(payload))
        .pipe(map((row) => this.fromApi(row)));
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
      return this.livePatch(id, changes);
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
      return ids.length
        ? forkJoin(ids.map((id) => this.delete(id))).pipe(map(() => undefined as void))
        : of(undefined as void);
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
      return ids.length ? forkJoin(ids.map((id) => this.patch(id, changes))) : of([]);
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
