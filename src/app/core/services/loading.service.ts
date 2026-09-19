import { Injectable, computed, signal } from '@angular/core';

/**
 * Reference-counted global loading indicator.
 *
 * The HTTP interceptor increments on request and decrements on completion, and
 * the shell renders a top progress bar whenever the count is above zero.
 * Long-running background jobs can register a named task so the UI can label
 * what is happening.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pending = signal(0);
  private readonly tasks = signal<ReadonlyMap<string, string>>(new Map());

  /** True while at least one request or named task is in flight. */
  readonly loading = computed(() => this.pending() > 0 || this.tasks().size > 0);

  /** Human-readable label for the current work, when one was supplied. */
  readonly activeLabel = computed(() => {
    const [first] = [...this.tasks().values()];
    return first ?? '';
  });

  readonly pendingCount = computed(() => this.pending() + this.tasks().size);

  start(): void {
    this.pending.update((count) => count + 1);
  }

  stop(): void {
    this.pending.update((count) => Math.max(0, count - 1));
  }

  /** Registers a labelled task; returns a disposer. */
  track(id: string, label: string): () => void {
    this.tasks.update((current) => new Map(current).set(id, label));
    return () => this.release(id);
  }

  release(id: string): void {
    this.tasks.update((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }

  /** Hard reset — used on navigation errors so the bar can never stick. */
  reset(): void {
    this.pending.set(0);
    this.tasks.set(new Map());
  }
}
