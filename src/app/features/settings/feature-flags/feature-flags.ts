import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '@core/authentication/auth.service';
import type { FeatureFlag } from '@core/models/system.model';
import { ConfirmService } from '@core/services/confirm.service';
import { FeatureFlagService } from '@core/services/feature-flag.service';
import { ToastService } from '@core/services/toast.service';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatCard } from '@shared/components/stat-card/stat-card';
import { RelativePipe } from '@shared/pipes/format.pipes';

/**
 * Feature flag console.
 *
 * Turning a flag off hides its routes, menu entries and template blocks
 * immediately — no deployment needed. Flags scoped to specific roles show that
 * scope, because a flag that is "on" but role-limited surprises people.
 */
@Component({
  selector: 'll-feature-flags',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatTooltipModule,
    PageHeader,
    StatCard,
    RelativePipe,
  ],
  templateUrl: './feature-flags.html',
  styleUrl: './feature-flags.scss',
})
export class FeatureFlags {
  protected readonly flags = inject(FeatureFlagService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  protected readonly search = signal('');

  protected readonly groups = computed(() => {
    const needle = this.search().trim().toLowerCase();
    return this.flags
      .byModule()
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (flag) =>
            !needle ||
            flag.name.toLowerCase().includes(needle) ||
            flag.key.toLowerCase().includes(needle) ||
            flag.description.toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.items.length > 0);
  });

  protected readonly summary = computed(() => {
    const all = this.flags.all();
    const enabled = all.filter((flag) => flag.enabled);
    return [
      { id: 'total', label: 'Feature flags', value: all.length, icon: 'toggle_on', tone: 'primary' as const },
      {
        id: 'enabled',
        label: 'Enabled',
        value: enabled.length,
        icon: 'check_circle',
        tone: 'success' as const,
      },
      {
        id: 'disabled',
        label: 'Disabled',
        value: all.length - enabled.length,
        icon: 'do_not_disturb_on',
        tone: 'neutral' as const,
      },
      {
        id: 'scoped',
        label: 'Role-scoped',
        value: all.filter((flag) => flag.roles.length > 0).length,
        icon: 'lock_person',
        tone: 'warning' as const,
      },
    ];
  });

  protected toggle(flag: FeatureFlag): void {
    const actor = this.auth.user()?.fullName ?? 'Administrator';

    // Turning a capability off can hide a whole module, so confirm first.
    if (flag.enabled) {
      this.confirm
        .ask({
          title: `Disable "${flag.name}"?`,
          message:
            'Routes, menu entries and screens gated by this flag are hidden immediately for every operator.',
          detail: `Flag key: ${flag.key}`,
          confirmLabel: 'Disable feature',
          tone: 'warning',
          icon: 'toggle_off',
        })
        .subscribe((confirmed) => {
          if (confirmed) {
            this.flags.setEnabled(flag.key, false, actor);
            this.toast.success('Feature disabled', flag.name);
          }
        });
      return;
    }

    this.flags.setEnabled(flag.key, true, actor);
    this.toast.success('Feature enabled', flag.name);
  }

  protected setRollout(flag: FeatureFlag, value: number): void {
    this.flags.update(flag.key, { rolloutPercent: value }, this.auth.user()?.fullName ?? 'Administrator');
  }

  protected reset(): void {
    this.confirm
      .ask({
        title: 'Reset all feature flags?',
        message: 'Every flag returns to its shipped default state.',
        confirmLabel: 'Reset flags',
        tone: 'warning',
        icon: 'restart_alt',
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.flags.reset();
          this.toast.success('Feature flags reset');
        }
      });
  }
}
