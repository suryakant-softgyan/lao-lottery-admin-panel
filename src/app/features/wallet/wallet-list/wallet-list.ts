import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { AuthService } from '@core/authentication/auth.service';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { WALLET_STATUS_MAP, toOptions } from '@core/constants/status-maps.constants';
import { WalletOwnerType, WalletStatus } from '@core/enums';
import type { Page, PageQuery, StatMetric, Wallet } from '@core/models';
import type { BulkActionEvent, TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { ConfirmService } from '@core/services/confirm.service';
import { humanise } from '@core/utilities/format.util';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatCard } from '@shared/components/stat-card/stat-card';
import { WalletRepository } from '../data/wallet.repository';

/** Wallet account register across customers, agents, retailers and system floats. */
@Component({
  selector: 'll-wallet-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable, StatCard],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Wallet Accounts"
        eyebrow="Finance"
        subtitle="Balances, held funds and credit across every wallet in the network."
        icon="account_balance_wallet"
        [stats]="[
          { label: 'Accounts', value: total().toLocaleString(), icon: 'account_balance_wallet' },
          { label: 'Selected', value: selected().length.toString(), icon: 'check_circle' },
        ]"
        [actions]="[
          { id: 'transactions', label: 'Transactions', icon: 'swap_horiz', variant: 'secondary' },
          { id: 'settlement', label: 'Settlements', icon: 'receipt', variant: 'secondary' },
          { id: 'transfer', label: 'Transfer funds', icon: 'sync_alt', variant: 'primary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      @if (summary().length) {
        <section class="ll-grid ll-grid--auto ll-stagger" aria-label="Wallet statistics">
          @for (metric of summary(); track metric.id) {
            <ll-stat-card
              [metric]="metric"
              [currency]="['balance', 'held', 'system', 'credit'].includes(metric.id)" />
          }
        </section>
      }

      <ll-list-toolbar
        searchPlaceholder="Search by owner, wallet code or province…"
        [quickFilters]="quickFilters"
        [refreshing]="loading()"
        (searchChange)="onSearch($event)"
        (quickChange)="onQuickFilter($event)"
        (refresh)="refreshAll()"
        (export)="onExport($event)"
        (clear)="onClearFilters()" />

      <ll-data-table
        tableId="wallets"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [bulkActions]="bulkActions"
        emptyTitle="No wallet accounts"
        emptyMessage="Wallets are created automatically when an agent, retailer or customer is onboarded."
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
export class WalletList extends ListPageBase<Wallet> {
  private readonly repository = inject(WalletRepository);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly entityLabel = 'Wallets';
  protected readonly summary = signal<StatMetric[]>([]);

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'status', label: 'Status', icon: 'flag', options: toOptions(WALLET_STATUS_MAP) },
    {
      key: 'ownerType',
      label: 'Owner',
      icon: 'group',
      options: Object.values(WalletOwnerType).map((value) => ({ value, label: humanise(value) })),
    },
  ];

  protected readonly columns: TableColumn<Wallet>[] = [
    {
      key: 'ownerName',
      label: 'Owner',
      type: 'avatar',
      sortable: true,
      sticky: 'start',
      minWidth: 240,
      locked: true,
      avatarUrl: (row) => row.ownerAvatar,
      subLabel: (row) => `${row.code} · ${humanise(row.ownerType)}`,
    },
    { key: 'balance', label: 'Balance', type: 'currency', sortable: true, minWidth: 160 },
    { key: 'availableBalance', label: 'Available', type: 'currency', sortable: true, minWidth: 160 },
    { key: 'heldBalance', label: 'Held', type: 'currency', sortable: true, minWidth: 150 },
    { key: 'creditLimit', label: 'Credit limit', type: 'currency', sortable: true, minWidth: 160 },
    { key: 'lifetimeCredit', label: 'Lifetime in', type: 'currency', sortable: true, minWidth: 160 },
    { key: 'lifetimeDebit', label: 'Lifetime out', type: 'currency', sortable: true, minWidth: 160 },
    { key: 'province', label: 'Province', sortable: true, minWidth: 150 },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: WALLET_STATUS_MAP,
      minWidth: 140,
    },
    { key: 'lastTransactionAt', label: 'Last movement', type: 'relative', sortable: true, minWidth: 150 },
  ];

  protected readonly rowActions: TableAction<Wallet>[] = [
    { id: 'transactions', label: 'View ledger', icon: 'receipt_long', primary: true, tone: 'primary' },
    {
      id: 'transfer',
      label: 'Transfer from wallet',
      icon: 'sync_alt',
      permissions: [PERMISSIONS.wallet.transfer],
      visible: (row) => row.status === WalletStatus.Active,
    },
    {
      id: 'freeze',
      label: 'Freeze wallet',
      icon: 'ac_unit',
      tone: 'warning',
      permissions: [PERMISSIONS.wallet.freeze],
      visible: (row) => row.status === WalletStatus.Active,
      divider: true,
    },
    {
      id: 'unfreeze',
      label: 'Unfreeze wallet',
      icon: 'lock_open',
      tone: 'success',
      permissions: [PERMISSIONS.wallet.unfreeze],
      visible: (row) => row.status === WalletStatus.Frozen,
    },
  ];

  protected readonly bulkActions = [
    {
      id: 'freeze',
      label: 'Freeze',
      icon: 'ac_unit',
      tone: 'warning' as const,
      permissions: [PERMISSIONS.wallet.freeze],
      confirm: {
        title: 'Freeze selected wallets?',
        message: '{count} wallet(s) will be frozen. No debits or credits will be accepted.',
        confirmLabel: 'Freeze',
        tone: 'warning' as const,
      },
    },
    {
      id: 'unfreeze',
      label: 'Unfreeze',
      icon: 'lock_open',
      tone: 'success' as const,
      permissions: [PERMISSIONS.wallet.unfreeze],
    },
  ];

  constructor() {
    super();
    this.initialise();
    this.loadSummary();
  }

  protected fetch(query: PageQuery): Observable<Page<Wallet>> {
    return this.repository.list(query);
  }

  private loadSummary(): void {
    this.repository.statistics().subscribe((metrics) => this.summary.set(metrics));
  }

  protected refreshAll(): void {
    this.reload();
    this.loadSummary();
  }

  protected onHeaderAction(action: string): void {
    switch (action) {
      case 'transactions':
        void this.router.navigate(['/wallet/transactions']);
        break;
      case 'settlement':
        void this.router.navigate(['/wallet/settlement']);
        break;
      case 'transfer':
        void this.router.navigate(['/wallet/transfer']);
        break;
      default:
        break;
    }
  }

  protected onRowAction(event: TableActionEvent<Wallet>): void {
    const { action, row } = event;
    const actor = this.auth.user()?.fullName ?? 'Finance';

    switch (action) {
      case 'transactions':
        void this.router.navigate(['/wallet/transactions'], { queryParams: { walletId: row.id } });
        break;
      case 'transfer':
        void this.router.navigate(['/wallet/transfer'], { queryParams: { from: row.id } });
        break;
      case 'freeze':
        this.confirm
          .open({
            title: 'Freeze this wallet?',
            message: `${row.ownerName} will be unable to transact. Held funds remain reserved.`,
            detail: `Current balance ${row.balance.toLocaleString()} ₭.`,
            confirmLabel: 'Freeze wallet',
            tone: 'warning',
            icon: 'ac_unit',
            requireReason: true,
            reasonLabel: 'Reason (recorded in the audit trail)',
          })
          .subscribe((result) => {
            if (result.confirmed && result.reason) {
              this.repository.freeze(row.id, result.reason, actor).subscribe(() => {
                this.toast.success('Wallet frozen', row.ownerName);
                this.refreshAll();
              });
            }
          });
        break;
      case 'unfreeze':
        this.repository.unfreeze(row.id).subscribe(() => {
          this.toast.success('Wallet unfrozen', row.ownerName);
          this.refreshAll();
        });
        break;
      default:
        break;
    }
  }

  protected onBulkAction(event: BulkActionEvent<Wallet>): void {
    const ids = event.rows.map((row) => row.id);
    const status = event.action === 'freeze' ? WalletStatus.Frozen : WalletStatus.Active;

    this.repository.bulkPatch(ids, { status }).subscribe(() => {
      this.toast.success(`${ids.length} wallet(s) updated`);
      this.refreshAll();
    });
  }
}
