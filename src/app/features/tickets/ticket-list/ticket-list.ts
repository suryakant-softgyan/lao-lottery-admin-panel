import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { AuthService } from '@core/authentication/auth.service';
import { PERMISSIONS } from '@core/constants/permission.constants';
import {
  CLAIM_STATUS_MAP,
  LOTTERY_TYPE_MAP,
  TICKET_CHANNEL_MAP,
  TICKET_STATUS_MAP,
  toOptions,
} from '@core/constants/status-maps.constants';
import { ClaimStatus, TicketStatus } from '@core/enums';
import type { Page, PageQuery, StatMetric, Ticket } from '@core/models';
import type { BulkActionEvent, TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { ConfirmService } from '@core/services/confirm.service';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatCard } from '@shared/components/stat-card/stat-card';
import { TicketRepository } from '../data/ticket.repository';

type ListMode = 'all' | 'winning' | 'cancelled';

/**
 * Ticket register.
 *
 * One component serves three routes — all, winning and cancelled — because the
 * columns, filters and actions are the same; only the base dataset and the copy
 * differ. Route `data.mode` selects which.
 */
@Component({
  selector: 'll-ticket-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable, StatCard],
  template: `
    <div class="ll-page">
      <ll-page-header
        [title]="copy().title"
        eyebrow="Operations"
        [subtitle]="copy().subtitle"
        [icon]="copy().icon"
        [stats]="[
          { label: 'Tickets', value: total().toLocaleString(), icon: 'confirmation_number' },
          { label: 'Selected', value: selected().length.toString(), icon: 'check_circle' },
        ]"
        [actions]="[
          { id: 'validate', label: 'Validate ticket', icon: 'qr_code_scanner', variant: 'secondary' },
          { id: 'winning', label: 'Winning tickets', icon: 'emoji_events', variant: 'primary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      @if (summary().length) {
        <section class="ll-grid ll-grid--auto ll-stagger" aria-label="Ticket statistics">
          @for (metric of summary(); track metric.id) {
            <ll-stat-card
              [metric]="metric"
              [currency]="metric.id === 'stake' || metric.id === 'liability' || metric.id === 'paid'" />
          }
        </section>
      }

      <ll-list-toolbar
        searchPlaceholder="Search by ticket number, serial, barcode, customer or retailer…"
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
        [tableId]="'tickets-' + mode()"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [bulkActions]="bulkActions"
        [emptyTitle]="copy().emptyTitle"
        [emptyMessage]="copy().emptyMessage"
        (sortChange)="onSort($event)"
        (pageChange)="onPage($event)"
        (rowAction)="onRowAction($event)"
        (bulkAction)="onBulkAction($event)"
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
export class TicketList extends ListPageBase<Ticket> {
  private readonly repository = inject(TicketRepository);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  protected readonly mode = signal<ListMode>(
    (this.route.snapshot.data['mode'] as ListMode | undefined) ?? 'all',
  );

  protected readonly entityLabel = 'Tickets';
  protected readonly summary = signal<StatMetric[]>([]);

  /** Page copy varies by mode; everything else is shared. */
  protected readonly copy = computed(() => {
    switch (this.mode()) {
      case 'winning':
        return {
          title: 'Winning Tickets',
          subtitle: 'Tickets that won a prize, with claim status and outstanding payout liability.',
          icon: 'emoji_events',
          emptyTitle: 'No winning tickets',
          emptyMessage: 'Winning tickets appear here once a draw result is published.',
        };
      case 'cancelled':
        return {
          title: 'Cancelled Tickets',
          subtitle: 'Cancelled and voided tickets. A rising trend at one outlet warrants investigation.',
          icon: 'cancel',
          emptyTitle: 'No cancellations',
          emptyMessage: 'No tickets have been cancelled or voided.',
        };
      default:
        return {
          title: 'Tickets',
          subtitle: 'Every ticket issued across retail, POS, mobile, web and kiosk channels.',
          icon: 'confirmation_number',
          emptyTitle: 'No tickets yet',
          emptyMessage: 'Tickets appear here as soon as the sales channels start trading.',
        };
    }
  });

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'status', label: 'Status', icon: 'flag', options: toOptions(TICKET_STATUS_MAP) },
    { key: 'lotteryType', label: 'Product', icon: 'casino', options: toOptions(LOTTERY_TYPE_MAP) },
    { key: 'channel', label: 'Channel', icon: 'hub', options: toOptions(TICKET_CHANNEL_MAP) },
    { key: 'claimStatus', label: 'Claim', icon: 'redeem', options: toOptions(CLAIM_STATUS_MAP) },
  ];

  protected readonly columns: TableColumn<Ticket>[] = [
    {
      key: 'ticketNumber',
      label: 'Ticket',
      sortable: true,
      sticky: 'start',
      minWidth: 200,
      locked: true,
      subLabel: (row) => `${row.lotteryName} · ${row.drawCode}`,
      cellClass: () => 'll-mono',
    },
    {
      key: 'lines',
      label: 'Numbers',
      minWidth: 170,
      sortable: false,
      value: (row) => row.lines.map((line) => line.numbers.join('')).join(', '),
      cellClass: () => 'll-mono',
    },
    {
      key: 'customerName',
      label: 'Customer',
      sortable: true,
      minWidth: 180,
      subLabel: (row) => row.customerPhone,
    },
    { key: 'retailerName', label: 'Retailer', sortable: true, minWidth: 190 },
    {
      key: 'channel',
      label: 'Channel',
      type: 'badge',
      sortable: true,
      badgeMap: TICKET_CHANNEL_MAP,
      minWidth: 150,
    },
    { key: 'totalStake', label: 'Stake', type: 'currency', sortable: true, minWidth: 130 },
    { key: 'totalPayout', label: 'Payout', type: 'currency', sortable: true, minWidth: 140 },
    { key: 'netPayout', label: 'Net payout', type: 'currency', sortable: true, minWidth: 150 },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: TICKET_STATUS_MAP,
      minWidth: 150,
    },
    {
      key: 'claimStatus',
      label: 'Claim',
      type: 'badge',
      sortable: true,
      badgeMap: CLAIM_STATUS_MAP,
      minWidth: 150,
    },
    { key: 'province', label: 'Province', sortable: true, minWidth: 150 },
    { key: 'purchasedAt', label: 'Purchased', type: 'datetime', sortable: true, minWidth: 175 },
    { key: 'expiresAt', label: 'Claim expires', type: 'date', sortable: true, minWidth: 150 },
  ];

  protected readonly rowActions: TableAction<Ticket>[] = [
    { id: 'view', label: 'View ticket', icon: 'visibility', primary: true, tone: 'primary' },
    {
      id: 'payout',
      label: 'Pay prize',
      icon: 'paid',
      tone: 'success',
      permissions: [PERMISSIONS.tickets.payout],
      visible: (row) => row.status === TicketStatus.Winning,
    },
    {
      id: 'draw',
      label: 'Open draw',
      icon: 'stadia_controller',
      permissions: [PERMISSIONS.draws.view],
    },
    {
      id: 'cancel',
      label: 'Cancel ticket',
      icon: 'cancel',
      tone: 'warning',
      permissions: [PERMISSIONS.tickets.cancel],
      visible: (row) => row.status === TicketStatus.Sold || row.status === TicketStatus.Pending,
      divider: true,
    },
    {
      id: 'void',
      label: 'Void ticket',
      icon: 'block',
      tone: 'danger',
      permissions: [PERMISSIONS.tickets.void],
      visible: (row) => row.status !== TicketStatus.Void && row.status !== TicketStatus.Claimed,
    },
  ];

  protected readonly bulkActions = [
    {
      id: 'approve-claims',
      label: 'Approve claims',
      icon: 'task_alt',
      tone: 'success' as const,
      permissions: [PERMISSIONS.tickets.payout],
      confirm: {
        title: 'Approve selected claims?',
        message: '{count} claim(s) will be approved and queued for payout.',
        confirmLabel: 'Approve claims',
        tone: 'primary' as const,
      },
    },
  ];

  constructor() {
    super();
    this.patchQuery({ sort: { active: 'purchasedAt', direction: 'desc' as never } });
    this.initialise();
    this.loadSummary();
  }

  protected fetch(query: PageQuery): Observable<Page<Ticket>> {
    switch (this.mode()) {
      case 'winning':
        return this.repository.winning(query);
      case 'cancelled':
        return this.repository.cancelled(query);
      default:
        return this.repository.list(query);
    }
  }

  private loadSummary(): void {
    const request =
      this.mode() === 'winning' ? this.repository.unclaimedStatistics() : this.repository.statistics();
    request.subscribe((metrics) => this.summary.set(metrics));
  }

  protected refreshAll(): void {
    this.reload();
    this.loadSummary();
  }

  protected openDetail(row: Ticket): void {
    void this.router.navigate(['/tickets/details', row.id]);
  }

  protected onHeaderAction(action: string): void {
    if (action === 'validate') {
      void this.router.navigate(['/tickets/validate']);
    } else if (action === 'winning') {
      void this.router.navigate(['/tickets/winning']);
    }
  }

  protected onRowAction(event: TableActionEvent<Ticket>): void {
    const { action, row } = event;
    const actor = this.auth.user()?.fullName ?? 'Operator';

    switch (action) {
      case 'view':
        this.openDetail(row);
        break;
      case 'draw':
        void this.router.navigate(['/draws/details', row.drawId]);
        break;
      case 'payout':
        this.confirm
          .ask({
            title: 'Pay this prize?',
            message: `${row.customerName} will be paid ${row.netPayout.toLocaleString()} ₭ for ticket ${row.ticketNumber}.`,
            detail: `Gross ${row.totalPayout.toLocaleString()} ₭ less ${row.taxDeducted.toLocaleString()} ₭ tax.`,
            confirmLabel: 'Confirm payout',
            tone: 'success',
            icon: 'paid',
          })
          .subscribe((confirmed) => {
            if (confirmed) {
              this.repository.payout(row.id, actor).subscribe(() => {
                this.toast.success('Prize paid', row.ticketNumber);
                this.refreshAll();
              });
            }
          });
        break;
      case 'cancel':
        this.askReason('Cancel ticket', row, (reason) =>
          this.repository.cancel(row.id, reason, actor).subscribe(() => {
            this.toast.success('Ticket cancelled', row.ticketNumber);
            this.refreshAll();
          }),
        );
        break;
      case 'void':
        this.askReason('Void ticket', row, (reason) =>
          this.repository.void(row.id, reason, actor).subscribe(() => {
            this.toast.success('Ticket voided', row.ticketNumber);
            this.refreshAll();
          }),
        );
        break;
      default:
        break;
    }
  }

  protected onBulkAction(event: BulkActionEvent<Ticket>): void {
    if (event.action !== 'approve-claims') {
      return;
    }
    const ids = event.rows.map((row) => row.id);
    this.repository.bulkPatch(ids, { claimStatus: ClaimStatus.Approved }).subscribe(() => {
      this.toast.success(`${ids.length} claim(s) approved`);
      this.refreshAll();
    });
  }

  private askReason(title: string, row: Ticket, run: (reason: string) => void): void {
    this.confirm
      .open({
        title: `${title}?`,
        message: `Ticket ${row.ticketNumber} carries a stake of ${row.totalStake.toLocaleString()} ₭.`,
        detail: 'Voiding or cancelling a ticket is recorded against the issuing outlet.',
        confirmLabel: title,
        tone: 'danger',
        icon: 'cancel',
        requireReason: true,
        reasonLabel: 'Reason (recorded in the audit trail)',
      })
      .subscribe((result) => {
        if (result.confirmed && result.reason) {
          run(result.reason);
        }
      });
  }
}
