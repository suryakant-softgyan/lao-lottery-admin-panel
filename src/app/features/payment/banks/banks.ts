import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { PERMISSIONS } from '@core/constants/permission.constants';
import type { Bank, Page, PageQuery } from '@core/models';
import type { TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { PaymentRepository } from '../data/payment.repository';

/** Partner bank register used for settlements and payouts. */
@Component({
  selector: 'll-banks',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Banks"
        eyebrow="Finance"
        subtitle="Partner banks used for settlements, payouts and customer transfers."
        icon="account_balance"
        [stats]="[{ label: 'Banks', value: total().toString(), icon: 'account_balance' }]"
        [actions]="[
          { id: 'back', label: 'Transactions', icon: 'payments', variant: 'secondary' },
          { id: 'gateways', label: 'Gateways', icon: 'hub', variant: 'primary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      <ll-list-toolbar
        searchPlaceholder="Search by bank name, code, SWIFT or contact…"
        [quickFilters]="quickFilters"
        [refreshing]="loading()"
        (searchChange)="onSearch($event)"
        (quickChange)="onQuickFilter($event)"
        (refresh)="reload()"
        (export)="onExport($event)"
        (clear)="onClearFilters()" />

      <ll-data-table
        tableId="banks"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [selectable]="false"
        emptyTitle="No banks configured"
        emptyMessage="Add a partner bank to enable settlements and payouts."
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
export class Banks extends ListPageBase<Bank> {
  private readonly repository = inject(PaymentRepository);
  private readonly router = inject(Router);

  protected readonly entityLabel = 'Banks';

  protected readonly quickFilters: QuickFilter[] = [
    {
      key: 'active',
      label: 'Availability',
      icon: 'flag',
      options: [
        { value: 'true', label: 'Active' },
        { value: 'false', label: 'Inactive' },
      ],
    },
    {
      key: 'supportsInstantTransfer',
      label: 'Instant transfer',
      icon: 'bolt',
      options: [
        { value: 'true', label: 'Supported' },
        { value: 'false', label: 'Not supported' },
      ],
    },
  ];

  protected readonly columns: TableColumn<Bank>[] = [
    {
      key: 'name',
      label: 'Bank',
      type: 'avatar',
      sortable: true,
      sticky: 'start',
      minWidth: 280,
      locked: true,
      avatarUrl: (row) => row.logoUrl,
      subLabel: (row) => row.nameLo,
    },
    { key: 'code', label: 'Code', sortable: true, minWidth: 110, cellClass: () => 'll-mono' },
    { key: 'swiftCode', label: 'SWIFT', sortable: true, minWidth: 140, cellClass: () => 'll-mono' },
    {
      key: 'settlementAccount',
      label: 'Settlement account',
      minWidth: 180,
      cellClass: () => 'll-mono',
    },
    {
      key: 'supportsInstantTransfer',
      label: 'Instant',
      type: 'boolean',
      sortable: true,
      align: 'center',
      minWidth: 110,
    },
    { key: 'transactionCount', label: 'Transactions', type: 'number', sortable: true, minWidth: 150 },
    { key: 'transactionVolume', label: 'Volume', type: 'currency', sortable: true, minWidth: 170 },
    { key: 'contactPerson', label: 'Contact', minWidth: 190, subLabel: (row) => row.contactPhone ?? '' },
    { key: 'active', label: 'Active', type: 'boolean', sortable: true, align: 'center', minWidth: 100 },
  ];

  protected readonly rowActions: TableAction<Bank>[] = [
    {
      id: 'toggle',
      label: 'Toggle availability',
      icon: 'power_settings_new',
      primary: true,
      tone: 'primary',
      permissions: [PERMISSIONS.payment.banks],
    },
    { id: 'transactions', label: 'View transactions', icon: 'payments' },
  ];

  constructor() {
    super();
    this.initialise();
  }

  protected fetch(query: PageQuery): Observable<Page<Bank>> {
    return this.repository.banks(query);
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/payment']);
    } else if (action === 'gateways') {
      void this.router.navigate(['/payment/gateways']);
    }
  }

  protected onRowAction(event: TableActionEvent<Bank>): void {
    const { action, row } = event;

    if (action === 'toggle') {
      this.repository.setBankActive(row.id, !row.active).subscribe(() => {
        this.toast.success(row.active ? 'Bank deactivated' : 'Bank activated', row.name);
        this.reload();
      });
    } else if (action === 'transactions') {
      void this.router.navigate(['/payment'], { queryParams: { search: row.name } });
    }
  }
}
