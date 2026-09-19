import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';

import { auditToTimeline, parseUserAgent, type ApiAuditEntry } from '@core/api/live.util';
import { toApiPermissions, toPanelPermissions } from '@core/authentication/permission-map';

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
    if (this.live) {
      return this.liveRoles();
    }
    return this.backend.respond(() => mockDataset.roles);
  }

  roleById(id: string): Observable<Role> {
    if (this.live) {
      return this.liveRoles().pipe(map((roles) => this.requireRole(roles, id)));
    }
    const role = mockDataset.roles.find((item) => item.id === id);
    return role ? this.backend.respond(() => role) : this.backend.notFound<Role>('Role', id);
  }

  /** Persists a role's permission set from the permission-matrix screen. */
  saveRolePermissions(roleId: string, permissionCodes: string[]): Observable<Role> {
    if (this.live) {
      return this.liveSaveRolePermissions(roleId, permissionCodes);
    }
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
    if (this.live) {
      return this.livePage(this.livePath, query, (row) => this.fromApi(row), { kycStatus: "PENDING" });
    }
    const pending = this.records.filter(
      (user) => user.kycStatus === KycStatus.Pending || user.kycStatus === KycStatus.UnderReview,
    );
    return this.mockBackend.respond(() => applyQuery(pending, query, this.queryOptions));
  }

  approveKyc(id: string, remarks?: string): Observable<User> {
    if (this.live) {
      return this.liveKyc(id, true, remarks);
    }
    return this.patch(id, {
      kycStatus: KycStatus.Approved,
      status: UserStatus.Active,
      notes: remarks,
    } as Partial<User>);
  }

  rejectKyc(id: string, reason: string): Observable<User> {
    if (this.live) {
      return this.liveKyc(id, false, reason);
    }
    return this.patch(id, { kycStatus: KycStatus.Rejected, notes: reason } as Partial<User>);
  }

  setStatus(id: string, status: UserStatus, reason?: string): Observable<User> {
    return this.patch(id, { status, notes: reason } as Partial<User>);
  }

  resetPassword(id: string): Observable<{ success: boolean }> {
    if (this.live) {
      return this.liveResetPassword(id);
    }
    void id;
    return this.backend.respond(() => ({ success: true }));
  }

  // ------------------------------------------------------------- detail tabs

  loginHistory(userId: string): Observable<LoginHistoryEntry[]> {
    if (this.live) {
      return this.liveLoginHistory(userId);
    }
    return this.backend.respond(() => mockDataset.loginHistory(userId));
  }

  deviceHistory(userId: string): Observable<DeviceHistoryEntry[]> {
    if (this.live) {
      return this.liveDeviceHistory(userId);
    }
    return this.backend.respond(() => mockDataset.deviceHistory(userId));
  }

  activity(userId: string): Observable<UserActivityEntry[]> {
    if (this.live) {
      return this.liveActivity(userId);
    }
    return this.backend.respond(() => mockDataset.userActivity(userId));
  }

  /** Activity rendered as a timeline on the detail page. */
  timeline(userId: string): Observable<TimelineEvent[]> {
    if (this.live) {
      return this.liveTimeline(userId);
    }
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
    if (this.live) {
      return this.liveStatistics();
    }
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
  // =====================================================================================
  // Live API implementation
  // =====================================================================================

  protected override paramAliases = { role: 'role', primaryRole: 'role' };

  protected override fromApi(record: unknown): User {
    const api = record as Partial<User> & { address?: Partial<User['address']> };
    const fullName = api.fullName ?? `${api.firstName ?? ''} ${api.lastName ?? ''}`.trim();
    return {
      ...(api as User),
      fullName,
      displayName: api.displayName ?? fullName,
      avatarUrl: api.avatarUrl || PLACEHOLDER.avatar(fullName),
      email: api.email ?? '',
      roles: api.roles ?? [],
      permissionOverrides: api.permissionOverrides ?? [],
      documents: api.documents ?? [],
      tags: api.tags ?? [],
      address: api.address?.line1 || api.address?.province ? (api.address as User['address']) : undefined,
    };
  }

  protected override toApi(payload: UserPayload): unknown {
    return {
      ...payload,
      roles: payload.roles.length ? payload.roles : [payload.primaryRole],
      email: payload.email || null,
    };
  }

  /** Detail view: the user plus the KYC documents, which the list endpoint does not carry. */
  override getById(id: string): Observable<User> {
    if (!this.live) {
      return super.getById(id);
    }
    return forkJoin({
      user: this.http.get<unknown>(`${this.baseUrl}/${id}`),
      documents: this.http
        .get<User['documents']>(`${this.baseUrl}/${id}/documents`, { headers: { 'X-Quiet': '1' } })
        .pipe(catchError(() => of([] as User['documents']))),
    }).pipe(map(({ user, documents }) => ({ ...this.fromApi(user), documents })));
  }

  protected override livePatch(id: string, changes: Partial<User>): Observable<User> {
    if (changes.status) {
      return this.http
        .patch<unknown>(`${this.baseUrl}/${id}/status`, { status: changes.status, reason: changes.notes })
        .pipe(map((row) => this.fromApi(row)));
    }
    return super.livePatch(id, changes);
  }

  private liveKyc(id: string, approved: boolean, remarks?: string): Observable<User> {
    return this.http
      .post<unknown>(`${this.baseUrl}/${id}/kyc`, { approved, remarks })
      .pipe(map((row) => this.fromApi(row)));
  }

  private liveResetPassword(id: string): Observable<{ success: boolean; temporaryPassword?: string }> {
    return this.http
      .post<{ temporaryPassword: string }>(`${this.baseUrl}/${id}/reset-password`, {})
      .pipe(map((result) => ({ success: true, temporaryPassword: result.temporaryPassword })));
  }

  private knownApiPermissions: Set<string> | null = null;

  private liveRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(this.api('admin/roles')).pipe(
      map((roles) =>
        roles.map((role) => ({ ...role, permissionCodes: toPanelPermissions(role.permissionCodes ?? []) })),
      ),
    );
  }

  private requireRole(roles: Role[], id: string): Role {
    const role = roles.find((item) => item.id === id);
    if (!role) {
      throw new Error(`Role ${id} was not found.`);
    }
    return role;
  }

  private liveSaveRolePermissions(roleId: string, panelCodes: string[]): Observable<Role> {
    const known$ = this.knownApiPermissions
      ? of(this.knownApiPermissions)
      : this.http.get<{ code: string }[]>(this.api('admin/permissions')).pipe(
          map((permissions) => new Set(permissions.map((permission) => permission.code))),
          tap((known) => (this.knownApiPermissions = known)),
        );
    return known$.pipe(
      switchMap((known) =>
        this.http.put<Role>(this.api(`admin/roles/${roleId}/permissions`), {
          permissionCodes: toApiPermissions(panelCodes, known),
        }),
      ),
      map((role) => ({ ...role, permissionCodes: toPanelPermissions(role.permissionCodes ?? []) })),
    );
  }

  private liveLoginHistory(userId: string): Observable<LoginHistoryEntry[]> {
    return this.http
      .get<Page<Record<string, unknown>>>(`${this.baseUrl}/${userId}/login-history`, { params: { size: '50' } })
      .pipe(
        map((page) =>
          page.content.map((row) => {
            const agent = parseUserAgent(row['device'] as string | undefined);
            return {
              id: String(row['id']),
              timestamp: String(row['timestamp']),
              ipAddress: String(row['ipAddress'] ?? ''),
              location: '—',
              device: `${agent.browser} · ${agent.os}`,
              deviceType: (row['deviceType'] ?? 'WEB') as LoginHistoryEntry['deviceType'],
              browser: agent.browser,
              os: agent.os,
              success: Boolean(row['success']),
              failureReason: (row['failureReason'] as string | undefined) ?? undefined,
            };
          }),
        ),
      );
  }

  private liveDeviceHistory(userId: string): Observable<DeviceHistoryEntry[]> {
    return this.http.get<Record<string, unknown>[]>(`${this.baseUrl}/${userId}/devices`).pipe(
      map((rows) =>
        rows.map((row) => ({
          id: String(row['id']),
          deviceId: String(row['deviceId']),
          deviceName: String(row['deviceName'] ?? row['deviceId']),
          deviceType: (row['deviceType'] ?? 'WEB') as DeviceHistoryEntry['deviceType'],
          os: String(row['os'] ?? '—'),
          appVersion: (row['appVersion'] as string | undefined) ?? undefined,
          firstSeenAt: String(row['firstSeenAt']),
          lastSeenAt: String(row['lastSeenAt']),
          trusted: Boolean(row['trusted']),
          active: Boolean(row['active']),
        })),
      ),
    );
  }

  /** Everything recorded about this user record in the audit trail. */
  private liveAudit(userId: string): Observable<ApiAuditEntry[]> {
    return this.http
      .get<ApiAuditEntry[]>(this.api('admin/audit/timeline'), {
        params: { entityType: 'User', entityId: userId, limit: '100' },
        headers: { 'X-Quiet': '1' },
      })
      .pipe(catchError(() => of([] as ApiAuditEntry[])));
  }

  private liveActivity(userId: string): Observable<UserActivityEntry[]> {
    return this.liveAudit(userId).pipe(
      map((entries) =>
        entries.map((entry) => ({
          id: entry.id,
          timestamp: entry.timestamp,
          action: humanise(entry.action),
          module: humanise(entry.module),
          description: entry.description,
          ipAddress: entry.ipAddress ?? '',
        })),
      ),
    );
  }

  private liveTimeline(userId: string): Observable<TimelineEvent[]> {
    return this.liveAudit(userId).pipe(map((entries) => entries.map(auditToTimeline)));
  }

  private liveStatistics(): Observable<{ label: string; value: number; icon: string; tone: string }[]> {
    const count = (params: Record<string, string> = {}): Observable<number> =>
      this.liveCount(this.livePath, params);
    return forkJoin({
      total: count(),
      active: count({ status: UserStatus.Active }),
      pending: count({ status: UserStatus.Pending }),
      suspended: count({ status: UserStatus.Suspended }),
      blocked: count({ status: UserStatus.Blocked }),
      kyc: count({ kycStatus: KycStatus.Pending }),
    }).pipe(
      map((totals) => [
        { label: 'Total users', value: totals.total, icon: 'group', tone: 'primary' },
        { label: 'Active', value: totals.active, icon: 'check_circle', tone: 'success' },
        { label: 'Pending', value: totals.pending, icon: 'hourglass_top', tone: 'warning' },
        { label: 'Suspended', value: totals.suspended, icon: 'pause_circle', tone: 'warning' },
        { label: 'Blocked', value: totals.blocked, icon: 'block', tone: 'danger' },
        { label: 'Awaiting KYC', value: totals.kyc, icon: 'verified_user', tone: 'info' },
      ]),
    );
  }
}
