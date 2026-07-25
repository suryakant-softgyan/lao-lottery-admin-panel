import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { AuthService } from '@core/authentication/auth.service';
import { PERMISSIONS } from '@core/constants/permission.constants';
import {
  DRAW_MODE_MAP,
  DRAW_STATUS_MAP,
  LOTTERY_TYPE_MAP,
  toOptions,
} from '@core/constants/status-maps.constants';
import { DrawStatus } from '@core/enums';
import type { Draw, Page, PageQuery, StatMetric } from '@core/models';
import type { TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { ConfirmService } from '@core/services/confirm.service';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatCard } from '@shared/components/stat-card/stat-card';
import { DrawRepository } from '../data/draw.repository';

/** All draws, past and future, with lifecycle actions on each row. */
@Component({
  selector: 'll-draw-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable, StatCard],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Draw Management"
        eyebrow="Operations"
        subtitle="Every scheduled, live and completed draw, with sales, payouts and verification status."
        icon="stadia_controller"
        [stats]="[
          { label: 'Draws', value: total().toLocaleString(), icon: 'stadia_controller' },
          { label: 'Selected', value: selected().length.toString(), icon: 'check_circle' },
        ]"
        [actions]="[
          { id: 'schedule', label: 'Schedule', icon: 'event', variant: 'secondary' },
          { id: 'results', label: 'Results', icon: 'fact_check', variant: 'secondary' },
          { id: 'live', label: 'Live studio', icon: 'sensors', variant: 'primary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      @if (summary().length) {
        <section class="ll-grid ll-grid--auto ll-stagger" aria-label="Draw statistics">
          @for (metric of summary(); track metric.id) {
            <ll-stat-card [metric]="metric" [currency]="metric.id === 'sales' || metric.id === 'payout'" />
          }
        </section>
      }

      <ll-list-toolbar
        searchPlaceholder="Search by draw code, lottery or status…"
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
        tableId="draws"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        emptyTitle="No draws"
        emptyMessage="Schedule a draw to see it listed here."
        (sortChange)="onSort($event)"
        (pageChange)="onPage($event)"
        (rowAction)="onRowAction($event)"
        (rowClick)="openDetail($event)"
        (selectionChange)="onSelectionChange($event)"
        (retry)="reload()" />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class DrawList extends ListPageBase<Draw> {
  private readonly repository = inject(DrawRepository);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly entityLabel = 'Draws';
  protected readonly summary = signal<StatMetric[]>([]);

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'status', label: 'Status', icon: 'flag', options: toOptions(DRAW_STATUS_MAP) },
    { key: 'lotteryType', label: 'Product', icon: 'casino', options: toOptions(LOTTERY_TYPE_MAP) },
    { key: 'mode', label: 'Mode', icon: 'smart_toy', options: toOptions(DRAW_MODE_MAP) },
  ];

  protected readonly columns: TableColumn<Draw>[] = [
    {
      key: 'code',
      label: 'Draw',
      sortable: true,
      sticky: 'start',
      minWidth: 220,
      locked: true,
      subLabel: (row) => `${row.lotteryName} · #${row.drawNumber}`,
    },
    {
      key: 'lotteryType',
      label: 'Product',
      type: 'badge',
      sortable: true,
      badgeMap: LOTTERY_TYPE_MAP,
      minWidth: 140,
    },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: DRAW_STATUS_MAP,
      minWidth: 180,
    },
    { key: 'mode', label: 'Mode', type: 'badge', badgeMap: DRAW_MODE_MAP, minWidth: 140 },
    { key: 'scheduledAt', label: 'Scheduled', type: 'datetime', sortable: true, minWidth: 170 },
    { key: 'salesCloseAt', label: 'Sales close', type: 'datetime', sortable: true, minWidth: 170 },
    { key: 'ticketsSold', label: 'Tickets', type: 'number', sortable: true, minWidth: 120 },
    { key: 'salesAmount', label: 'Sales', type: 'currency', sortable: true, minWidth: 150 },
    { key: 'winnerCount', label: 'Winners', type: 'number', sortable: true, minWidth: 110 },
    { key: 'payoutAmount', label: 'Payout', type: 'currency', sortable: true, minWidth: 150 },
    { key: 'grossProfit', label: 'Gross profit', type: 'currency', sortable: true, minWidth: 150 },
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
      visible: (row) => row.status === DrawStatus.SalesClosed || row.status === DrawStatus.Drawing,
    },
    {
      id: 'verify',
      label: 'Verify result',
      icon: 'fact_check',
      tone: 'success',
      permissions: [PERMISSIONS.draws.verify],
      visible: (row) => row.status === DrawStatus.PendingVerification,
    },
    {
      id: 'publish',
      label: 'Publish result',
      icon: 'campaign',
      tone: 'success',
      permissions: [PERMISSIONS.draws.publish],
      visible: (row) => row.status === DrawStatus.PendingVerification,
    },
    {
      id: 'rollback',
      label: 'Roll back draw',
      icon: 'undo',
      tone: 'danger',
      permissions: [PERMISSIONS.draws.rollback],
      visible: (row) => row.status === DrawStatus.Published,
      divider: true,
    },
    {
      id: 'cancel',
      label: 'Cancel draw',
      icon: 'cancel',
      tone: 'danger',
      permissions: [PERMISSIONS.draws.cancel],
      visible: (row) => row.status === DrawStatus.Scheduled || row.status === DrawStatus.SalesOpen,
    },
  ];

  constructor() {
    super();
    this.initialise();
    this.loadSummary();
  }

  protected fetch(query: PageQuery): Observable<Page<Draw>> {
    return this.repository.list(query);
  }

  private loadSummary(): void {
    this.repository.statistics().subscribe((metrics) => this.summary.set(metrics));
  }

  protected refreshAll(): void {
    this.reload();
    this.loadSummary();
  }

  protected openDetail(row: Draw): void {
    void this.router.navigate(['/draws/details', row.id]);
  }

  protected onHeaderAction(action: string): void {
    switch (action) {
      case 'schedule':
        void this.router.navigate(['/draws/schedule']);
        break;
      case 'results':
        void this.router.navigate(['/draws/results']);
        break;
      case 'live':
        void this.router.navigate(['/draws/live']);
        break;
      default:
        break;
    }
  }

  protected onRowAction(event: TableActionEvent<Draw>): void {
    const { action, row } = event;
    const actor = this.auth.user()?.fullName ?? 'Operator';

    switch (action) {
      case 'view':
        this.openDetail(row);
        break;
      case 'close-sales':
        this.repository.closeSales(row.id).subscribe(() => {
          this.toast.success('Sales closed', row.code);
          this.refreshAll();
        });
        break;
      case 'live':
        void this.router.navigate(['/draws/live'], { queryParams: { draw: row.id } });
        break;
      case 'verify':
        this.repository.verify(row.id, actor).subscribe(() => {
          this.toast.success('Result verified', row.code);
          this.refreshAll();
        });
        break;
      case 'publish':
        this.confirmPublish(row, actor);
        break;
      case 'rollback':
        this.confirmRollback(row);
        break;
      case 'cancel':
        this.confirm
          .open({
            title: 'Cancel this draw?',
            message: `${row.code} will be cancelled and every ticket sold will be refunded automatically.`,
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
                this.refreshAll();
              });
            }
          });
        break;
      default:
        break;
    }
  }

  /** Publishing is irreversible in practice — it triggers customer payouts. */
  private confirmPublish(row: Draw, actor: string): void {
    this.confirm
      .ask({
        title: 'Publish this result?',
        message: `Results for ${row.code} become visible to customers and prize payouts are released.`,
        detail: `${row.ticketsSold.toLocaleString()} tickets sold. Verified by ${row.verification.verifiedBy ?? 'not yet verified'}.`,
        confirmLabel: 'Publish result',
        tone: 'primary',
        icon: 'campaign',
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.repository.publish(row.id, actor).subscribe(() => {
            this.toast.success('Result published', row.code);
            this.refreshAll();
          });
        }
      });
  }

  /** Rollback demands typed confirmation — it reverses a published result. */
  private confirmRollback(row: Draw): void {
    this.confirm
      .open({
        title: 'Roll back this published draw?',
        message:
          'Published results will be withdrawn and any payouts already released must be recovered manually.',
        detail: 'This is one of the most sensitive actions in the platform and is fully audited.',
        confirmLabel: 'Roll back draw',
        tone: 'danger',
        icon: 'undo',
        requireTypedConfirmation: 'ROLLBACK',
        requireReason: true,
        reasonLabel: 'Reason for rollback',
      })
      .subscribe((result) => {
        if (result.confirmed && result.reason) {
          this.repository.rollback(row.id, result.reason).subscribe(() => {
            this.toast.warning('Draw rolled back', row.code);
            this.refreshAll();
          });
        }
      });
  }
}
