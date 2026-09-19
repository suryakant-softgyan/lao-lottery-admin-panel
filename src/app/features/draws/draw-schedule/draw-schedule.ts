import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { PERMISSIONS } from '@core/constants/permission.constants';
import {
  DRAW_MODE_MAP,
  DRAW_STATUS_MAP,
  LOTTERY_TYPE_MAP,
  toOptions,
} from '@core/constants/status-maps.constants';
import { DrawStatus } from '@core/enums';
import type { Draw, Page, PageQuery } from '@core/models';
import type { TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { ConfirmService } from '@core/services/confirm.service';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { DrawRepository } from '../data/draw.repository';

/** Forward schedule: draws that have not yet taken place. */
@Component({
  selector: 'll-draw-schedule',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Draw Schedule"
        eyebrow="Draw Operations"
        subtitle="Upcoming draws with their sales windows. Close sales or cancel a draw before it executes."
        icon="event"
        [stats]="[{ label: 'Upcoming', value: total().toLocaleString(), icon: 'event_upcoming' }]"
        [actions]="[
          { id: 'back', label: 'All draws', icon: 'stadia_controller', variant: 'secondary' },
          { id: 'live', label: 'Live studio', icon: 'sensors', variant: 'primary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      <ll-list-toolbar
        searchPlaceholder="Search upcoming draws…"
        [quickFilters]="quickFilters"
        [showDateRange]="true"
        [refreshing]="loading()"
        (searchChange)="onSearch($event)"
        (quickChange)="onQuickFilter($event)"
        (rangeChange)="onDateRange($event)"
        (refresh)="reload()"
        (export)="onExport($event)"
        (clear)="onClearFilters()" />

      <ll-data-table
        tableId="draw-schedule"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [selectable]="false"
        emptyTitle="Nothing scheduled"
        emptyMessage="There are no upcoming draws in the calendar."
        (sortChange)="onSort($event)"
        (pageChange)="onPage($event)"
        (rowAction)="onRowAction($event)"
        (rowClick)="openDetail($event)"
        (retry)="reload()" />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class DrawSchedule extends ListPageBase<Draw> {
  private readonly repository = inject(DrawRepository);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  protected readonly entityLabel = 'Draw Schedule';

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'lotteryType', label: 'Product', icon: 'casino', options: toOptions(LOTTERY_TYPE_MAP) },
    { key: 'mode', label: 'Mode', icon: 'smart_toy', options: toOptions(DRAW_MODE_MAP) },
    { key: 'status', label: 'Status', icon: 'flag', options: toOptions(DRAW_STATUS_MAP) },
  ];

  protected readonly columns: TableColumn<Draw>[] = [
    {
      key: 'scheduledAt',
      label: 'Draw time',
      type: 'datetime',
      sortable: true,
      sticky: 'start',
      minWidth: 190,
      locked: true,
      subLabel: (row) => row.code,
    },
    { key: 'lotteryName', label: 'Product', sortable: true, minWidth: 190 },
    {
      key: 'lotteryType',
      label: 'Type',
      type: 'badge',
      badgeMap: LOTTERY_TYPE_MAP,
      minWidth: 140,
    },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: DRAW_STATUS_MAP,
      minWidth: 170,
    },
    { key: 'mode', label: 'Mode', type: 'badge', badgeMap: DRAW_MODE_MAP, minWidth: 140 },
    { key: 'salesOpenAt', label: 'Sales open', type: 'datetime', minWidth: 170 },
    { key: 'salesCloseAt', label: 'Sales close', type: 'datetime', sortable: true, minWidth: 170 },
    { key: 'ticketsSold', label: 'Tickets so far', type: 'number', sortable: true, minWidth: 140 },
    { key: 'salesAmount', label: 'Sales so far', type: 'currency', sortable: true, minWidth: 150 },
    { key: 'jackpotAmount', label: 'Jackpot', type: 'currency', sortable: true, minWidth: 150 },
  ];

  protected readonly rowActions: TableAction<Draw>[] = [
    { id: 'view', label: 'View details', icon: 'visibility', primary: true, tone: 'primary' },
    {
      id: 'close-sales',
      label: 'Close sales',
      icon: 'lock',
      tone: 'warning',
      permissions: [PERMISSIONS.draws.execute],
      visible: (row) => row.status === DrawStatus.SalesOpen,
      confirm: {
        title: 'Close ticket sales?',
        message: 'No further tickets can be issued for this draw on any channel.',
        confirmLabel: 'Close sales',
        tone: 'warning',
      },
    },
    {
      id: 'live',
      label: 'Open in live studio',
      icon: 'sensors',
      tone: 'danger',
      permissions: [PERMISSIONS.draws.execute],
    },
    {
      id: 'cancel',
      label: 'Cancel draw',
      icon: 'cancel',
      tone: 'danger',
      permissions: [PERMISSIONS.draws.cancel],
      divider: true,
    },
  ];

  constructor() {
    super();
    this.patchQuery({ sort: { active: 'scheduledAt', direction: 'asc' as never } });
    this.initialise();
  }

  protected fetch(query: PageQuery): Observable<Page<Draw>> {
    return this.repository.upcoming(query);
  }

  protected openDetail(row: Draw): void {
    void this.router.navigate(['/draws/details', row.id]);
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/draws']);
    } else if (action === 'live') {
      void this.router.navigate(['/draws/live']);
    }
  }

  protected onRowAction(event: TableActionEvent<Draw>): void {
    const { action, row } = event;

    switch (action) {
      case 'view':
        this.openDetail(row);
        break;
      case 'close-sales':
        this.repository.closeSales(row.id).subscribe(() => {
          this.toast.success('Sales closed', row.code);
          this.reload();
        });
        break;
      case 'live':
        void this.router.navigate(['/draws/live'], { queryParams: { draw: row.id } });
        break;
      case 'cancel':
        this.confirm
          .open({
            title: 'Cancel this draw?',
            message: `${row.code} will be cancelled and every ticket sold refunded automatically.`,
            detail: `${row.ticketsSold.toLocaleString()} ticket(s) would be refunded.`,
            confirmLabel: 'Cancel draw',
            tone: 'danger',
            icon: 'cancel',
            requireReason: true,
            reasonLabel: 'Reason for cancellation',
          })
          .subscribe((result) => {
            if (result.confirmed && result.reason) {
              this.repository.cancel(row.id, result.reason).subscribe(() => {
                this.toast.success('Draw cancelled', row.code);
                this.reload();
              });
            }
          });
        break;
      default:
        break;
    }
  }
}
