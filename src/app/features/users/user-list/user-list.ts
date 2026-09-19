import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { PermissionService } from '@core/authentication/permission.service';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { KYC_STATUS_MAP, ROLE_MAP, USER_STATUS_MAP, toOptions } from '@core/constants/status-maps.constants';
import { UserStatus } from '@core/enums';
import type { Page, PageQuery, StatMetric, User } from '@core/models';
import type { BulkActionEvent, TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { ConfirmService } from '@core/services/confirm.service';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatCard } from '@shared/components/stat-card/stat-card';
import { UserRepository } from '../data/user.repository';

/**
 * User management list.
 *
 * A representative example of the list-page pattern used across the portal:
 * {@link ListPageBase} owns the query lifecycle, {@link ListToolbar} owns
 * search and filters, and {@link DataTable} owns presentation — this class only
 * declares columns, actions and what each action does.
 */
@Component({
  selector: 'll-user-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable, StatCard],
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
})
export class UserList extends ListPageBase<User> {
  private readonly repository = inject(UserRepository);
  private readonly confirm = inject(ConfirmService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);

  protected readonly entityLabel = 'Users';

  protected readonly summary = signal<StatMetric[]>([]);

  protected readonly canCreate = computed(() => this.permissions.has(PERMISSIONS.users.create));

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'status', label: 'Status', icon: 'flag', options: toOptions(USER_STATUS_MAP) },
    { key: 'primaryRole', label: 'Role', icon: 'badge', options: toOptions(ROLE_MAP) },
    { key: 'kycStatus', label: 'Verification', icon: 'verified_user', options: toOptions(KYC_STATUS_MAP) },
  ];

  protected readonly columns: TableColumn<User>[] = [
    {
      key: 'fullName',
      label: 'User',
      type: 'avatar',
      sortable: true,
      searchable: true,
      sticky: 'start',
      minWidth: 230,
      locked: true,
      avatarUrl: (row) => row.avatarUrl,
      subLabel: (row) => `${row.code} · ${row.username}`,
    },
    { key: 'email', label: 'Email', sortable: true, minWidth: 200 },
    { key: 'phone', label: 'Phone', minWidth: 150 },
    {
      key: 'primaryRole',
      label: 'Role',
      type: 'badge',
      sortable: true,
      badgeMap: ROLE_MAP,
      filterable: true,
      minWidth: 150,
    },
    { key: 'department', label: 'Department', sortable: true, minWidth: 150 },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: USER_STATUS_MAP,
      filterable: true,
      minWidth: 130,
    },
    {
      key: 'kycStatus',
      label: 'KYC',
      type: 'badge',
      sortable: true,
      badgeMap: KYC_STATUS_MAP,
      minWidth: 140,
    },
    { key: 'lastLoginAt', label: 'Last sign-in', type: 'relative', sortable: true, minWidth: 150 },
    { key: 'createdAt', label: 'Created', type: 'date', sortable: true, minWidth: 130 },
  ];

  protected readonly rowActions: TableAction<User>[] = [
    { id: 'view', label: 'View details', icon: 'visibility', primary: true, tone: 'primary' },
    {
      id: 'edit',
      label: 'Edit user',
      icon: 'edit',
      permissions: [PERMISSIONS.users.update],
    },
    {
      id: 'reset-password',
      label: 'Reset password',
      icon: 'lock_reset',
      permissions: [PERMISSIONS.users.resetPassword],
      confirm: {
        title: 'Reset password?',
        message: 'A one-time password will be sent to the user and they must change it at next sign-in.',
        confirmLabel: 'Send reset',
        tone: 'warning',
      },
    },
    {
      id: 'suspend',
      label: 'Suspend account',
      icon: 'pause_circle',
      tone: 'warning',
      permissions: [PERMISSIONS.users.suspend],
      visible: (row) => row.status === UserStatus.Active,
      divider: true,
    },
    {
      id: 'activate',
      label: 'Reactivate account',
      icon: 'play_circle',
      tone: 'success',
      permissions: [PERMISSIONS.users.suspend],
      visible: (row) => row.status !== UserStatus.Active,
    },
    {
      id: 'block',
      label: 'Block account',
      icon: 'block',
      tone: 'danger',
      permissions: [PERMISSIONS.users.suspend],
      visible: (row) => row.status !== UserStatus.Blocked,
    },
    {
      id: 'delete',
      label: 'Delete user',
      icon: 'delete',
      tone: 'danger',
      permissions: [PERMISSIONS.users.delete],
    },
  ];

  protected readonly bulkActions = [
    {
      id: 'activate',
      label: 'Activate',
      icon: 'check_circle',
      tone: 'success' as const,
      permissions: [PERMISSIONS.users.update],
    },
    {
      id: 'suspend',
      label: 'Suspend',
      icon: 'pause_circle',
      tone: 'warning' as const,
      permissions: [PERMISSIONS.users.suspend],
      confirm: {
        title: 'Suspend selected users?',
        message: '{count} account(s) will be suspended and signed out immediately.',
        confirmLabel: 'Suspend',
        tone: 'warning' as const,
      },
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: 'delete',
      tone: 'danger' as const,
      permissions: [PERMISSIONS.users.delete],
      confirm: {
        title: 'Delete selected users?',
        message: '{count} account(s) will be permanently removed. This is recorded in the audit trail.',
        confirmLabel: 'Delete',
        tone: 'danger' as const,
      },
    },
  ];

  constructor() {
    super();
    this.initialise();
    this.loadSummary();
  }

  protected fetch(query: PageQuery): Observable<Page<User>> {
    return this.repository.list(query);
  }

  private loadSummary(): void {
    this.repository.statistics().subscribe((stats) => {
      this.summary.set(
        stats.map((stat) => ({
          id: stat.label,
          label: stat.label,
          value: stat.value,
          icon: stat.icon,
          tone: stat.tone as StatMetric['tone'],
        })),
      );
    });
  }

  protected onHeaderAction(action: string): void {
    switch (action) {
      case 'create':
        void this.router.navigate(['/users/create']);
        break;
      case 'roles':
        void this.router.navigate(['/users/roles']);
        break;
      case 'verification':
        void this.router.navigate(['/users/verification']);
        break;
      case 'refresh':
        this.reload();
        this.loadSummary();
        break;
      default:
        break;
    }
  }

  protected onRowAction(event: TableActionEvent<User>): void {
    const { action, row } = event;

    switch (action) {
      case 'view':
        void this.router.navigate(['/users/details', row.id]);
        break;
      case 'edit':
        void this.router.navigate(['/users/edit', row.id]);
        break;
      case 'reset-password':
        this.repository.resetPassword(row.id).subscribe(() => {
          this.toast.success('Password reset sent', `${row.fullName} will receive a one-time password.`);
        });
        break;
      case 'suspend':
        this.changeStatus(row, UserStatus.Suspended, 'Suspend account');
        break;
      case 'activate':
        this.repository.setStatus(row.id, UserStatus.Active).subscribe(() => {
          this.toast.success('Account reactivated', row.fullName);
          this.refreshAll();
        });
        break;
      case 'block':
        this.changeStatus(row, UserStatus.Blocked, 'Block account');
        break;
      case 'delete':
        this.confirm.confirmDelete('user', row.fullName).subscribe((confirmed) => {
          if (confirmed) {
            this.repository.delete(row.id).subscribe(() => {
              this.toast.success('User deleted', row.fullName);
              this.refreshAll();
            });
          }
        });
        break;
      default:
        break;
    }
  }

  protected onBulkAction(event: BulkActionEvent<User>): void {
    const ids = event.rows.map((row) => row.id);

    switch (event.action) {
      case 'activate':
        this.repository.bulkPatch(ids, { status: UserStatus.Active }).subscribe(() => {
          this.toast.success(`${ids.length} account(s) activated`);
          this.refreshAll();
        });
        break;
      case 'suspend':
        this.repository.bulkPatch(ids, { status: UserStatus.Suspended }).subscribe(() => {
          this.toast.success(`${ids.length} account(s) suspended`);
          this.refreshAll();
        });
        break;
      case 'delete':
        this.repository.deleteMany(ids).subscribe(() => {
          this.toast.success(`${ids.length} account(s) deleted`);
          this.refreshAll();
        });
        break;
      default:
        break;
    }
  }

  protected onRowClick(row: User): void {
    void this.router.navigate(['/users/details', row.id]);
  }

  /** Status changes capture a reason, which lands in the audit trail. */
  private changeStatus(row: User, status: UserStatus, title: string): void {
    this.confirm
      .open({
        title: `${title}?`,
        message: `${row.fullName} will lose access immediately and any active session will be terminated.`,
        confirmLabel: title,
        tone: status === UserStatus.Blocked ? 'danger' : 'warning',
        icon: status === UserStatus.Blocked ? 'block' : 'pause_circle',
        requireReason: true,
        reasonLabel: 'Reason (recorded in the audit trail)',
      })
      .subscribe((result) => {
        if (result.confirmed) {
          this.repository.setStatus(row.id, status, result.reason).subscribe(() => {
            this.toast.success(`${title} complete`, row.fullName);
            this.refreshAll();
          });
        }
      });
  }

  private refreshAll(): void {
    this.reload();
    this.loadSummary();
  }
}
