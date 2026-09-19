import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PermissionService } from '@core/authentication/permission.service';
import { PERMISSIONS } from '@core/constants/permission.constants';
import {
  DOCUMENT_STATUS_MAP,
  KYC_STATUS_MAP,
  ROLE_MAP,
  USER_STATUS_MAP,
} from '@core/constants/status-maps.constants';
import { UserStatus } from '@core/enums';
import type {
  DeviceHistoryEntry,
  LoginHistoryEntry,
  TimelineEvent,
  User,
  UserActivityEntry,
} from '@core/models';
import { BreadcrumbService } from '@core/services/breadcrumb.service';
import { ConfirmService } from '@core/services/confirm.service';
import { ToastService } from '@core/services/toast.service';
import { humanise } from '@core/utilities/format.util';
import { ActivityTimeline } from '@shared/components/activity-timeline/activity-timeline';
import { Avatar } from '@shared/components/avatar/avatar';
import { InfoList, type InfoItem } from '@shared/components/info-list/info-list';
import { PageHeader, type PageHeaderAction } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { DatePipe, RelativePipe } from '@shared/pipes/format.pipes';
import { UserRepository } from '../data/user.repository';

/**
 * User detail.
 *
 * Profile summary plus the tabs an investigator actually needs: identity,
 * documents, login history, device history and a full activity timeline.
 */
@Component({
  selector: 'll-user-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    MatTabsModule,
    MatTooltipModule,
    PageHeader,
    Avatar,
    InfoList,
    ActivityTimeline,
    StatusBadge,
    Skeleton,
    StatePanel,
    DatePipe,
    RelativePipe,
  ],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.scss',
})
export class UserDetail {
  private readonly repository = inject(UserRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly breadcrumb = inject(BreadcrumbService);
  protected readonly permissions = inject(PermissionService);

  protected readonly PERMISSIONS = PERMISSIONS;
  protected readonly roleMap = ROLE_MAP;
  protected readonly statusMap = USER_STATUS_MAP;
  protected readonly kycMap = KYC_STATUS_MAP;
  protected readonly documentStatusMap = DOCUMENT_STATUS_MAP;

  protected readonly user = signal<User | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly loginHistory = signal<LoginHistoryEntry[]>([]);
  protected readonly deviceHistory = signal<DeviceHistoryEntry[]>([]);
  protected readonly activity = signal<UserActivityEntry[]>([]);
  protected readonly timeline = signal<TimelineEvent[]>([]);

  private readonly userId = this.route.snapshot.paramMap.get('id') ?? '';

  /** Identity block on the left column. */
  protected readonly identityItems = computed<InfoItem[]>(() => {
    const user = this.user();
    if (!user) {
      return [];
    }
    return [
      { label: 'User code', value: user.code, icon: 'tag', mono: true },
      { label: 'Username', value: user.username, icon: 'person', mono: true },
      { label: 'Email', value: user.email, icon: 'mail' },
      { label: 'Phone', value: user.phone, icon: 'phone' },
      { label: 'Gender', value: humanise(user.gender), icon: 'wc' },
      { label: 'Date of birth', value: user.dateOfBirth, icon: 'cake' },
      { label: 'National ID', value: user.nationalId, icon: 'badge', mono: true },
      { label: 'Language', value: user.language === 'lo' ? 'Lao' : 'English', icon: 'translate' },
      { label: 'Time zone', value: user.timezone, icon: 'schedule' },
    ];
  });

  protected readonly organisationItems = computed<InfoItem[]>(() => {
    const user = this.user();
    if (!user) {
      return [];
    }
    return [
      { label: 'Account type', value: humanise(user.type), icon: 'category' },
      { label: 'Primary role', value: user.primaryRole, icon: 'admin_panel_settings', badgeMap: ROLE_MAP },
      { label: 'Status', value: user.status, icon: 'flag', badgeMap: USER_STATUS_MAP },
      { label: 'Verification', value: user.kycStatus, icon: 'verified_user', badgeMap: KYC_STATUS_MAP },
      { label: 'Department', value: user.department, icon: 'apartment' },
      { label: 'Designation', value: user.designation, icon: 'work' },
      { label: 'Two-factor', value: user.twoFactorEnabled ? 'Enabled' : 'Disabled', icon: 'security' },
      { label: 'Sign-ins', value: user.loginCount.toLocaleString(), icon: 'login' },
      { label: 'Last sign-in IP', value: user.lastLoginIp, icon: 'lan', mono: true },
      {
        label: 'Address',
        value: user.address
          ? [user.address.line1, user.address.district, user.address.province].filter(Boolean).join(', ')
          : '—',
        icon: 'home',
        wide: true,
      },
      { label: 'Notes', value: user.notes, icon: 'sticky_note_2', wide: true },
    ];
  });

  protected readonly headerActions = computed<PageHeaderAction[]>(() => {
    const user = this.user();
    const actions: PageHeaderAction[] = [
      { id: 'back', label: 'Back', icon: 'arrow_back', variant: 'secondary' },
    ];
    if (this.permissions.has(PERMISSIONS.users.update)) {
      actions.push({ id: 'edit', label: 'Edit', icon: 'edit', variant: 'secondary' });
    }
    if (this.permissions.has(PERMISSIONS.users.suspend) && user) {
      actions.push({
        id: user.status === UserStatus.Active ? 'suspend' : 'activate',
        label: user.status === UserStatus.Active ? 'Suspend' : 'Reactivate',
        icon: user.status === UserStatus.Active ? 'pause_circle' : 'play_circle',
        variant: 'primary',
      });
    }
    return actions;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.repository.getById(this.userId).subscribe({
      next: (user) => {
        this.user.set(user);
        this.breadcrumb.setDynamicLabel(user.fullName);
        this.loading.set(false);
        this.loadTabs();
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('This user could not be found. They may have been removed.');
      },
    });
  }

  private loadTabs(): void {
    this.repository.loginHistory(this.userId).subscribe((entries) => this.loginHistory.set(entries));
    this.repository.deviceHistory(this.userId).subscribe((entries) => this.deviceHistory.set(entries));
    this.repository.activity(this.userId).subscribe((entries) => this.activity.set(entries));
    this.repository.timeline(this.userId).subscribe((events) => this.timeline.set(events));
  }

  protected onHeaderAction(action: string): void {
    const user = this.user();
    if (!user) {
      return;
    }

    switch (action) {
      case 'back':
        void this.router.navigate(['/users']);
        break;
      case 'edit':
        void this.router.navigate(['/users/edit', user.id]);
        break;
      case 'activate':
        this.repository.setStatus(user.id, UserStatus.Active).subscribe((updated) => {
          this.user.set(updated);
          this.toast.success('Account reactivated', updated.fullName);
        });
        break;
      case 'suspend':
        this.confirm
          .open({
            title: 'Suspend this account?',
            message: `${user.fullName} will lose access immediately and any active session ends.`,
            confirmLabel: 'Suspend',
            tone: 'warning',
            icon: 'pause_circle',
            requireReason: true,
            reasonLabel: 'Reason (recorded in the audit trail)',
          })
          .subscribe((result) => {
            if (result.confirmed) {
              this.repository.setStatus(user.id, UserStatus.Suspended, result.reason).subscribe((updated) => {
                this.user.set(updated);
                this.toast.success('Account suspended', updated.fullName);
              });
            }
          });
        break;
      default:
        break;
    }
  }

  protected resetPassword(): void {
    const user = this.user();
    if (!user) {
      return;
    }
    this.confirm
      .ask({
        title: 'Reset password?',
        message: `A one-time password will be sent to ${user.email}.`,
        confirmLabel: 'Send reset',
        tone: 'warning',
        icon: 'lock_reset',
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.repository.resetPassword(user.id).subscribe(() => {
            this.toast.success('Password reset sent', user.email);
          });
        }
      });
  }
}
