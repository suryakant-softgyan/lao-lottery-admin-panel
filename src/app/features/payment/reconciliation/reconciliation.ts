import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { AuthService } from '@core/authentication/auth.service';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { RECONCILIATION_STATUS_MAP, toOptions } from '@core/constants/status-maps.constants';
import { ReconciliationStatus } from '@core/enums';
import type { Page, PageQuery, ReconciliationRecord } from '@core/models';
import type { TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { ConfirmService } from '@core/services/confirm.service';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { PaymentRepository } from '../data/payment.repository';

/**
 * Gateway reconciliation batches.
 *
 * Compares what the platform recorded against what the gateway settled. The
 * variance column is the one that matters — anything non-zero needs a person.
 */
@Component({
  selector: 'll-reconciliation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Reconciliation"
        eyebrow="Finance"
        subtitle="Daily gateway statements matched against the platform ledger. Investigate any variance."
        icon="rule"
        [stats]="[{ label: 'Batches', value: total().toLocaleString(), icon: 'rule' }]"
        [actions]="[
          { id: 'back', label: 'Transactions', icon: 'payments', variant: 'secondary' },
          { id: 'gateways', label: 'Gateways', icon: 'hub', variant: 'primary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      <ll-list-toolbar
        searchPlaceholder="Search by batch reference or gateway…"
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
        tableId="reconciliation"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [selectable]="false"
        emptyTitle="No reconciliation batches"
        emptyMessage="Batches are created automatically when a gateway statement arrives."
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
export class Reconciliation extends ListPageBase<ReconciliationRecord> {
  private readonly repository = inject(PaymentRepository);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly entityLabel = 'Reconciliation';

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'status', label: 'Status', icon: 'flag', options: toOptions(RECONCILIATION_STATUS_MAP) },
  ];

  protected readonly columns: TableColumn<ReconciliationRecord>[] = [
    {
      key: 'batchReference',
      label: 'Batch',
      sortable: true,
      sticky: 'start',
      minWidth: 180,
      locked: true,
      subLabel: (row) => row.gatewayName,
      cellClass: () => 'll-mono',
    },
    { key: 'statementDate', label: 'Statement date', type: 'date', sortable: true, minWidth: 160 },
    { key: 'systemCount', label: 'System count', type: 'number', sortable: true, minWidth: 150 },
    { key: 'gatewayCount', label: 'Gateway count', type: 'number', sortable: true, minWidth: 155 },
    { key: 'matchedCount', label: 'Matched', type: 'number', sortable: true, minWidth: 130 },
    { key: 'unmatchedCount', label: 'Unmatched', type: 'number', sortable: true, minWidth: 140 },
    { key: 'systemAmount', label: 'System value', type: 'currency', sortable: true, minWidth: 170 },
    { key: 'gatewayAmount', label: 'Gateway value', type: 'currency', sortable: true, minWidth: 175 },
    {
      key: 'varianceAmount',
      label: 'Variance',
      type: 'currency',
      sortable: true,
      minWidth: 160,
      // Non-zero variance is what an operator scans for, so colour it.
      cellClass: (row) => (row.varianceAmount === 0 ? 'll-tone-success' : 'll-tone-danger'),
    },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: RECONCILIATION_STATUS_MAP,
      minWidth: 160,
    },
    { key: 'reconciledBy', label: 'Reconciled by', minWidth: 180 },
    { key: 'remarks', label: 'Remarks', minWidth: 260 },
  ];

  protected readonly rowActions: TableAction<ReconciliationRecord>[] = [
    {
      id: 'resolve',
      label: 'Resolve batch',
      icon: 'task_alt',
      tone: 'success',
      primary: true,
      permissions: [PERMISSIONS.payment.reconcile],
      visible: (row) =>
        row.status !== ReconciliationStatus.Resolved && row.status !== ReconciliationStatus.Matched,
    },
    { id: 'transactions', label: 'View gateway transactions', icon: 'payments' },
  ];

  constructor() {
    super();
    this.patchQuery({ sort: { active: 'statementDate', direction: 'desc' as never } });
    this.initialise();
  }

  protected fetch(query: PageQuery): Observable<Page<ReconciliationRecord>> {
    return this.repository.reconciliations(query);
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/payment']);
    } else if (action === 'gateways') {
      void this.router.navigate(['/payment/gateways']);
    }
  }

  protected onRowAction(event: TableActionEvent<ReconciliationRecord>): void {
    const { action, row } = event;

    if (action === 'transactions') {
      void this.router.navigate(['/payment'], { queryParams: { search: row.gatewayName } });
      return;
    }

    if (action === 'resolve') {
      this.confirm
        .open({
          title: 'Resolve this reconciliation batch?',
          message: `Confirm that the ${Math.abs(row.varianceAmount).toLocaleString()} ₭ variance on ${row.batchReference} has been explained.`,
          detail: `${row.unmatchedCount} unmatched transaction(s) across ${row.systemCount} records.`,
          confirmLabel: 'Resolve batch',
          tone: 'primary',
          icon: 'task_alt',
          requireReason: true,
          reasonLabel: 'Explanation for the variance',
        })
        .subscribe((result) => {
          if (result.confirmed && result.reason) {
            this.repository
              .resolveReconciliation(row.id, this.auth.user()?.fullName ?? 'Finance', result.reason)
              .subscribe(() => {
                this.toast.success('Batch resolved', row.batchReference);
                this.reload();
              });
          }
        });
    }
  }
}
