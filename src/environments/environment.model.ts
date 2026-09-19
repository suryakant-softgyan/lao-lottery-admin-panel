/** Log verbosity understood by the {@link LoggerService}. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface SessionEnvironment {
  readonly sessionTimeoutSeconds: number;
  readonly idleTimeoutSeconds: number;
  readonly idleGraceSeconds: number;
  readonly refreshSkewSeconds: number;
}

export interface MockEnvironment {
  readonly minLatencyMs: number;
  readonly maxLatencyMs: number;
  readonly errorRate: number;
}

export interface LoggingEnvironment {
  readonly level: LogLevel;
  readonly remote: boolean;
}

/**
 * Strongly-typed shape shared by every environment file so that adding a key in
 * one place forces every environment to declare it.
 */
export interface AppEnvironment {
  readonly production: boolean;
  readonly name: string;
  readonly useMockData: boolean;
  readonly apiBaseUrl: string;
  readonly wsBaseUrl: string;
  readonly appVersion: string;
  readonly buildNumber: string;
  readonly defaultLanguage: string;
  readonly supportedLanguages: readonly string[];
  readonly defaultTenantId: string;
  readonly multiTenant: boolean;
  readonly session: SessionEnvironment;
  readonly mock: MockEnvironment;
  readonly logging: LoggingEnvironment;
}
