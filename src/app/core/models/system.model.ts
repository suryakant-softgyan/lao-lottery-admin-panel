import type {
  AuditAction,
  AuditCategory,
  CampaignStatus,
  HealthState,
  NotificationCategory,
  NotificationChannel,
  NotificationStatus,
  ReportPeriod,
  Severity,
} from '../enums';
import type { AuditableEntity } from './common.model';

export interface NotificationTemplate extends AuditableEntity {
  code: string;
  name: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  subject: string;
  body: string;
  bodyLo?: string;
  variables: string[];
  active: boolean;
  usageCount: number;
  lastUsedAt?: string;
}

export interface AudienceSegment extends AuditableEntity {
  code: string;
  name: string;
  description: string;
  criteria: string;
  memberCount: number;
  dynamic: boolean;
  lastRefreshedAt?: string;
}

export interface NotificationCampaign extends AuditableEntity {
  code: string;
  name: string;
  channels: NotificationChannel[];
  templateId: string;
  templateName: string;
  segmentId: string;
  segmentName: string;
  status: CampaignStatus;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  targetCount: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  failedCount: number;
  createdByName: string;
}

export interface NotificationMessage extends AuditableEntity {
  title: string;
  body: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  severity: Severity;
  status: NotificationStatus;
  recipientId?: string;
  recipientName?: string;
  recipientAddress?: string;
  read: boolean;
  readAt?: string;
  actionUrl?: string;
  actionLabel?: string;
  icon: string;
  sentAt?: string;
  failureReason?: string;
}

export interface AuditLog extends AuditableEntity {
  timestamp: string;
  category: AuditCategory;
  action: AuditAction | string;
  severity: Severity;
  module: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  actorAvatar: string;
  ipAddress: string;
  userAgent: string;
  location: string;
  description: string;
  /** Field-level before/after snapshot for change auditing. */
  changes?: AuditChange[];
  requestId?: string;
  durationMs?: number;
  statusCode?: number;
  success: boolean;
  tenantId: string;
}

export interface AuditChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface SystemHealthComponent {
  id: string;
  name: string;
  state: HealthState;
  latencyMs: number;
  uptimePercent: number;
  message: string;
  icon: string;
  lastCheckedAt: string;
  history: number[];
}

export interface SystemHealth {
  overall: HealthState;
  checkedAt: string;
  components: SystemHealthComponent[];
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  activeSessions: number;
  requestsPerMinute: number;
  errorRatePercent: number;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  severity: Severity;
  icon: string;
  link?: string;
  linkLabel?: string;
  startsAt: string;
  endsAt: string;
  dismissible: boolean;
  pinned: boolean;
}

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  module: string;
  /** Roles the flag is limited to; empty means everybody. */
  roles: string[];
  rolloutPercent: number;
  updatedAt: string;
  updatedBy: string;
}

export interface ReportRequest {
  reportType: string;
  period: ReportPeriod;
  from?: string;
  to?: string;
  groupBy?: string;
  lotteryId?: string;
  province?: string;
  agentId?: string;
}

export interface ReportSeries {
  label: string;
  data: number[];
  colour?: string;
}

export interface ReportResult {
  reportType: string;
  title: string;
  generatedAt: string;
  period: string;
  labels: string[];
  series: ReportSeries[];
  rows: Record<string, string | number>[];
  columns: { key: string; label: string; type: 'text' | 'number' | 'currency' | 'percent' | 'date' }[];
  totals: Record<string, number>;
}

export interface Tenant {
  id: string;
  code: string;
  name: string;
  nameLo: string;
  logoUrl: string;
  active: boolean;
  country: string;
  currency: string;
  timezone: string;
  languages: string[];
  domain: string;
}
