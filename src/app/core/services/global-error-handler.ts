import { ErrorHandler, Injectable, inject } from '@angular/core';

import type { AppError } from '../models/common.model';
import { LoggerService } from './logger.service';
import { ToastService } from './toast.service';

/** Chunk-load failures after a deployment; a reload picks up the new bundle. */
const CHUNK_LOAD_PATTERN = /ChunkLoadError|Loading chunk [\d]+ failed|dynamically imported module/i;

/**
 * Last-resort error handler.
 *
 * HTTP failures are already normalised by the error interceptor, so this only
 * catches genuinely unexpected runtime faults — and turns the one recoverable
 * class of them (a stale lazy chunk after a release) into an actionable prompt
 * rather than a dead screen.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly logger = inject(LoggerService);
  private readonly toast = inject(ToastService);

  handleError(error: unknown): void {
    // Already surfaced by the interceptor — do not double-report.
    if (this.isAppError(error)) {
      this.logger.error('Handled application error', error);
      return;
    }

    const message = error instanceof Error ? error.message : String(error);

    if (CHUNK_LOAD_PATTERN.test(message)) {
      this.toast.error('A new version is available', 'Reload the page to continue with the latest release.', {
        label: 'Reload',
        run: () => window.location.reload(),
      });
      this.logger.warn('Stale lazy chunk detected', error);
      return;
    }

    this.logger.error('Unhandled error', error);
    this.toast.error(
      'Unexpected error',
      'Something went wrong. If it keeps happening, please contact support.',
    );
  }

  private isAppError(error: unknown): error is AppError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      'code' in error &&
      'retriable' in error
    );
  }
}
