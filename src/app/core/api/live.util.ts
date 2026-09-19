import type { TimelineEvent } from '../models/common.model';

/** Shape of `/admin/audit/*` rows. */
export interface ApiAuditEntry {
  id: string;
  timestamp: string;
  category: string;
  action: string;
  severity: string;
  module: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  actorName?: string;
  description: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  traceId?: string;
  success: boolean;
}

const ACTION_ICONS: Record<string, string> = {
  CREATE: 'add_circle',
  UPDATE: 'edit',
  DELETE: 'delete',
  APPROVE: 'verified',
  REJECT: 'cancel',
  LOGIN: 'login',
  LOGOUT: 'logout',
  EXPORT: 'download',
  PUBLISH: 'campaign',
  ROLLBACK: 'undo',
  FREEZE: 'ac_unit',
  UNFREEZE: 'local_fire_department',
  SUSPEND: 'pause_circle',
  BLOCK: 'block',
  EXECUTE: 'play_circle',
  CANCEL: 'cancel',
  VERIFY: 'fact_check',
};

function tone(entry: ApiAuditEntry): TimelineEvent['tone'] {
  if (!entry.success) {
    return 'danger';
  }
  switch (entry.action) {
    case 'CREATE':
    case 'APPROVE':
    case 'PUBLISH':
    case 'VERIFY':
    case 'UNFREEZE':
      return 'success';
    case 'DELETE':
    case 'BLOCK':
    case 'ROLLBACK':
    case 'REJECT':
      return 'danger';
    case 'SUSPEND':
    case 'FREEZE':
    case 'CANCEL':
      return 'warning';
    case 'UPDATE':
    case 'EXECUTE':
      return 'primary';
    default:
      return 'neutral';
  }
}

/** Audit trail row → the activity-timeline component's event. */
export function auditToTimeline(entry: ApiAuditEntry): TimelineEvent {
  const meta: Record<string, string> = {};
  if (entry.ipAddress) {
    meta['IP'] = entry.ipAddress;
  }
  if (entry.details) {
    meta['Details'] = entry.details;
  }
  return {
    id: entry.id,
    title: entry.description,
    description: `${entry.action} · ${entry.module}`,
    actor: entry.actorName ?? 'System',
    timestamp: entry.timestamp,
    icon: ACTION_ICONS[entry.action] ?? 'visibility',
    tone: tone(entry),
    meta,
  };
}

/** `undefined`-safe number. */
export function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Splits a user agent into the coarse browser / OS labels shown in history tables. */
export function parseUserAgent(agent: string | undefined): { browser: string; os: string } {
  const ua = agent ?? '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : /okhttp|Dart/i.test(ua)
            ? 'Mobile app'
            : 'Unknown';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iOS/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Unknown';
  return { browser, os };
}
