import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { AuthService } from '@core/authentication/auth.service';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { SETTLEMENT_STATUS_MAP, toOptions } from '@core/constants/status-maps.constants';
import { SettlementStatus, WalletOwnerType } from '@core/enums';
import type { Page, PageQuery, Settlement } from '@core/models';
import type { BulkActionEvent, TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { ConfirmService } from '@core/services/confirm.service';
import { humanise } from '@core/utilities/format.util';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { WalletRepository } from '../data/wallet.repository';

/** Agent and retailer settlement runs, from draft through to payment. */
@Component({
  selector: 'll-settlements',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Settlements"
        eyebrow="Finance"
        subtitle="Periodic settlement runs for agents and retailers: gross sales, commission, payouts and net payable."
        icon="receipt"
        [stats]="[{ label: 'Settlements', value: total().toLocaleString(), icon: 'receipt' }]"
        [actions]="[
          { id: 'back', label: 'Wallet accounts', icon: 'account_balance_wallet', variant: 'secondary' },
          { id: 'transactions', label: 'Ledger', icon: 'receipt_long', variant: 'secondary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      <ll-list-toolbar
        searchPlaceholder="Search by reference, party or bank…"
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
        tableId="settlements"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [bulkActions]="bulkActions"
        emptyTitle="No settlements"
        emptyMessage="Settlement runs appear here at the end of each period."
        (sortChange)="onSort($event)"
        (pageChange)="onPage($event)"
        (rowAction)="onRowAction($event)"
        (bulkAction)="onBulkAction($event)"
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
export class Settlements extends ListPageBase<Settlement> {
  private readonly repository = inject(WalletRepository);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly entityLabel = 'Settlements';

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'status', label: 'Status', icon: 'flag', options: toOptions(SETTLEMENT_STATUS_MAP) },
    {
      key: 'partyType',
      label: 'Party',
      icon: 'group',
      options: [WalletOwnerType.Agent, WalletOwnerType.Retailer].map((value) => ({
        value,
        label: humanise(value),
      })),
    },
  ];

  protected readonly columns: TableColumn<Settlement>[] = [
    {
      key: 'reference',
      label: 'Reference',
      sortable: true,
      sticky: 'start',
      minWidth: 180,
      locked: true,
      subLabel: (row) => humanise(row.partyType),
      cellClass: () => 'll-mono',
    },
    { key: 'partyName', label: 'Party', sortable: true, minWidth: 200 },
    { key: 'periodStart', label: 'Period from', type: 'date', sortable: true, minWidth: 140 },
    { key: 'periodEnd', label: 'Period to', type: 'date', sortable: true, minWidth: 140 },
    { key: 'grossSales', label: 'Gross sales', type: 'currency', sortable: true, minWidth: 160 },
    { key: 'commission', label: 'Commission', type: 'currency', sortable: true, minWidth: 150 },
    { key: 'prizePayout', label: 'Prize payout', type: 'currency', sortable: true, minWidth: 160 },
    { key: 'tax', label: 'Tax', type: 'currency', sortable: true, minWidth: 130 },
    { key: 'adjustments', label: 'Adjustments', type: 'currency', sortable: true, minWidth: 150 },
    { key: 'netPayable', label: 'Net payable', type: 'currency', sortable: true, minWidth: 160 },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: SETTLEMENT_STATUS_MAP,
      minWidth: 150,
    },
    { key: 'bankName', label: 'Bank', minWidth: 200 },
    { key: 'paidAt', label: 'Paid', type: 'relative', sortable: true, minWidth: 140 },
  ];

  protected readonly rowActions: TableAction<Settlement>[] = [
    {
      id: 'approve',
      label: 'Approve settlement',
      icon: 'thumb_up',
      tone: 'success',
      primary: true,
      permissions: [PERMISSIONS.payment.settle],
      visible: (row) => row.status === SettlementStatus.Pending || row.status === SettlementStatus.Draft,
    },
    {
      id: 'pay',
      label: 'Mark as paid',
      icon: 'paid',
      tone: 'success',
      permissions: [PERMISSIONS.payment.settle],
      visible: (row) => row.status === SettlementStatus.Approved,
    },
    { id: 'party', label: 'Open party record', icon: 'open_in_new' },
    {
      id: 'dispute',
      label: 'Flag as disputed',
      icon: 'gavel',
      tone: 'danger',
      permissions: [PERMISSIONS.payment.settle],
      visible: (row) => row.status !== SettlementStatus.Disputed,
      divider: true,
    },
  ];

  protected readonly bulkActions = [
    {
      id: 'approve',
      label: 'Approve',
      icon: 'thumb_up',
      tone: 'success' as const,
      permissions: [PERMISSIONS.payment.settle],
      confirm: {
        title: 'Approve selected settlements?',
        message: '{count} settlement(s) will be approved and queued for payment.',
        confirmLabel: 'Approve',
        tone: 'primary' as const,
      },
    },
  ];

  constructor() {
    super();
    this.patchQuery({ sort: { active: 'periodEnd', direction: 'desc' as never } });
    this.initialise();
  }

  protected fetch(query: PageQuery): Observable<Page<Settlement>> {
    return this.repository.settlements(query);
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/wallet']);
    } else if (action === 'transactions') {
      void this.router.navigate(['/wallet/transactions']);
    }
  }

  protected onRowAction(event: TableActionEvent<Settlement>): void {
    const { action, row } = event;
    const actor = this.auth.user()?.fullName ?? 'Finance';

    switch (action) {
      case 'approve':
        this.confirm
          .ask({
            title: 'Approve this settlement?',
            message: `${row.partyName} will be approved for a net payment of ${row.netPayable.toLocaleString()} ₭.`,
            detail: `Period ${row.periodStart.slice(0, 10)} to ${row.periodEnd.slice(0, 10)}.`,
            confirmLabel: 'Approve settlement',
            tone: 'primary',
            icon: 'thumb_up',
          })
          .subscribe((confirmed) => {
            if (confirmed) {
              this.repository.approveSettlement(row.id, actor).subscribe(() => {
                this.toast.success('Settlement approved', row.reference);
                this.reload();
              });
            }
          });
        break;
      case 'pay':
        this.confirm
          .open({
            title: 'Mark this settlement as paid?',
            message: `Confirm that ${row.netPayable.toLocaleString()} ₭ has been transferred to ${row.partyName}.`,
            detail: `${row.bankName ?? 'Bank'} · ${row.bankAccountNumber ?? 'account on file'}`,
            confirmLabel: 'Confirm payment',
            tone: 'success',
            icon: 'paid',
            requireReason: true,
            reasonLabel: 'Bank payment reference',
          })
          .subscribe((result) => {
            if (result.confirmed && result.reason) {
              this.repository.paySettlement(row.id, result.reason).subscribe(() => {
                this.toast.success('Settlement paid', row.reference);
                this.reload();
              });
            }
          });
        break;
      case 'party':
        void this.router.navigate(
          row.partyType === WalletOwnerType.Agent
            ? ['/agents/details', row.partyId]
            : ['/retailers/details', row.partyId],
        );
        break;
      case 'dispute':
        this.confirm
          .open({
            title: 'Flag this settlement as disputed?',
            message: `${row.reference} will be held until the dispute is resolved.`,
            confirmLabel: 'Flag dispute',
            tone: 'danger',
            icon: 'gavel',
            requireReason: true,
            reasonLabel: 'Nature of the dispute',
          })
          .subscribe((result) => {
            if (result.confirmed && result.reason) {
              this.toast.warning('Settlement disputed', row.reference);
              this.reload();
            }
          });
        break;
      default:
        break;
    }
  }

  protected onBulkAction(event: BulkActionEvent<Settlement>): void {
    if (event.action !== 'approve') {
      return;
    }
    const actor = this.auth.user()?.fullName ?? 'Finance';
    let completed = 0;

    for (const row of event.rows) {
      this.repository.approveSettlement(row.id, actor).subscribe(() => {
        completed++;
        if (completed === event.rows.length) {
          this.toast.success(`${completed} settlement(s) approved`);
          this.reload();
        }
      });
    }
  }
}
