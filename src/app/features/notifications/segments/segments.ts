import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { PERMISSIONS } from '@core/constants/permission.constants';
import type { AudienceSegment, Page, PageQuery } from '@core/models';
import type { TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { NotificationRepository } from '../data/notification.repository';

/** Audience segments used to target campaigns. */
@Component({
  selector: 'll-segments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Audience Segments"
        eyebrow="Communications"
        subtitle="Dynamic and static audiences used to target campaigns. Dynamic segments re-evaluate on refresh."
        icon="pie_chart"
        [stats]="[{ label: 'Segments', value: total().toString(), icon: 'pie_chart' }]"
        [actions]="[
          { id: 'campaigns', label: 'Campaigns', icon: 'campaign', variant: 'secondary' },
          { id: 'templates', label: 'Templates', icon: 'description', variant: 'primary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      <ll-list-toolbar
        searchPlaceholder="Search segments by name, code or criteria…"
        [quickFilters]="quickFilters"
        [refreshing]="loading()"
        (searchChange)="onSearch($event)"
        (quickChange)="onQuickFilter($event)"
        (refresh)="reload()"
        (export)="onExport($event)"
        (clear)="onClearFilters()" />

      <ll-data-table
        tableId="segments"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [selectable]="false"
        emptyTitle="No segments"
        emptyMessage="Define a segment to target campaigns at a specific audience."
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
export class Segments extends ListPageBase<AudienceSegment> {
  private readonly repository = inject(NotificationRepository);
  private readonly router = inject(Router);

  protected readonly entityLabel = 'Audience Segments';

  protected readonly quickFilters: QuickFilter[] = [
    {
      key: 'dynamic',
      label: 'Type',
      icon: 'bolt',
      options: [
        { value: 'true', label: 'Dynamic' },
        { value: 'false', label: 'Static' },
      ],
    },
  ];

  protected readonly columns: TableColumn<AudienceSegment>[] = [
    {
      key: 'name',
      label: 'Segment',
      sortable: true,
      sticky: 'start',
      minWidth: 240,
      locked: true,
      subLabel: (row) => row.code,
    },
    { key: 'description', label: 'Description', minWidth: 300 },
    { key: 'criteria', label: 'Criteria', minWidth: 280, cellClass: () => 'll-mono' },
    { key: 'memberCount', label: 'Members', type: 'number', sortable: true, minWidth: 130 },
    { key: 'dynamic', label: 'Dynamic', type: 'boolean', sortable: true, align: 'center', minWidth: 110 },
    { key: 'lastRefreshedAt', label: 'Last refreshed', type: 'relative', sortable: true, minWidth: 160 },
  ];

  protected readonly rowActions: TableAction<AudienceSegment>[] = [
    {
      id: 'refresh',
      label: 'Refresh membership',
      icon: 'refresh',
      primary: true,
      tone: 'primary',
      permissions: [PERMISSIONS.notifications.segments],
      visible: (row) => row.dynamic,
    },
    { id: 'campaign', label: 'Create a campaign', icon: 'campaign' },
  ];

  constructor() {
    super();
    this.initialise();
  }

  protected fetch(query: PageQuery): Observable<Page<AudienceSegment>> {
    return this.repository.segments(query);
  }

  protected onHeaderAction(action: string): void {
    if (action === 'campaigns') {
      void this.router.navigate(['/notifications/campaigns']);
    } else if (action === 'templates') {
      void this.router.navigate(['/notifications/templates']);
    }
  }

  protected onRowAction(event: TableActionEvent<AudienceSegment>): void {
    const { action, row } = event;

    if (action === 'refresh') {
      this.repository.refreshSegment(row.id).subscribe((segment) => {
        this.toast.success(
          'Segment refreshed',
          `${segment.name} now has ${segment.memberCount.toLocaleString()} members.`,
        );
        this.reload();
      });
    } else if (action === 'campaign') {
      void this.router.navigate(['/notifications/campaigns'], { queryParams: { segment: row.id } });
    }
  }
}
