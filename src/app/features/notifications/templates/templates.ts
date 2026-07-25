import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { PERMISSIONS } from '@core/constants/permission.constants';
import { NOTIFICATION_CHANNEL_MAP, toOptions } from '@core/constants/status-maps.constants';
import { NotificationCategory } from '@core/enums';
import type { NotificationTemplate, Page, PageQuery, StatMetric } from '@core/models';
import type { TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { humanise } from '@core/utilities/format.util';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatCard } from '@shared/components/stat-card/stat-card';
import { NotificationRepository } from '../data/notification.repository';

/** Message template library for push, SMS, email, in-app and webhook. */
@Component({
  selector: 'll-templates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable, StatCard],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Notification Templates"
        eyebrow="Communications"
        subtitle="Reusable message bodies with merge variables, per channel and category."
        icon="description"
        [stats]="[{ label: 'Templates', value: total().toString(), icon: 'description' }]"
        [actions]="[
          { id: 'back', label: 'Notification centre', icon: 'inbox', variant: 'secondary' },
          { id: 'campaigns', label: 'Campaigns', icon: 'campaign', variant: 'primary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      @if (summary().length) {
        <section class="ll-grid ll-grid--auto ll-stagger" aria-label="Template statistics">
          @for (metric of summary(); track metric.id) {
            <ll-stat-card [metric]="metric" />
          }
        </section>
      }

      <ll-list-toolbar
        searchPlaceholder="Search templates by name, code or content…"
        [quickFilters]="quickFilters"
        [refreshing]="loading()"
        (searchChange)="onSearch($event)"
        (quickChange)="onQuickFilter($event)"
        (refresh)="refreshAll()"
        (export)="onExport($event)"
        (clear)="onClearFilters()" />

      <ll-data-table
        tableId="notification-templates"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [selectable]="false"
        emptyTitle="No templates"
        emptyMessage="Create a template to standardise outbound messaging."
        (sortChange)="onSort($event)"
        (pageChange)="onPage($event)"
        (rowAction)="onRowAction($event)"
        (retry)="reload()" />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class Templates extends ListPageBase<NotificationTemplate> {
  private readonly repository = inject(NotificationRepository);
  private readonly router = inject(Router);

  protected readonly entityLabel = 'Notification Templates';
  protected readonly summary = signal<StatMetric[]>([]);

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'channel', label: 'Channel', icon: 'hub', options: toOptions(NOTIFICATION_CHANNEL_MAP) },
    {
      key: 'category',
      label: 'Category',
      icon: 'category',
      options: Object.values(NotificationCategory).map((value) => ({ value, label: humanise(value) })),
    },
    {
      key: 'active',
      label: 'State',
      icon: 'flag',
      options: [
        { value: 'true', label: 'Active' },
        { value: 'false', label: 'Inactive' },
      ],
    },
  ];

  protected readonly columns: TableColumn<NotificationTemplate>[] = [
    {
      key: 'name',
      label: 'Template',
      sortable: true,
      sticky: 'start',
      minWidth: 230,
      locked: true,
      subLabel: (row) => row.code,
    },
    {
      key: 'channel',
      label: 'Channel',
      type: 'badge',
      sortable: true,
      badgeMap: NOTIFICATION_CHANNEL_MAP,
      minWidth: 140,
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      minWidth: 150,
      format: (value) => humanise(String(value)),
    },
    { key: 'subject', label: 'Subject', minWidth: 260 },
    {
      key: 'variables',
      label: 'Variables',
      type: 'chips',
      minWidth: 220,
    },
    { key: 'usageCount', label: 'Sent', type: 'number', sortable: true, minWidth: 120 },
    { key: 'lastUsedAt', label: 'Last used', type: 'relative', sortable: true, minWidth: 140 },
    { key: 'active', label: 'Active', type: 'boolean', sortable: true, align: 'center', minWidth: 100 },
  ];

  protected readonly rowActions: TableAction<NotificationTemplate>[] = [
    {
      id: 'toggle',
      label: 'Toggle active state',
      icon: 'power_settings_new',
      primary: true,
      tone: 'primary',
      permissions: [PERMISSIONS.notifications.templates],
    },
    { id: 'campaign', label: 'Use in a campaign', icon: 'campaign' },
  ];

  constructor() {
    super();
    this.initialise();
    this.loadSummary();
  }

  protected fetch(query: PageQuery): Observable<Page<NotificationTemplate>> {
    return this.repository.list(query);
  }

  private loadSummary(): void {
    this.repository.templateStatistics().subscribe((metrics) => this.summary.set(metrics));
  }

  protected refreshAll(): void {
    this.reload();
    this.loadSummary();
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/notifications']);
    } else if (action === 'campaigns') {
      void this.router.navigate(['/notifications/campaigns']);
    }
  }

  protected onRowAction(event: TableActionEvent<NotificationTemplate>): void {
    const { action, row } = event;

    if (action === 'toggle') {
      this.repository.setTemplateActive(row.id, !row.active).subscribe(() => {
        this.toast.success(row.active ? 'Template deactivated' : 'Template activated', row.name);
        this.refreshAll();
      });
    } else if (action === 'campaign') {
      void this.router.navigate(['/notifications/campaigns'], {
        queryParams: { template: row.id },
      });
    }
  }
}
