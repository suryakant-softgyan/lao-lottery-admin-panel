import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { KEYBOARD_SHORTCUTS } from '@core/constants/app.constants';
import { HealthState } from '@core/enums';
import { environment } from '@env/environment';
import { HEALTH_STATE_MAP } from '@core/constants/status-maps.constants';
import type { SystemHealth } from '@core/models';
import { FeatureFlagService } from '@core/services/feature-flag.service';
import { ThemeService } from '@core/services/theme.service';
import { mockDataset } from '@core/mock/dataset';
import { InfoList, type InfoItem } from '@shared/components/info-list/info-list';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { RelativePipe } from '@shared/pipes/format.pipes';

/** About, system health, keyboard reference and support details. */
@Component({
  selector: 'll-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, PageHeader, InfoList, StatusBadge, RelativePipe],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {
  private readonly theme = inject(ThemeService);
  private readonly featureFlags = inject(FeatureFlagService);

  protected readonly shortcuts = KEYBOARD_SHORTCUTS;
  protected readonly healthStateMap = HEALTH_STATE_MAP;
  protected readonly HealthState = HealthState;

  protected readonly branding = computed(() => this.theme.branding());
  protected readonly health = signal<SystemHealth>(mockDataset.systemHealth);

  protected readonly buildItems = computed<InfoItem[]>(() => [
    { label: 'Application', value: this.branding().applicationName, icon: 'apps' },
    { label: 'Version', value: environment.appVersion, icon: 'sell', mono: true },
    { label: 'Build', value: environment.buildNumber, icon: 'construction', mono: true },
    { label: 'Environment', value: environment.name, icon: 'dns' },
    { label: 'API base URL', value: environment.apiBaseUrl, icon: 'api', mono: true },
    { label: 'Realtime endpoint', value: environment.wsBaseUrl, icon: 'bolt', mono: true },
    {
      label: 'Data source',
      value: environment.useMockData ? 'Mock services (no backend)' : 'Live REST API',
      icon: 'storage',
    },
    { label: 'Tenant', value: environment.defaultTenantId, icon: 'apartment', mono: true },
    { label: 'Languages', value: environment.supportedLanguages.join(', '), icon: 'translate' },
    {
      label: 'Feature flags enabled',
      value: `${this.featureFlags.enabledCount()} of ${this.featureFlags.all().length}`,
      icon: 'toggle_on',
    },
  ]);

  protected readonly supportItems = computed<InfoItem[]>(() => [
    {
      label: 'Support email',
      value: this.branding().supportEmail,
      icon: 'mail',
      href: `mailto:${this.branding().supportEmail}`,
    },
    {
      label: 'Support phone',
      value: this.branding().supportPhone,
      icon: 'phone',
      href: `tel:${this.branding().supportPhone}`,
    },
    { label: 'Operator', value: this.branding().companyName, icon: 'business' },
    { label: 'Portal domain', value: this.branding().primaryDomain, icon: 'language', mono: true },
  ]);

  /** Tone for the overall health chip. */
  protected readonly overallTone = computed(() => {
    switch (this.health().overall) {
      case HealthState.Healthy:
        return 'success';
      case HealthState.Degraded:
        return 'warning';
      default:
        return 'danger';
    }
  });

  protected refreshHealth(): void {
    this.health.set(mockDataset.systemHealth);
  }
}
