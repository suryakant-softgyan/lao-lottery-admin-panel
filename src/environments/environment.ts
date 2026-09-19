import type { AppEnvironment } from './environment.model';

/**
 * Development environment.
 *
 * `useMockData` is the single switch that decides whether the repository layer
 * resolves against the in-memory mock backend or a real REST API. Flip it to
 * `false` (and point `apiBaseUrl` at the gateway) to go live — no component or
 * service code has to change.
 */
export const environment: AppEnvironment = {
  production: false,
  name: 'development',
  useMockData: true,
  apiBaseUrl: '/api/v1',
  wsBaseUrl: 'ws://localhost:8080/ws',
  appVersion: '1.0.0',
  buildNumber: 'dev',
  defaultLanguage: 'en',
  supportedLanguages: ['en', 'lo'],
  defaultTenantId: 'lao-national-lottery',
  multiTenant: true,
  session: {
    /** Absolute session lifetime in seconds. */
    sessionTimeoutSeconds: 30 * 60,
    /** Inactivity before the idle warning appears, in seconds. */
    idleTimeoutSeconds: 15 * 60,
    /** Countdown shown in the idle dialog, in seconds. */
    idleGraceSeconds: 60,
    /** Refresh the access token this many seconds before it expires. */
    refreshSkewSeconds: 60,
  },
  mock: {
    /** Simulated network latency range, in milliseconds. */
    minLatencyMs: 180,
    maxLatencyMs: 650,
    /** Probability (0–1) that a mock request fails, to exercise error states. */
    errorRate: 0,
  },
  logging: {
    level: 'debug',
    remote: false,
  },
};
