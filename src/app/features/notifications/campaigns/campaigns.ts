import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { PERMISSIONS } from '@core/constants/permission.constants';
import { CAMPAIGN_STATUS_MAP, toOptions } from '@core/constants/status-maps.constants';
import { CampaignStatus } from '@core/enums';
import type { NotificationCampaign, Page, PageQuery, StatMetric } from '@core/models';
import type { TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { ConfirmService } from '@core/services/confirm.service';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatCard } from '@shared/components/stat-card/stat-card';
import { NotificationRepository } from '../data/notification.repository';

/** Multi-channel campaign scheduling with delivery performance. */
@Component({
  selector: 'll-campaigns',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable, StatCard],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Campaigns"
        eyebrow="Communications"
        subtitle="Segmented push, SMS and email campaigns with live delivery and open rates."
        icon="campaign"
        [stats]="[{ label: 'Campaigns', value: total().toString(), icon: 'campaign' }]"
        [actions]="[
          { id: 'templates', label: 'Templates', icon: 'description', variant: 'secondary' },
          { id: 'segments', label: 'Segments', icon: 'pie_chart', variant: 'primary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      @if (summary().length) {
        <section class="ll-grid ll-grid--auto ll-stagger" aria-label="Campaign statistics">
          @for (metric of summary(); track metric.id) {
            <ll-stat-card [metric]="metric" />
          }
        </section>
      }

      <ll-list-toolbar
        searchPlaceholder="Search campaigns by name, template or segment…"
        [quickFilters]="quickFilters"
        [showDateRange]="true"
        [refreshing]="loading()"
        (searchChange)="onSearch($event)"
        (quickChange)="onQuickFilter($event)"
        (rangeChange)="onDateRange($event)"
        (refresh)="refreshAll()"
        (export)="onExport($event)"
        (clear)="onClearFilters()" />

      <ll-data-table
        tableId="campaigns"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [selectable]="false"
        emptyTitle="No campaigns"
        emptyMessage="Create a campaign to reach a customer segment across channels."
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
export class Campaigns extends ListPageBase<NotificationCampaign> {
  private readonly repository = inject(NotificationRepository);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  protected readonly entityLabel = 'Campaigns';
  protected readonly summary = signal<StatMetric[]>([]);

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'status', label: 'Status', icon: 'flag', options: toOptions(CAMPAIGN_STATUS_MAP) },
  ];

  protected readonly columns: TableColumn<NotificationCampaign>[] = [
    {
      key: 'name',
      label: 'Campaign',
      sortable: true,
      sticky: 'start',
      minWidth: 250,
      locked: true,
      subLabel: (row) => row.code,
    },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: CAMPAIGN_STATUS_MAP,
      minWidth: 150,
    },
    { key: 'channels', label: 'Channels', type: 'chips', minWidth: 200 },
    { key: 'templateName', label: 'Template', sortable: true, minWidth: 200 },
    { key: 'segmentName', label: 'Segment', sortable: true, minWidth: 200 },
    { key: 'targetCount', label: 'Target', type: 'number', sortable: true, minWidth: 120 },
    { key: 'sentCount', label: 'Sent', type: 'number', sortable: true, minWidth: 120 },
    { key: 'deliveredCount', label: 'Delivered', type: 'number', sortable: true, minWidth: 130 },
    { key: 'openedCount', label: 'Opened', type: 'number', sortable: true, minWidth: 120 },
    { key: 'failedCount', label: 'Failed', type: 'number', sortable: true, minWidth: 110 },
    {
      key: 'deliveryRate',
      label: 'Delivery rate',
      type: 'progress',
      sortable: true,
      minWidth: 170,
      value: (row) => (row.sentCount === 0 ? 0 : (row.deliveredCount / row.sentCount) * 100),
      format: (value) => `${Number(value).toFixed(1)}%`,
    },
    { key: 'scheduledAt', label: 'Scheduled', type: 'datetime', sortable: true, minWidth: 175 },
    { key: 'createdByName', label: 'Created by', minWidth: 180 },
  ];

  protected readonly rowActions: TableAction<NotificationCampaign>[] = [
    {
      id: 'start',
      label: 'Start campaign',
      icon: 'play_circle',
      tone: 'success',
      primary: true,
      permissions: [PERMISSIONS.notifications.send],
      visible: (row) =>
        row.status === CampaignStatus.Scheduled ||
        row.status === CampaignStatus.Paused ||
        row.status === CampaignStatus.Draft,
    },
    {
      id: 'pause',
      label: 'Pause campaign',
      icon: 'pause_circle',
      tone: 'warning',
      permissions: [PERMISSIONS.notifications.send],
      visible: (row) => row.status === CampaignStatus.Running,
    },
    {
      id: 'complete',
      label: 'Mark completed',
      icon: 'task_alt',
      tone: 'success',
      permissions: [PERMISSIONS.notifications.send],
      visible: (row) => row.status === CampaignStatus.Running || row.status === CampaignStatus.Paused,
    },
    {
      id: 'cancel',
      label: 'Cancel campaign',
      icon: 'cancel',
      tone: 'danger',
      permissions: [PERMISSIONS.notifications.send],
      visible: (row) => row.status !== CampaignStatus.Completed && row.status !== CampaignStatus.Cancelled,
      divider: true,
    },
  ];

  constructor() {
    super();
    this.patchQuery({ sort: { active: 'scheduledAt', direction: 'desc' as never } });
    this.initialise();
    this.loadSummary();
  }

  protected fetch(query: PageQuery): Observable<Page<NotificationCampaign>> {
    return this.repository.campaigns(query);
  }

  private loadSummary(): void {
    this.repository.campaignStatistics().subscribe((metrics) => this.summary.set(metrics));
  }

  protected refreshAll(): void {
    this.reload();
    this.loadSummary();
  }

  protected onHeaderAction(action: string): void {
    if (action === 'templates') {
      void this.router.navigate(['/notifications/templates']);
    } else if (action === 'segments') {
      void this.router.navigate(['/notifications/segments']);
    }
  }

  protected onRowAction(event: TableActionEvent<NotificationCampaign>): void {
    const { action, row } = event;

    const apply = (status: CampaignStatus, message: string): void => {
      this.repository.setCampaignStatus(row.id, status).subscribe(() => {
        this.toast.success(message, row.name);
        this.refreshAll();
      });
    };

    switch (action) {
      case 'start':
        // Starting a campaign sends real messages, so confirm the reach first.
        this.confirm
          .ask({
            title: 'Start this campaign?',
            message: `Messages will be sent to approximately ${row.targetCount.toLocaleString()} recipients in "${row.segmentName}".`,
            detail: `Channels: ${row.channels.join(', ')} · template "${row.templateName}".`,
            confirmLabel: 'Start sending',
            tone: 'primary',
            icon: 'send',
          })
          .subscribe((confirmed) => {
            if (confirmed) {
              apply(CampaignStatus.Running, 'Campaign started');
            }
          });
        break;
      case 'pause':
        apply(CampaignStatus.Paused, 'Campaign paused');
        break;
      case 'complete':
        apply(CampaignStatus.Completed, 'Campaign completed');
        break;
      case 'cancel':
        this.confirm
          .ask({
            title: 'Cancel this campaign?',
            message: 'Any queued messages will not be sent. Messages already delivered are unaffected.',
            confirmLabel: 'Cancel campaign',
            tone: 'danger',
            icon: 'cancel',
          })
          .subscribe((confirmed) => {
            if (confirmed) {
              apply(CampaignStatus.Cancelled, 'Campaign cancelled');
            }
          });
        break;
      default:
        break;
    }
  }
}
