import { Injectable } from '@angular/core';

import { environment } from '@env/environment';
import type { LogLevel } from '@env/environment.model';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

/**
 * Thin logging façade.
 *
 * Keeping every `console` call behind this service means production builds stay
 * quiet, and shipping logs to an APM later is a single change here.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly threshold = LEVEL_WEIGHT[environment.logging.level];

  private enabled(level: LogLevel): boolean {
    return LEVEL_WEIGHT[level] >= this.threshold;
  }

  debug(message: string, ...context: unknown[]): void {
    if (this.enabled('debug')) {
      console.debug(`%c[debug] ${message}`, 'color:#64748b', ...context);
    }
  }

  info(message: string, ...context: unknown[]): void {
    if (this.enabled('info')) {
      console.info(`%c[info] ${message}`, 'color:#0284c7', ...context);
    }
  }

  warn(message: string, ...context: unknown[]): void {
    if (this.enabled('warn')) {
      console.warn(`[warn] ${message}`, ...context);
    }
  }

  error(message: string, ...context: unknown[]): void {
    if (this.enabled('error')) {
      console.error(`[error] ${message}`, ...context);
    }
    if (environment.logging.remote) {
      this.ship(message, context);
    }
  }

  /** Placeholder for the APM/Sentry transport. */
  private ship(message: string, context: unknown[]): void {
    void message;
    void context;
  }
}
