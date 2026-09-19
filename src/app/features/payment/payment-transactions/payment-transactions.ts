import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { PERMISSIONS } from '@core/constants/permission.constants';
import {
  PAYMENT_METHOD_MAP,
  RECONCILIATION_STATUS_MAP,
  TRANSACTION_DIRECTION_MAP,
  TRANSACTION_STATUS_MAP,
  toOptions,
} from '@core/constants/status-maps.constants';
import { TransactionStatus } from '@core/enums';
import type { Page, PageQuery, PaymentTransaction, StatMetric } from '@core/models';
import type { BulkActionEvent, TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatCard } from '@shared/components/stat-card/stat-card';
import { PaymentRepository } from '../data/payment.repository';

/** Gateway transaction register with retry and reconciliation actions. */
@Component({
  selector: 'll-payment-transactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable, StatCard],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Payment Transactions"
        eyebrow="Finance"
        subtitle="Every gateway transaction with its settlement and reconciliation position."
        icon="payments"
        [stats]="[
          { label: 'Transactions', value: total().toLocaleString(), icon: 'payments' },
          { label: 'Selected', value: selected().length.toString(), icon: 'check_circle' },
        ]"
        [actions]="[
          { id: 'gateways', label: 'Gateways', icon: 'hub', variant: 'secondary' },
          { id: 'refunds', label: 'Refunds', icon: 'undo', variant: 'secondary' },
          { id: 'reconciliation', label: 'Reconciliation', icon: 'rule', variant: 'primary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      @if (summary().length) {
        <section class="ll-grid ll-grid--auto ll-stagger" aria-label="Payment statistics">
          @for (metric of summary(); track metric.id) {
            <ll-stat-card [metric]="metric" [currency]="metric.id === 'volume' || metric.id === 'fees'" />
          }
        </section>
      }

      <ll-list-toolbar
        searchPlaceholder="Search by reference, gateway reference, customer or account…"
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
        tableId="payment-transactions"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [bulkActions]="bulkActions"
        emptyTitle="No payment transactions"
        emptyMessage="Gateway traffic appears here as soon as payments start flowing."
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
export class PaymentTransactions extends ListPageBase<PaymentTransaction> {
  private readonly repository = inject(PaymentRepository);
  private readonly router = inject(Router);

  protected readonly entityLabel = 'Payment Transactions';
  protected readonly summary = signal<StatMetric[]>([]);

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'status', label: 'Status', icon: 'flag', options: toOptions(TRANSACTION_STATUS_MAP) },
    { key: 'method', label: 'Method', icon: 'credit_card', options: toOptions(PAYMENT_METHOD_MAP) },
    {
      key: 'reconciliationStatus',
      label: 'Reconciliation',
      icon: 'rule',
      options: toOptions(RECONCILIATION_STATUS_MAP),
    },
    {
      key: 'direction',
      label: 'Direction',
      icon: 'swap_vert',
      options: toOptions(TRANSACTION_DIRECTION_MAP),
    },
  ];

  protected readonly columns: TableColumn<PaymentTransaction>[] = [
    {
      key: 'reference',
      label: 'Reference',
      sortable: true,
      sticky: 'start',
      minWidth: 190,
      locked: true,
      subLabel: (row) => row.gatewayReference ?? '—',
      cellClass: () => 'll-mono',
    },
    {
      key: 'customerName',
      label: 'Customer',
      sortable: true,
      minWidth: 190,
      subLabel: (row) => row.customerPhone,
    },
    { key: 'gatewayName', label: 'Gateway', sortable: true, minWidth: 170 },
    {
      key: 'method',
      label: 'Method',
      type: 'badge',
      sortable: true,
      badgeMap: PAYMENT_METHOD_MAP,
      minWidth: 170,
    },
    {
      key: 'direction',
      label: 'Direction',
      type: 'badge',
      badgeMap: TRANSACTION_DIRECTION_MAP,
      minWidth: 130,
    },
    { key: 'amount', label: 'Amount', type: 'currency', sortable: true, minWidth: 150 },
    { key: 'fee', label: 'Fee', type: 'currency', sortable: true, minWidth: 120 },
    { key: 'netAmount', label: 'Net', type: 'currency', sortable: true, minWidth: 150 },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: TRANSACTION_STATUS_MAP,
      minWidth: 150,
    },
    {
      key: 'reconciliationStatus',
      label: 'Reconciliation',
      type: 'badge',
      sortable: true,
      badgeMap: RECONCILIATION_STATUS_MAP,
      minWidth: 160,
    },
    { key: 'bankName', label: 'Bank', minWidth: 200 },
    { key: 'failureReason', label: 'Failure reason', minWidth: 220 },
    { key: 'retryCount', label: 'Retries', type: 'number', sortable: true, minWidth: 100 },
    { key: 'initiatedAt', label: 'Initiated', type: 'datetime', sortable: true, minWidth: 175 },
  ];

  protected readonly rowActions: TableAction<PaymentTransaction>[] = [
    {
      id: 'retry',
      label: 'Retry payment',
      icon: 'restart_alt',
      tone: 'warning',
      primary: true,
      permissions: [PERMISSIONS.payment.retry],
      visible: (row) => row.status === TransactionStatus.Failed,
      confirm: {
        title: 'Retry this payment?',
        message: 'The transaction will be resubmitted to the gateway.',
        confirmLabel: 'Retry',
        tone: 'warning',
      },
    },
    {
      id: 'reconcile',
      label: 'Mark reconciled',
      icon: 'rule',
      tone: 'success',
      permissions: [PERMISSIONS.payment.reconcile],
    },
    {
      id: 'refund',
      label: 'Raise refund',
      icon: 'undo',
      tone: 'danger',
      permissions: [PERMISSIONS.payment.refund],
      visible: (row) => row.status === TransactionStatus.Success,
    },
    { id: 'audit', label: 'View in audit trail', icon: 'gavel', divider: true },
  ];

  protected readonly bulkActions = [
    {
      id: 'reconcile',
      label: 'Mark reconciled',
      icon: 'rule',
      tone: 'success' as const,
      permissions: [PERMISSIONS.payment.reconcile],
      confirm: {
        title: 'Mark selected as reconciled?',
        message: '{count} transaction(s) will be flagged as matched against the gateway statement.',
        confirmLabel: 'Mark reconciled',
        tone: 'primary' as const,
      },
    },
  ];

  constructor() {
    super();
    this.patchQuery({ sort: { active: 'initiatedAt', direction: 'desc' as never } });
    this.initialise();
    this.loadSummary();
  }

  protected fetch(query: PageQuery): Observable<Page<PaymentTransaction>> {
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
      case 'gateways':
        void this.router.navigate(['/payment/gateways']);
        break;
      case 'refunds':
        void this.router.navigate(['/payment/refunds']);
        break;
      case 'reconciliation':
        void this.router.navigate(['/payment/reconciliation']);
        break;
      default:
        break;
    }
  }

  protected onRowAction(event: TableActionEvent<PaymentTransaction>): void {
    const { action, row } = event;

    switch (action) {
      case 'retry':
        this.repository.retry(row.id).subscribe(() => {
          this.toast.success('Payment resubmitted', row.reference);
          this.refreshAll();
        });
        break;
      case 'reconcile':
        this.repository.markReconciled(row.id).subscribe(() => {
          this.toast.success('Marked as reconciled', row.reference);
          this.reload();
        });
        break;
      case 'refund':
        void this.router.navigate(['/payment/refunds'], {
          queryParams: { search: row.reference },
        });
        break;
      case 'audit':
        void this.router.navigate(['/audit/transaction'], {
          queryParams: { search: row.reference },
        });
        break;
      default:
        break;
    }
  }

  protected onBulkAction(event: BulkActionEvent<PaymentTransaction>): void {
    if (event.action !== 'reconcile') {
      return;
    }
    let completed = 0;
    for (const row of event.rows) {
      this.repository.markReconciled(row.id).subscribe(() => {
        completed++;
        if (completed === event.rows.length) {
          this.toast.success(`${completed} transaction(s) reconciled`);
          this.refreshAll();
        }
      });
    }
  }
}
