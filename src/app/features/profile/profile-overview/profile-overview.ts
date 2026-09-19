import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from '@core/authentication/auth.service';
import { PermissionService } from '@core/authentication/permission.service';
import { LANGUAGES } from '@core/constants/app.constants';
import { PERMISSION_MODULES } from '@core/constants/permission.constants';
import { ROLE_MAP } from '@core/constants/status-maps.constants';
import { mockDataset } from '@core/mock/dataset';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { parseUserAgent } from '@core/api/live.util';
import type { LoginHistoryEntry } from '@core/models';
import { ThemeService } from '@core/services/theme.service';
import { ToastService } from '@core/services/toast.service';
import { TranslationService } from '@core/services/translation.service';
import { humanise } from '@core/utilities/format.util';
import { Avatar } from '@shared/components/avatar/avatar';
import { InfoList, type InfoItem } from '@shared/components/info-list/info-list';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { DatePipe, RelativePipe } from '@shared/pipes/format.pipes';

/** The signed-in operator's own profile, preferences and recent sign-ins. */
@Component({
  selector: 'll-profile-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, PageHeader, Avatar, InfoList, StatusBadge, DatePipe, RelativePipe],
  templateUrl: './profile-overview.html',
  styleUrl: './profile-overview.scss',
})
export class ProfileOverview {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly translation = inject(TranslationService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly roleMap = ROLE_MAP;
  protected readonly languages = LANGUAGES;
  protected readonly modules = PERMISSION_MODULES;

  protected readonly user = computed(() => this.auth.user());

  protected readonly loginHistory = signal<LoginHistoryEntry[]>(
    environment.useMockData ? mockDataset.loginHistory(this.auth.user()?.id ?? 'me').slice(0, 8) : [],
  );

  private readonly liveHistory = environment.useMockData
    ? null
    : inject(HttpClient)
        .get<{ content: Record<string, unknown>[] }>(`${environment.apiBaseUrl}/me/login-history`, {
          params: { size: '8' },
        })
        .subscribe((page) =>
          this.loginHistory.set(
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

  protected readonly profileItems = computed<InfoItem[]>(() => {
    const user = this.user();
    if (!user) {
      return [];
    }
    return [
      { label: 'Full name', value: user.fullName, icon: 'person' },
      { label: 'Username', value: user.username, icon: 'alternate_email', mono: true },
      { label: 'Email', value: user.email, icon: 'mail' },
      { label: 'Phone', value: user.phone, icon: 'phone' },
      { label: 'Department', value: user.department, icon: 'apartment' },
      { label: 'Designation', value: user.designation, icon: 'work' },
      { label: 'Primary role', value: user.primaryRole, icon: 'badge', badgeMap: ROLE_MAP },
      { label: 'Tenant', value: user.tenantName, icon: 'business' },
      { label: 'Time zone', value: user.timezone, icon: 'schedule' },
      {
        label: 'Two-factor',
        value: user.twoFactorEnabled ? 'Enabled' : 'Not enabled',
        icon: 'security',
      },
      {
        label: 'Last sign-in',
        value: user.lastLoginAt?.slice(0, 16).replace('T', ' '),
        icon: 'login',
      },
    ];
  });

  /** Permission coverage per module, for the access summary. */
  protected readonly accessSummary = computed(() => {
    const granted = this.user()?.permissions ?? [];
    return this.modules
      .map((module) => ({
        ...module,
        count: granted.filter((code) => code.startsWith(`${module.key}.`)).length,
      }))
      .filter((module) => module.count > 0);
  });

  protected readonly permissionCount = computed(() => this.user()?.permissions.length ?? 0);

  protected humanise(value: string): string {
    return humanise(value);
  }

  protected setLanguage(language: string): void {
    this.translation.use(language);
    this.auth.patchUser({ language });
    this.toast.success('Language updated');
  }

  protected onHeaderAction(action: string): void {
    if (action === 'security') {
      void this.router.navigate(['/profile/security']);
    } else if (action === 'appearance') {
      void this.router.navigate(['/settings/appearance']);
    }
  }
}
