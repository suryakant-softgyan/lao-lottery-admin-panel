import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  name: 'production',
  useMockData: false,
  apiBaseUrl: '/api/v1',
  wsBaseUrl: 'wss://api.laolottery.la/ws',
  appVersion: '1.0.0',
  buildNumber: 'release',
  defaultLanguage: 'en',
  supportedLanguages: ['en', 'lo'],
  defaultTenantId: 'LAO_NATIONAL',
  multiTenant: true,
  session: {
    sessionTimeoutSeconds: 20 * 60,
    idleTimeoutSeconds: 10 * 60,
    idleGraceSeconds: 60,
    refreshSkewSeconds: 60,
  },
  mock: {
    minLatencyMs: 120,
    maxLatencyMs: 400,
    errorRate: 0,
  },
  logging: {
    level: 'error',
    remote: true,
  },
};
