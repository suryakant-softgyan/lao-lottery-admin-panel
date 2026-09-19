import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { PERMISSIONS } from '@core/constants/permission.constants';
import { KYC_STATUS_MAP, ROLE_MAP, USER_STATUS_MAP, toOptions } from '@core/constants/status-maps.constants';
import type { Page, PageQuery, User } from '@core/models';
import type { BulkActionEvent, TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { KycStatus } from '@core/enums';
import { ConfirmService } from '@core/services/confirm.service';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { UserRepository } from '../data/user.repository';

/**
 * KYC verification queue.
 *
 * A focused worklist: only accounts awaiting a decision, with approve/reject as
 * the primary row actions. Rejection requires a reason, which is written to the
 * audit trail and returned to the applicant.
 */
@Component({
  selector: 'll-verification-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Verification Queue"
        eyebrow="Compliance"
        subtitle="Accounts awaiting identity verification. Approve to activate, or reject with a reason."
        icon="verified_user"
        [stats]="[{ label: 'Awaiting decision', value: total().toString(), icon: 'pending_actions' }]"
        [actions]="[{ id: 'back', label: 'All users', icon: 'group', variant: 'secondary' }]"
        (actionSelected)="onHeaderAction($event)" />

      <ll-list-toolbar
        searchPlaceholder="Search by name, email or national ID…"
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
        tableId="verification-queue"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [bulkActions]="bulkActions"
        emptyTitle="Queue is clear"
        emptyMessage="Every submitted verification has been processed."
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
export class VerificationQueue extends ListPageBase<User> {
  private readonly repository = inject(UserRepository);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  protected readonly entityLabel = 'Verification Queue';

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'kycStatus', label: 'Verification', icon: 'verified_user', options: toOptions(KYC_STATUS_MAP) },
    { key: 'primaryRole', label: 'Role', icon: 'badge', options: toOptions(ROLE_MAP) },
  ];

  protected readonly columns: TableColumn<User>[] = [
    {
      key: 'fullName',
      label: 'Applicant',
      type: 'avatar',
      sortable: true,
      sticky: 'start',
      minWidth: 230,
      locked: true,
      avatarUrl: (row) => row.avatarUrl,
      subLabel: (row) => row.email,
    },
    { key: 'nationalId', label: 'National ID', minWidth: 150 },
    { key: 'phone', label: 'Phone', minWidth: 150 },
    { key: 'primaryRole', label: 'Role', type: 'badge', badgeMap: ROLE_MAP, minWidth: 140 },
    {
      key: 'documents.length',
      label: 'Documents',
      type: 'number',
      value: (row) => row.documents.length,
      minWidth: 110,
    },
    {
      key: 'kycStatus',
      label: 'Verification',
      type: 'badge',
      sortable: true,
      badgeMap: KYC_STATUS_MAP,
      minWidth: 150,
    },
    { key: 'status', label: 'Account', type: 'badge', badgeMap: USER_STATUS_MAP, minWidth: 130 },
    { key: 'createdAt', label: 'Submitted', type: 'relative', sortable: true, minWidth: 140 },
  ];

  protected readonly rowActions: TableAction<User>[] = [
    { id: 'view', label: 'Review documents', icon: 'folder_open', primary: true, tone: 'primary' },
    {
      id: 'approve',
      label: 'Approve verification',
      icon: 'verified',
      tone: 'success',
      permissions: [PERMISSIONS.users.approve],
    },
    {
      id: 'reject',
      label: 'Reject verification',
      icon: 'block',
      tone: 'danger',
      permissions: [PERMISSIONS.users.approve],
    },
  ];

  protected readonly bulkActions = [
    {
      id: 'approve',
      label: 'Approve selected',
      icon: 'verified',
      tone: 'success' as const,
      permissions: [PERMISSIONS.users.approve],
      confirm: {
        title: 'Approve selected applications?',
        message: '{count} account(s) will be verified and activated immediately.',
        confirmLabel: 'Approve',
        tone: 'primary' as const,
      },
    },
  ];

  constructor() {
    super();
    this.initialise();
  }

  protected fetch(query: PageQuery): Observable<Page<User>> {
    return this.repository.verificationQueue(query);
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/users']);
    }
  }

  protected openDetail(row: User): void {
    void this.router.navigate(['/users/details', row.id]);
  }

  protected onRowAction(event: TableActionEvent<User>): void {
    const { action, row } = event;

    switch (action) {
      case 'view':
        this.openDetail(row);
        break;
      case 'approve':
        this.confirm.confirmApproval('verification', row.fullName).subscribe((result) => {
          if (result.confirmed) {
            this.repository.approveKyc(row.id, result.reason).subscribe(() => {
              this.toast.success('Verification approved', row.fullName);
              this.reload();
            });
          }
        });
        break;
      case 'reject':
        this.confirm.confirmRejection('verification', row.fullName).subscribe((result) => {
          if (result.confirmed && result.reason) {
            this.repository.rejectKyc(row.id, result.reason).subscribe(() => {
              this.toast.success('Verification rejected', row.fullName);
              this.reload();
            });
          }
        });
        break;
      default:
        break;
    }
  }

  protected onBulkAction(event: BulkActionEvent<User>): void {
    if (event.action !== 'approve') {
      return;
    }
    const ids = event.rows.map((row) => row.id);
    this.repository.bulkPatch(ids, { kycStatus: KycStatus.Approved }).subscribe(() => {
      this.toast.success(`${ids.length} verification(s) approved`);
      this.reload();
    });
  }
}
