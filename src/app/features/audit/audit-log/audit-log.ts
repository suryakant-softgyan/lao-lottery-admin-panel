import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { Observable } from 'rxjs';

import { SEVERITY_MAP, toOptions } from '@core/constants/status-maps.constants';
import { AuditAction, AuditCategory } from '@core/enums';
import type { AuditLog, Page, PageQuery, StatMetric } from '@core/models';
import type { TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { humanise } from '@core/utilities/format.util';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatCard } from '@shared/components/stat-card/stat-card';
import { InfoList, type InfoItem } from '@shared/components/info-list/info-list';
import { AuditRepository } from '../data/audit.repository';

interface AuditCopy {
  title: string;
  subtitle: string;
  icon: string;
}

/**
 * Audit trail view.
 *
 * Serves all five audit routes. Expandable rows reveal the field-level
 * before/after diff, which is what makes the trail useful in a dispute rather
 * than merely present for compliance.
 */
@Component({
  selector: 'll-audit-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable, StatCard, InfoList],
  templateUrl: './audit-log.html',
  styleUrl: './audit-log.scss',
})
export class AuditLogPage extends ListPageBase<AuditLog> {
  private readonly repository = inject(AuditRepository);
  private readonly route = inject(ActivatedRoute);

  private readonly categories = (this.route.snapshot.data['categories'] as AuditCategory[] | undefined) ?? [];

  protected readonly copy: AuditCopy = (this.route.snapshot.data['copy'] as AuditCopy | undefined) ?? {
    title: 'Audit Trail',
    subtitle: 'Every recorded action in the platform.',
    icon: 'gavel',
  };

  protected readonly entityLabel = this.copy.title;
  protected readonly summary = signal<StatMetric[]>([]);

  /** The row whose detail panel is open. */
  protected readonly expanded = signal<AuditLog | null>(null);

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'severity', label: 'Severity', icon: 'priority_high', options: toOptions(SEVERITY_MAP) },
    {
      key: 'action',
      label: 'Action',
      icon: 'bolt',
      options: Object.values(AuditAction).map((value) => ({ value, label: humanise(value) })),
    },
    {
      key: 'success',
      label: 'Outcome',
      icon: 'flag',
      options: [
        { value: 'true', label: 'Succeeded' },
        { value: 'false', label: 'Failed' },
      ],
    },
  ];

  protected readonly columns: TableColumn<AuditLog>[] = [
    {
      key: 'timestamp',
      label: 'When',
      type: 'datetime',
      sortable: true,
      sticky: 'start',
      minWidth: 180,
      locked: true,
      subLabel: (row) => row.requestId ?? '',
    },
    {
      key: 'actorName',
      label: 'Actor',
      type: 'avatar',
      sortable: true,
      minWidth: 220,
      avatarUrl: (row) => row.actorAvatar,
      subLabel: (row) => humanise(row.actorRole),
    },
    {
      key: 'action',
      label: 'Action',
      sortable: true,
      minWidth: 140,
      format: (value) => humanise(String(value)),
    },
    { key: 'module', label: 'Module', sortable: true, minWidth: 140 },
    { key: 'entityType', label: 'Entity', sortable: true, minWidth: 140 },
    { key: 'description', label: 'Description', minWidth: 320 },
    {
      key: 'severity',
      label: 'Severity',
      type: 'badge',
      sortable: true,
      badgeMap: SEVERITY_MAP,
      minWidth: 140,
    },
    {
      key: 'success',
      label: 'Outcome',
      type: 'boolean',
      sortable: true,
      align: 'center',
      minWidth: 110,
    },
    { key: 'statusCode', label: 'Status', type: 'number', sortable: true, minWidth: 100 },
    {
      key: 'durationMs',
      label: 'Duration',
      type: 'number',
      sortable: true,
      minWidth: 120,
      format: (value) => `${value} ms`,
    },
    { key: 'ipAddress', label: 'IP address', minWidth: 150, cellClass: () => 'll-mono' },
    { key: 'location', label: 'Location', minWidth: 200 },
    { key: 'userAgent', label: 'Device', minWidth: 240, hidden: true },
  ];

  protected readonly rowActions: TableAction<AuditLog>[] = [
    { id: 'inspect', label: 'Inspect entry', icon: 'travel_explore', primary: true, tone: 'primary' },
  ];

  /** Detail panel content for the selected entry. */
  protected readonly detailItems = computed<InfoItem[]>(() => {
    const log = this.expanded();
    if (!log) {
      return [];
    }
    return [
      {
        label: 'Timestamp',
        value: log.timestamp.replace('T', ' ').slice(0, 19),
        icon: 'schedule',
        mono: true,
      },
      { label: 'Category', value: humanise(log.category), icon: 'category' },
      { label: 'Action', value: humanise(String(log.action)), icon: 'bolt' },
      { label: 'Severity', value: log.severity, icon: 'priority_high', badgeMap: SEVERITY_MAP },
      { label: 'Module', value: log.module, icon: 'widgets' },
      {
        label: 'Entity',
        value: `${log.entityType ?? '—'} · ${log.entityId ?? '—'}`,
        icon: 'inventory_2',
        mono: true,
      },
      { label: 'Actor', value: `${log.actorName} (${humanise(log.actorRole)})`, icon: 'person' },
      { label: 'IP address', value: log.ipAddress, icon: 'lan', mono: true },
      { label: 'Location', value: log.location, icon: 'location_on' },
      { label: 'Device', value: log.userAgent, icon: 'devices', wide: true },
      { label: 'Request id', value: log.requestId, icon: 'fingerprint', mono: true },
      { label: 'Status code', value: log.statusCode, icon: 'code' },
      { label: 'Duration', value: `${log.durationMs} ms`, icon: 'timer' },
      { label: 'Description', value: log.description, icon: 'notes', wide: true },
    ];
  });

  constructor() {
    super();
    this.patchQuery({ sort: { active: 'timestamp', direction: 'desc' as never } });
    this.initialise();
    this.loadSummary();
  }

  protected fetch(query: PageQuery): Observable<Page<AuditLog>> {
    return this.repository.byCategory(query, this.categories);
  }

  private loadSummary(): void {
    this.repository.statistics(this.categories).subscribe((metrics) => this.summary.set(metrics));
  }

  protected refreshAll(): void {
    this.reload();
    this.loadSummary();
  }

  protected onRowAction(event: TableActionEvent<AuditLog>): void {
    if (event.action === 'inspect') {
      this.expanded.set(event.row);
    }
  }

  protected onRowClick(row: AuditLog): void {
    this.expanded.set(row);
  }

  protected closeDetail(): void {
    this.expanded.set(null);
  }

  protected humanise(value: string): string {
    return humanise(value);
  }
}
