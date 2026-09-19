import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { AuditCategory, Severity } from '@core/enums';
import { mockDataset } from '@core/mock/dataset';
import type { AuditLog, Page, PageQuery, StatMetric } from '@core/models';
import { num, type ApiAuditEntry } from '@core/api/live.util';
import { PLACEHOLDER } from '@core/constants/app.constants';
import { BaseRepository } from '@core/services/base-repository';
import { applyQuery } from '@core/utilities/query.util';

/**
 * Audit trail repository.
 *
 * One dataset serves every audit view; the category filter is what separates
 * login, activity, transaction, API and security logs.
 */
@Injectable({ providedIn: 'root' })
export class AuditRepository extends BaseRepository<AuditLog> {
  protected readonly resourcePath = 'audit-logs';

  protected override queryOptions = {
    searchFields: [
      'actorName',
      'description',
      'module',
      'entityLabel',
      'entityId',
      'ipAddress',
      'requestId',
      'action',
    ],
    dateField: 'timestamp',
  };

  protected seed(): AuditLog[] {
    return mockDataset.auditLogs;
  }

  /** Paged logs narrowed to one or more categories. */
  byCategory(query: PageQuery, categories: readonly AuditCategory[]): Observable<Page<AuditLog>> {
    if (this.live) {
      return this.livePage(this.livePath, query, (row) => this.fromApi(row), { category: categories.join(",") });
    }
    const rows = categories.length
      ? this.records.filter((log) => categories.includes(log.category))
      : this.records;
    return this.backend.respond(() => applyQuery(rows, query, this.queryOptions));
  }

  statistics(categories: readonly AuditCategory[]): Observable<StatMetric[]> {
    if (this.live) {
      return this.liveStatistics(categories);
    }
    return this.backend.respond(() => {
      const rows = categories.length
        ? this.records.filter((log) => categories.includes(log.category))
        : this.records;

      const failures = rows.filter((log) => !log.success);
      const critical = rows.filter(
        (log) => log.severity === Severity.Critical || log.severity === Severity.High,
      );
      const last24h = rows.filter((log) => Date.parse(log.timestamp) >= Date.now() - 86_400_000);
      const actors = new Set(rows.map((log) => log.actorId));

      return [
        { id: 'total', label: 'Log entries', value: rows.length, icon: 'gavel', tone: 'primary' },
        { id: 'today', label: 'Last 24 hours', value: last24h.length, icon: 'schedule', tone: 'info' },
        { id: 'actors', label: 'Distinct actors', value: actors.size, icon: 'group', tone: 'neutral' },
        { id: 'failures', label: 'Failed actions', value: failures.length, icon: 'error', tone: 'danger' },
        {
          id: 'critical',
          label: 'High severity',
          value: critical.length,
          icon: 'crisis_alert',
          tone: 'warning',
        },
      ];
    });
  }
  // =====================================================================================
  // Live API implementation
  // =====================================================================================

  protected override get livePath(): string {
    return 'admin/audit/logs';
  }

  protected override fromApi(record: unknown): AuditLog {
    const api = record as ApiAuditEntry;
    const status = /→ (\d{3})$/.exec(api.description ?? '')?.[1];
    const duration = /durationMs=(\d+)/.exec(api.details ?? '')?.[1];
    return {
      id: api.id,
      timestamp: api.timestamp,
      category: api.category as AuditLog['category'],
      action: api.action,
      severity: api.severity as AuditLog['severity'],
      module: api.module,
      entityType: api.entityType,
      entityId: api.entityId,
      entityLabel: api.entityType ? `${api.entityType} ${api.entityId?.slice(0, 8) ?? ''}`.trim() : undefined,
      actorId: api.actorId ?? 'system',
      actorName: api.actorName ?? 'System',
      actorRole: '',
      actorAvatar: PLACEHOLDER.avatar(api.actorName ?? 'System'),
      ipAddress: api.ipAddress ?? '',
      userAgent: api.userAgent ?? '',
      location: '—',
      description: api.details ? `${api.description} — ${api.details}` : api.description,
      requestId: api.traceId,
      durationMs: duration ? Number(duration) : undefined,
      statusCode: status ? Number(status) : undefined,
      success: api.success,
      tenantId: '',
      createdAt: api.timestamp,
    };
  }

  private liveStatistics(categories: readonly AuditCategory[]): Observable<StatMetric[]> {
    return this.http
      .get<Record<string, number>>(this.api('admin/stats/audit'), { params: { category: categories.join(',') } })
      .pipe(
        map((totals) => [
          { id: 'total', label: 'Log entries', value: num(totals['total']), icon: 'gavel', tone: 'primary' as const },
          { id: 'today', label: 'Last 24 hours', value: num(totals['last24h']), icon: 'schedule', tone: 'info' as const },
          { id: 'actors', label: 'Distinct actors', value: num(totals['actors']), icon: 'group', tone: 'neutral' as const },
          { id: 'failures', label: 'Failed actions', value: num(totals['failures']), icon: 'error', tone: 'danger' as const },
          { id: 'critical', label: 'High severity', value: num(totals['highSeverity']), icon: 'crisis_alert', tone: 'warning' as const },
        ]),
      );
  }
}
