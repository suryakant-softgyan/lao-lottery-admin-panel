import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import {
  TRANSACTION_DIRECTION_MAP,
  TRANSACTION_STATUS_MAP,
  TRANSACTION_TYPE_MAP,
  toOptions,
} from '@core/constants/status-maps.constants';
import { WalletOwnerType } from '@core/enums';
import type { Page, PageQuery, WalletTransaction } from '@core/models';
import type { TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { humanise } from '@core/utilities/format.util';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { WalletRepository } from '../data/wallet.repository';

/** The wallet ledger: every credit and debit across the network. */
@Component({
  selector: 'll-wallet-transactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Wallet Transactions"
        eyebrow="Finance"
        subtitle="Complete ledger of credits and debits, with balances before and after each movement."
        icon="swap_horiz"
        [stats]="[{ label: 'Movements', value: total().toLocaleString(), icon: 'receipt_long' }]"
        [actions]="[
          { id: 'back', label: 'Wallet accounts', icon: 'account_balance_wallet', variant: 'secondary' },
          { id: 'transfer', label: 'Transfer funds', icon: 'sync_alt', variant: 'primary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      <ll-list-toolbar
        searchPlaceholder="Search by reference, owner, wallet code or narration…"
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
        tableId="wallet-transactions"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        emptyTitle="No transactions"
        emptyMessage="Wallet movements appear here as soon as trading begins."
        (sortChange)="onSort($event)"
        (pageChange)="onPage($event)"
        (rowAction)="onRowAction($event)"
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
export class WalletTransactions extends ListPageBase<WalletTransaction> {
  private readonly repository = inject(WalletRepository);
  private readonly router = inject(Router);

  protected readonly entityLabel = 'Wallet Transactions';

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'type', label: 'Type', icon: 'category', options: toOptions(TRANSACTION_TYPE_MAP) },
    { key: 'status', label: 'Status', icon: 'flag', options: toOptions(TRANSACTION_STATUS_MAP) },
    {
      key: 'direction',
      label: 'Direction',
      icon: 'swap_vert',
      options: toOptions(TRANSACTION_DIRECTION_MAP),
    },
    {
      key: 'ownerType',
      label: 'Owner',
      icon: 'group',
      options: Object.values(WalletOwnerType).map((value) => ({ value, label: humanise(value) })),
    },
  ];

  protected readonly columns: TableColumn<WalletTransaction>[] = [
    {
      key: 'reference',
      label: 'Reference',
      sortable: true,
      sticky: 'start',
      minWidth: 190,
      locked: true,
      subLabel: (row) => row.walletCode,
      cellClass: () => 'll-mono',
    },
    {
      key: 'ownerName',
      label: 'Owner',
      sortable: true,
      minWidth: 190,
      subLabel: (row) => humanise(row.ownerType),
    },
    {
      key: 'type',
      label: 'Type',
      type: 'badge',
      sortable: true,
      badgeMap: TRANSACTION_TYPE_MAP,
      minWidth: 170,
    },
    {
      key: 'direction',
      label: 'Direction',
      type: 'badge',
      sortable: true,
      badgeMap: TRANSACTION_DIRECTION_MAP,
      minWidth: 130,
    },
    { key: 'amount', label: 'Amount', type: 'currency', sortable: true, minWidth: 150 },
    { key: 'fee', label: 'Fee', type: 'currency', sortable: true, minWidth: 120 },
    { key: 'tax', label: 'Tax', type: 'currency', sortable: true, minWidth: 120 },
    { key: 'netAmount', label: 'Net', type: 'currency', sortable: true, minWidth: 150 },
    { key: 'balanceBefore', label: 'Balance before', type: 'currency', sortable: true, minWidth: 160 },
    { key: 'balanceAfter', label: 'Balance after', type: 'currency', sortable: true, minWidth: 160 },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: TRANSACTION_STATUS_MAP,
      minWidth: 150,
    },
    { key: 'counterpartyName', label: 'Counterparty', minWidth: 180 },
    { key: 'narration', label: 'Narration', minWidth: 240 },
    { key: 'createdAt', label: 'Recorded', type: 'datetime', sortable: true, minWidth: 175 },
  ];

  protected readonly rowActions: TableAction<WalletTransaction>[] = [
    { id: 'wallet', label: 'Open wallet', icon: 'account_balance_wallet', primary: true, tone: 'primary' },
    { id: 'audit', label: 'View in audit trail', icon: 'gavel' },
  ];

  constructor() {
    super();
    this.patchQuery({ sort: { active: 'createdAt', direction: 'desc' as never } });
    this.initialise();
  }

  protected fetch(query: PageQuery): Observable<Page<WalletTransaction>> {
    return this.repository.transactions(query);
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/wallet']);
    } else if (action === 'transfer') {
      void this.router.navigate(['/wallet/transfer']);
    }
  }

  protected onRowAction(event: TableActionEvent<WalletTransaction>): void {
    if (event.action === 'wallet') {
      void this.router.navigate(['/wallet'], { queryParams: { search: event.row.walletCode } });
    } else if (event.action === 'audit') {
      void this.router.navigate(['/audit/transaction'], {
        queryParams: { search: event.row.reference },
      });
    }
  }
}
