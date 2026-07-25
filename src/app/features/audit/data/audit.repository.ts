import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { AuditCategory, Severity } from '@core/enums';
import { mockDataset } from '@core/mock/dataset';
import type { AuditLog, Page, PageQuery, StatMetric } from '@core/models';
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
    const rows = categories.length
      ? this.records.filter((log) => categories.includes(log.category))
      : this.records;
    return this.backend.respond(() => applyQuery(rows, query, this.queryOptions));
  }

  statistics(categories: readonly AuditCategory[]): Observable<StatMetric[]> {
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
}
