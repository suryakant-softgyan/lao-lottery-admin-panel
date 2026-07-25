import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, delay, of, throwError } from 'rxjs';

import { environment } from '@env/environment';
import type { Page, PageQuery } from '../models/common.model';
import { applyQuery, type QueryOptions } from '../utilities/query.util';
import { LoggerService } from './logger.service';

/**
 * Simulates the network boundary for the mock data layer.
 *
 * Responsibilities:
 *  - random latency inside the configured band, so loading states are real;
 *  - configurable failure injection, so error/retry states can be exercised;
 *  - the same {@link Page} envelope the real gateway returns.
 *
 * Repositories depend on this rather than on `of(...)` directly, which is what
 * makes the mock → REST swap a one-line change per repository.
 */
@Injectable({ providedIn: 'root' })
export class MockBackendService {
  private readonly logger = inject(LoggerService);

  /** Latency band and failure rate come from the environment file. */
  private get latency(): number {
    const { minLatencyMs, maxLatencyMs } = environment.mock;
    return Math.round(minLatencyMs + Math.random() * Math.max(0, maxLatencyMs - minLatencyMs));
  }

  /** Wraps any value in a delayed observable, optionally failing. */
  respond<T>(
    value: T | (() => T),
    options: { latencyMs?: number; failureRate?: number } = {},
  ): Observable<T> {
    const failureRate = options.failureRate ?? environment.mock.errorRate;
    const latencyMs = options.latencyMs ?? this.latency;

    if (failureRate > 0 && Math.random() < failureRate) {
      return this.fail(latencyMs);
    }

    // Lazily evaluated so expensive generators only run when actually needed.
    const resolved = typeof value === 'function' ? (value as () => T)() : value;
    return of(resolved).pipe(delay(latencyMs));
  }

  /** Runs the shared query engine and responds with a paged envelope. */
  respondWithPage<T>(items: readonly T[], query: PageQuery, options: QueryOptions = {}): Observable<Page<T>> {
    return this.respond(() => applyQuery(items, query, options));
  }

  /** Emits a realistic {@link HttpErrorResponse} after the usual latency. */
  fail<T>(latencyMs = this.latency, status = 500, message = 'Simulated backend failure'): Observable<T> {
    this.logger.debug(`MockBackend: injecting a ${status} failure`);
    return throwError(
      () =>
        new HttpErrorResponse({
          status,
          statusText: message,
          url: 'mock://lao-lottery',
          error: { code: 'MOCK_FAILURE', message },
        }),
    ).pipe(delay(latencyMs)) as Observable<T>;
  }

  /** Emits a 404 for a missing entity lookup. */
  notFound<T>(entity: string, id: string): Observable<T> {
    return this.fail<T>(this.latency, 404, `${entity} ${id} was not found`);
  }
}
