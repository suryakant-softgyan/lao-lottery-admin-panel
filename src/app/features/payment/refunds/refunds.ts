import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { AuthService } from '@core/authentication/auth.service';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { REFUND_STATUS_MAP, toOptions } from '@core/constants/status-maps.constants';
import { RefundStatus } from '@core/enums';
import type { Page, PageQuery, Refund } from '@core/models';
import type { BulkActionEvent, TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { ConfirmService } from '@core/services/confirm.service';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { PaymentRepository } from '../data/payment.repository';

/** Refund request worklist: approve, process or reject with a reason. */
@Component({
  selector: 'll-refunds',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Refunds"
        eyebrow="Finance"
        subtitle="Refund requests raised against gateway payments, from request through to completion."
        icon="undo"
        [stats]="[{ label: 'Refunds', value: total().toLocaleString(), icon: 'undo' }]"
        [actions]="[
          { id: 'back', label: 'Transactions', icon: 'payments', variant: 'secondary' },
          { id: 'reconciliation', label: 'Reconciliation', icon: 'rule', variant: 'primary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      <ll-list-toolbar
        searchPlaceholder="Search by refund reference, payment reference or customer…"
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
        tableId="refunds"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [bulkActions]="bulkActions"
        emptyTitle="No refunds"
        emptyMessage="Refund requests raised by support or finance appear here."
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
export class Refunds extends ListPageBase<Refund> {
  private readonly repository = inject(PaymentRepository);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly entityLabel = 'Refunds';

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'status', label: 'Status', icon: 'flag', options: toOptions(REFUND_STATUS_MAP) },
  ];

  protected readonly columns: TableColumn<Refund>[] = [
    {
      key: 'reference',
      label: 'Refund',
      sortable: true,
      sticky: 'start',
      minWidth: 180,
      locked: true,
      subLabel: (row) => row.paymentReference,
      cellClass: () => 'll-mono',
    },
    { key: 'customerName', label: 'Customer', sortable: true, minWidth: 190 },
    { key: 'amount', label: 'Amount', type: 'currency', sortable: true, minWidth: 150 },
    { key: 'reason', label: 'Reason', sortable: true, minWidth: 200 },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: REFUND_STATUS_MAP,
      minWidth: 150,
    },
    { key: 'requestedBy', label: 'Requested by', sortable: true, minWidth: 180 },
    { key: 'requestedAt', label: 'Requested', type: 'datetime', sortable: true, minWidth: 170 },
    { key: 'approvedBy', label: 'Approved by', minWidth: 180 },
    { key: 'completedAt', label: 'Completed', type: 'relative', sortable: true, minWidth: 150 },
    { key: 'remarks', label: 'Remarks', minWidth: 240 },
  ];

  protected readonly rowActions: TableAction<Refund>[] = [
    {
      id: 'approve',
      label: 'Approve refund',
      icon: 'thumb_up',
      tone: 'success',
      primary: true,
      permissions: [PERMISSIONS.payment.refund],
      visible: (row) => row.status === RefundStatus.Requested,
    },
    {
      id: 'complete',
      label: 'Mark completed',
      icon: 'task_alt',
      tone: 'success',
      permissions: [PERMISSIONS.payment.refund],
      visible: (row) => row.status === RefundStatus.Approved || row.status === RefundStatus.Processing,
    },
    {
      id: 'reject',
      label: 'Reject refund',
      icon: 'block',
      tone: 'danger',
      permissions: [PERMISSIONS.payment.refund],
      visible: (row) => row.status === RefundStatus.Requested,
      divider: true,
    },
    { id: 'payment', label: 'Open payment', icon: 'payments' },
  ];

  protected readonly bulkActions = [
    {
      id: 'approve',
      label: 'Approve',
      icon: 'thumb_up',
      tone: 'success' as const,
      permissions: [PERMISSIONS.payment.refund],
      confirm: {
        title: 'Approve selected refunds?',
        message: '{count} refund(s) will be approved and queued for processing.',
        confirmLabel: 'Approve',
        tone: 'primary' as const,
      },
    },
  ];

  constructor() {
    super();
    this.patchQuery({ sort: { active: 'requestedAt', direction: 'desc' as never } });
    this.initialise();
  }

  protected fetch(query: PageQuery): Observable<Page<Refund>> {
    return this.repository.refunds(query);
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/payment']);
    } else if (action === 'reconciliation') {
      void this.router.navigate(['/payment/reconciliation']);
    }
  }

  protected onRowAction(event: TableActionEvent<Refund>): void {
    const { action, row } = event;
    const actor = this.auth.user()?.fullName ?? 'Finance';

    switch (action) {
      case 'approve':
        this.confirm.confirmApproval('refund', row.reference).subscribe((result) => {
          if (result.confirmed) {
            this.repository
              .decideRefund(row.id, RefundStatus.Approved, actor, result.reason)
              .subscribe(() => {
                this.toast.success('Refund approved', row.reference);
                this.reload();
              });
          }
        });
        break;
      case 'complete':
        this.confirm
          .ask({
            title: 'Mark this refund as completed?',
            message: `Confirm that ${row.amount.toLocaleString()} ₭ has been returned to ${row.customerName}.`,
            confirmLabel: 'Mark completed',
            tone: 'success',
            icon: 'task_alt',
          })
          .subscribe((confirmed) => {
            if (confirmed) {
              this.repository.decideRefund(row.id, RefundStatus.Completed, actor).subscribe(() => {
                this.toast.success('Refund completed', row.reference);
                this.reload();
              });
            }
          });
        break;
      case 'reject':
        this.confirm.confirmRejection('refund', row.reference).subscribe((result) => {
          if (result.confirmed && result.reason) {
            this.repository
              .decideRefund(row.id, RefundStatus.Rejected, actor, result.reason)
              .subscribe(() => {
                this.toast.success('Refund rejected', row.reference);
                this.reload();
              });
          }
        });
        break;
      case 'payment':
        void this.router.navigate(['/payment'], { queryParams: { search: row.paymentReference } });
        break;
      default:
        break;
    }
  }

  protected onBulkAction(event: BulkActionEvent<Refund>): void {
    if (event.action !== 'approve') {
      return;
    }
    const actor = this.auth.user()?.fullName ?? 'Finance';
    let completed = 0;

    for (const row of event.rows) {
      this.repository.decideRefund(row.id, RefundStatus.Approved, actor).subscribe(() => {
        completed++;
        if (completed === event.rows.length) {
          this.toast.success(`${completed} refund(s) approved`);
          this.reload();
        }
      });
    }
  }
}
