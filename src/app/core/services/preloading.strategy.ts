import { Injectable } from '@angular/core';
import type { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { mergeMap } from 'rxjs';

/**
 * Selective preloading.
 *
 * Routes opt in with `data: { preload: true }` and may declare a delay so the
 * initial view finishes rendering first. Everything else stays lazy, which
 * keeps the first paint fast on the low-bandwidth connections common at
 * provincial offices.
 *
 * A route can also set `preload: 'idle'` to wait for the browser to go idle.
 */
@Injectable({ providedIn: 'root' })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  /** Routes already scheduled, exposed for diagnostics. */
  readonly preloaded: string[] = [];

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const mode = route.data?.['preload'] as boolean | 'idle' | undefined;
    if (!mode) {
      return of(null);
    }

    this.preloaded.push(route.path ?? '');

    if (mode === 'idle') {
      return new Observable((subscriber) => {
        const schedule =
          typeof requestIdleCallback === 'function'
            ? requestIdleCallback
            : (callback: () => void): number => setTimeout(callback, 2000) as unknown as number;
        schedule(() => {
          load().subscribe({
            next: (value) => subscriber.next(value),
            error: (error: unknown) => subscriber.error(error),
            complete: () => subscriber.complete(),
          });
        });
      });
    }

    const delayMs = (route.data?.['preloadDelay'] as number | undefined) ?? 1200;
    return timer(delayMs).pipe(mergeMap(() => load()));
  }
}
