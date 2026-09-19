/** Cross-cutting platform enums: notifications, audit, health, UI state. */

export enum NotificationChannel {
  Push = 'PUSH',
  Sms = 'SMS',
  Email = 'EMAIL',
  InApp = 'IN_APP',
  Webhook = 'WEBHOOK',
}

export enum NotificationCategory {
  System = 'SYSTEM',
  Draw = 'DRAW',
  Transaction = 'TRANSACTION',
  Security = 'SECURITY',
  Marketing = 'MARKETING',
  Compliance = 'COMPLIANCE',
  Approval = 'APPROVAL',
}

export enum NotificationStatus {
  Draft = 'DRAFT',
  Scheduled = 'SCHEDULED',
  Sending = 'SENDING',
  Sent = 'SENT',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
}

export enum CampaignStatus {
  Draft = 'DRAFT',
  Scheduled = 'SCHEDULED',
  Running = 'RUNNING',
  Paused = 'PAUSED',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
}

export enum AuditCategory {
  Login = 'LOGIN',
  Activity = 'ACTIVITY',
  Transaction = 'TRANSACTION',
  Api = 'API',
  Security = 'SECURITY',
  Error = 'ERROR',
}

export enum AuditAction {
  Create = 'CREATE',
  Read = 'READ',
  Update = 'UPDATE',
  Delete = 'DELETE',
  Approve = 'APPROVE',
  Reject = 'REJECT',
  Login = 'LOGIN',
  Logout = 'LOGOUT',
  Export = 'EXPORT',
  Publish = 'PUBLISH',
  Rollback = 'ROLLBACK',
  Freeze = 'FREEZE',
  Unfreeze = 'UNFREEZE',
  Suspend = 'SUSPEND',
  Block = 'BLOCK',
}

export enum Severity {
  Info = 'INFO',
  Low = 'LOW',
  Medium = 'MEDIUM',
  High = 'HIGH',
  Critical = 'CRITICAL',
}

export enum HealthState {
  Healthy = 'HEALTHY',
  Degraded = 'DEGRADED',
  Down = 'DOWN',
  Unknown = 'UNKNOWN',
}

export enum ReportPeriod {
  Today = 'TODAY',
  Yesterday = 'YESTERDAY',
  Daily = 'DAILY',
  Weekly = 'WEEKLY',
  Monthly = 'MONTHLY',
  Quarterly = 'QUARTERLY',
  Yearly = 'YEARLY',
  Custom = 'CUSTOM',
}

export enum ExportFormat {
  Csv = 'CSV',
  Excel = 'EXCEL',
  Pdf = 'PDF',
  Json = 'JSON',
  Print = 'PRINT',
}

export enum SortDirection {
  Asc = 'asc',
  Desc = 'desc',
}

export enum LoadState {
  Idle = 'IDLE',
  Loading = 'LOADING',
  Loaded = 'LOADED',
  Empty = 'EMPTY',
  Error = 'ERROR',
}

export enum TrendDirection {
  Up = 'UP',
  Down = 'DOWN',
  Flat = 'FLAT',
}
