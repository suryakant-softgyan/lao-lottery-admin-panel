import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { environment } from '@env/environment';
import { HealthState } from '@core/enums';
import { mockDataset } from '@core/mock/dataset';
import { ThemeService } from '@core/services/theme.service';

/** Application footer with branding, version and a live health indicator. */
@Component({
  selector: 'll-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <footer class="footer ll-no-print">
      <div class="footer__left">
        <span>{{ branding().copyright }}</span>
        <span class="ll-divider--vertical" aria-hidden="true"></span>
        <span>{{ branding().footerText }}</span>
      </div>

      <div class="footer__right">
        <a routerLink="/settings/about">About</a>
        <a routerLink="/audit">Audit trail</a>
        <a [href]="'mailto:' + branding().supportEmail">Support</a>
        <span class="ll-divider--vertical" aria-hidden="true"></span>
        <span class="footer__health" [class]="'footer__health footer__health--' + healthTone()">
          <span class="footer__health-dot" aria-hidden="true"></span>
          {{ healthLabel() }}
        </span>
        <span class="footer__version">v{{ version }}</span>
      </div>
    </footer>
  `,
  styles: `
    :host {
      display: block;
    }

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
      padding: 12px 20px;
      border-top: 1px solid var(--ll-border);
      background: var(--ll-surface-elevated);
      font-size: 0.75rem;
      color: var(--ll-text-muted);

      &__left,
      &__right {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      a {
        color: var(--ll-text-secondary);

        &:hover {
          color: var(--ll-primary);
        }
      }

      &__health {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-weight: 600;

        &--success {
          color: var(--ll-success);
        }

        &--warning {
          color: var(--ll-warning);
        }

        &--danger {
          color: var(--ll-danger);
        }
      }

      &__health-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentcolor;
      }

      &__version {
        font-variant-numeric: tabular-nums;
      }
    }
  `,
})
export class Footer {
  private readonly theme = inject(ThemeService);

  protected readonly version = environment.appVersion;
  protected readonly branding = computed(() => this.theme.branding());

  /** Snapshot taken once — the dashboard owns the live polling view. */
  private readonly health = mockDataset.systemHealth;

  protected readonly healthTone = computed(() => {
    switch (this.health.overall) {
      case HealthState.Healthy:
        return 'success';
      case HealthState.Degraded:
        return 'warning';
      default:
        return 'danger';
    }
  });

  protected readonly healthLabel = computed(() => {
    switch (this.health.overall) {
      case HealthState.Healthy:
        return 'All systems operational';
      case HealthState.Degraded:
        return 'Degraded performance';
      default:
        return 'Service disruption';
    }
  });
}
