import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { PLACEHOLDER } from '@core/constants/app.constants';
import { ROLE_PERMISSIONS } from '@core/constants/permission.constants';
import { KycStatus, UserStatus } from '@core/enums';
import { mockDataset } from '@core/mock/dataset';
import type {
  DeviceHistoryEntry,
  LoginHistoryEntry,
  Role,
  TimelineEvent,
  User,
  UserActivityEntry,
  UserPayload,
} from '@core/models';
import type { Page, PageQuery } from '@core/models/common.model';
import { BaseRepository } from '@core/services/base-repository';
import { MockBackendService } from '@core/services/mock-backend.service';
import { applyQuery } from '@core/utilities/query.util';
import { humanise } from '@core/utilities/format.util';

/**
 * User repository.
 *
 * Extends {@link BaseRepository}, so list/get/create/update/delete already work
 * against either the mock dataset or the REST API. Everything added here is a
 * user-specific endpoint: role lookup, verification decisions, status changes
 * and the history tabs on the detail page.
 */
@Injectable({ providedIn: 'root' })
export class UserRepository extends BaseRepository<User, UserPayload> {
  protected readonly resourcePath = 'users';

  protected override queryOptions = {
    searchFields: ['fullName', 'username', 'email', 'phone', 'code', 'nationalId', 'department'],
    dateField: 'createdAt',
  };

  private readonly mockBackend = inject(MockBackendService);

  protected seed(): User[] {
    return mockDataset.users;
  }

  /** Create needs derived fields the payload does not carry. */
  protected override buildFromPayload(payload: UserPayload): User {
    const now = new Date().toISOString();
    const fullName = `${payload.firstName} ${payload.lastName}`.trim();
    const sequence = this.records.length + 1;

    return {
      id: this.nextId(),
      code: `U-${sequence.toString().padStart(5, '0')}`,
      username: payload.username,
      firstName: payload.firstName,
      lastName: payload.lastName,
      fullName,
      displayName: fullName,
      avatarUrl: PLACEHOLDER.avatar(fullName),
      email: payload.email,
      phone: payload.phone,
      gender: payload.gender,
      dateOfBirth: payload.dateOfBirth ?? undefined,
      nationalId: payload.nationalId ?? undefined,
      type: payload.type,
      roles: payload.roles.length ? payload.roles : [payload.primaryRole],
      primaryRole: payload.primaryRole,
      permissionOverrides: payload.permissionOverrides ?? [],
      status: payload.status,
      kycStatus: KycStatus.NotSubmitted,
      emailVerified: false,
      phoneVerified: false,
      twoFactorEnabled: false,
      mustChangePassword: payload.requirePasswordChange ?? true,
      loginCount: 0,
      failedLoginAttempts: 0,
      department: payload.department ?? undefined,
      designation: payload.designation ?? undefined,
      reportsTo: payload.reportsTo ?? undefined,
      tenantId: 'lao-national-lottery',
      language: payload.language,
      timezone: payload.timezone,
      address: payload.address
        ? {
            line1: payload.address.line1 ?? '',
            district: payload.address.district ?? '',
            province: payload.address.province ?? '',
            country: payload.address.country ?? 'Lao PDR',
            ...payload.address,
          }
        : undefined,
      documents: [],
      notes: payload.notes ?? undefined,
      tags: payload.tags ?? [],
      createdAt: now,
      createdBy: 'Administrator',
      updatedAt: now,
      updatedBy: 'Administrator',
    };
  }

  protected override mergePayload(existing: User, payload: UserPayload): User {
    const fullName = `${payload.firstName} ${payload.lastName}`.trim();
    return {
      ...existing,
      ...payload,
      dateOfBirth: payload.dateOfBirth ?? undefined,
      nationalId: payload.nationalId ?? undefined,
      department: payload.department ?? undefined,
      designation: payload.designation ?? undefined,
      reportsTo: payload.reportsTo ?? undefined,
      notes: payload.notes ?? undefined,
      fullName,
      displayName: fullName,
      address: { ...existing.address, ...payload.address } as User['address'],
      updatedAt: new Date().toISOString(),
      updatedBy: 'Administrator',
    };
  }

  // ------------------------------------------------------------------- roles

  roles(): Observable<Role[]> {
    return this.backend.respond(() => mockDataset.roles);
  }

  roleById(id: string): Observable<Role> {
    const role = mockDataset.roles.find((item) => item.id === id);
    return role ? this.backend.respond(() => role) : this.backend.notFound<Role>('Role', id);
  }

  /** Persists a role's permission set from the permission-matrix screen. */
  saveRolePermissions(roleId: string, permissionCodes: string[]): Observable<Role> {
    const index = mockDataset.roles.findIndex((role) => role.id === roleId);
    if (index === -1) {
      return this.backend.notFound<Role>('Role', roleId);
    }
    return this.backend.respond(() => {
      const updated: Role = {
        ...(mockDataset.roles[index] as Role),
        permissionCodes,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Administrator',
      };
      mockDataset.roles[index] = updated;
      return updated;
    });
  }

  /** Effective permissions for a role, used to seed the matrix. */
  defaultPermissionsFor(roleCode: string): string[] {
    return ROLE_PERMISSIONS[roleCode] ?? [];
  }

  // ------------------------------------------------------- verification queue

  /** Users whose KYC needs a decision. */
  verificationQueue(query: PageQuery): Observable<Page<User>> {
    const pending = this.records.filter(
      (user) => user.kycStatus === KycStatus.Pending || user.kycStatus === KycStatus.UnderReview,
    );
    return this.mockBackend.respond(() => applyQuery(pending, query, this.queryOptions));
  }

  approveKyc(id: string, remarks?: string): Observable<User> {
    return this.patch(id, {
      kycStatus: KycStatus.Approved,
      status: UserStatus.Active,
      notes: remarks,
    } as Partial<User>);
  }

  rejectKyc(id: string, reason: string): Observable<User> {
    return this.patch(id, { kycStatus: KycStatus.Rejected, notes: reason } as Partial<User>);
  }

  setStatus(id: string, status: UserStatus, reason?: string): Observable<User> {
    return this.patch(id, { status, notes: reason } as Partial<User>);
  }

  resetPassword(id: string): Observable<{ success: boolean }> {
    void id;
    return this.backend.respond(() => ({ success: true }));
  }

  // ------------------------------------------------------------- detail tabs

  loginHistory(userId: string): Observable<LoginHistoryEntry[]> {
    return this.backend.respond(() => mockDataset.loginHistory(userId));
  }

  deviceHistory(userId: string): Observable<DeviceHistoryEntry[]> {
    return this.backend.respond(() => mockDataset.deviceHistory(userId));
  }

  activity(userId: string): Observable<UserActivityEntry[]> {
    return this.backend.respond(() => mockDataset.userActivity(userId));
  }

  /** Activity rendered as a timeline on the detail page. */
  timeline(userId: string): Observable<TimelineEvent[]> {
    return this.backend.respond(() =>
      mockDataset.userActivity(userId).map<TimelineEvent>((entry) => ({
        id: entry.id,
        title: `${entry.action} · ${entry.module}`,
        description: entry.description,
        actor: 'System',
        timestamp: entry.timestamp,
        icon: this.actionIcon(entry.action),
        tone: this.actionTone(entry.action),
        meta: { IP: entry.ipAddress },
      })),
    );
  }

  private actionIcon(action: string): string {
    switch (action.toLowerCase()) {
      case 'created':
        return 'add_circle';
      case 'updated':
        return 'edit';
      case 'deleted':
        return 'delete';
      case 'approved':
        return 'verified';
      case 'exported':
        return 'download';
      default:
        return 'visibility';
    }
  }

  private actionTone(action: string): TimelineEvent['tone'] {
    switch (action.toLowerCase()) {
      case 'created':
      case 'approved':
        return 'success';
      case 'deleted':
        return 'danger';
      case 'updated':
        return 'primary';
      default:
        return 'neutral';
    }
  }

  /** Grouped counts used by the list-page summary tiles. */
  statistics(): Observable<{ label: string; value: number; icon: string; tone: string }[]> {
    return this.backend.respond(() => {
      const users = this.records;
      const byStatus = (status: UserStatus): number => users.filter((user) => user.status === status).length;
      return [
        { label: 'Total users', value: users.length, icon: 'group', tone: 'primary' },
        { label: 'Active', value: byStatus(UserStatus.Active), icon: 'check_circle', tone: 'success' },
        { label: 'Pending', value: byStatus(UserStatus.Pending), icon: 'hourglass_top', tone: 'warning' },
        { label: 'Suspended', value: byStatus(UserStatus.Suspended), icon: 'pause_circle', tone: 'warning' },
        { label: 'Blocked', value: byStatus(UserStatus.Blocked), icon: 'block', tone: 'danger' },
        {
          label: 'Awaiting KYC',
          value: users.filter(
            (user) => user.kycStatus === KycStatus.Pending || user.kycStatus === KycStatus.UnderReview,
          ).length,
          icon: 'verified_user',
          tone: 'info',
        },
      ];
    });
  }

  /** Distinct departments, for the filter panel. */
  departments(): string[] {
    return [...new Set(this.records.map((user) => user.department).filter(Boolean))]
      .sort()
      .map((department) => String(department));
  }

  /** Options for the "reports to" picker. */
  managerOptions(): { value: string; label: string }[] {
    return this.records
      .filter((user) => Boolean(user.department))
      .slice(0, 30)
      .map((user) => ({ value: user.id, label: `${user.fullName} — ${humanise(String(user.primaryRole))}` }));
  }
}
