import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TrendDirection } from '@core/enums';
import type { StatMetric } from '@core/models/common.model';
import { ThemeService } from '@core/services/theme.service';
import { formatCompact, formatCurrency, formatNumber } from '@core/utilities/format.util';

/**
 * KPI tile used across the dashboard and every module's summary row.
 *
 * Renders the value, a delta against the previous period and an optional
 * sparkline drawn as an inline SVG (cheap enough to place dozens on a page
 * without instantiating a chart per tile).
 */
@Component({
  selector: 'll-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatTooltipModule],
  template: `
    <div
      class="stat ll-card"
      [class.stat--clickable]="metric().route"
      [style.--tone]="'var(--ll-' + metric().tone + ')'"
      [style.--tone-soft]="'var(--ll-' + metric().tone + '-soft)'">
      @if (metric().route; as route) {
        <a class="stat__link" [routerLink]="route" [attr.aria-label]="metric().label"></a>
      }

      <div class="stat__top">
        <span class="stat__icon material-symbols-rounded" aria-hidden="true">{{ metric().icon }}</span>

        @if (metric().hint; as hint) {
          <span
            class="stat__hint material-symbols-rounded"
            [matTooltip]="hint"
            matTooltipPosition="above"
            tabindex="0"
            role="note">
            info
          </span>
        }
      </div>

      <p class="stat__label">{{ metric().label }}</p>

      <p class="stat__value ll-numeric">
        {{ displayValue() }}
        @if (metric().unit; as unit) {
          <span class="stat__unit">{{ unit }}</span>
        }
      </p>

      <div class="stat__footer">
        @if (metric().delta !== undefined) {
          <span class="stat__delta" [class]="'stat__delta stat__delta--' + trendTone()">
            <span class="material-symbols-rounded" aria-hidden="true">{{ trendIcon() }}</span>
            {{ deltaLabel() }}
          </span>
        }
        @if (metric().deltaLabel; as caption) {
          <span class="stat__caption">{{ caption }}</span>
        }
      </div>

      @if (metric().sparkline?.length) {
        <svg class="stat__spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
          <path class="stat__spark-fill" [attr.d]="sparkAreaPath()" />
          <path class="stat__spark-line" [attr.d]="sparkLinePath()" />
        </svg>
      }
    </div>
  `,
  styleUrl: './stat-card.scss',
})
export class StatCard {
  private readonly theme = inject(ThemeService);

  readonly metric = input.required<StatMetric>();
  /** Renders the value as currency using the active regional settings. */
  readonly currency = input(false);
  /** Abbreviates large numbers (12.4M) to keep tiles compact. */
  readonly compact = input(true);

  readonly select = output<StatMetric>();

  protected readonly displayValue = computed(() => {
    const metric = this.metric();
    if (metric.formatted) {
      return metric.formatted;
    }
    const regional = this.theme.regional();
    if (this.currency()) {
      return formatCurrency(metric.value, regional.currency, regional.locale, {
        compact: this.compact(),
        symbol: regional.currencySymbol,
        position: regional.currencyPosition,
      });
    }
    return this.compact()
      ? formatCompact(metric.value, regional.locale)
      : formatNumber(metric.value, regional.locale);
  });

  protected readonly trend = computed(() => {
    const metric = this.metric();
    if (metric.trend) {
      return metric.trend;
    }
    const delta = metric.delta ?? 0;
    if (delta > 0) {
      return TrendDirection.Up;
    }
    return delta < 0 ? TrendDirection.Down : TrendDirection.Flat;
  });

  protected readonly trendIcon = computed(() => {
    switch (this.trend()) {
      case TrendDirection.Up:
        return 'trending_up';
      case TrendDirection.Down:
        return 'trending_down';
      default:
        return 'trending_flat';
    }
  });

  /**
   * Rising numbers are not automatically good — more failed transactions is
   * bad news. `tone: 'danger'` metrics invert the colour of an upward trend.
   */
  protected readonly trendTone = computed(() => {
    const trend = this.trend();
    if (trend === TrendDirection.Flat) {
      return 'neutral';
    }
    const inverted = this.metric().tone === 'danger' || this.metric().tone === 'warning';
    const positive = trend === TrendDirection.Up ? !inverted : inverted;
    return positive ? 'up' : 'down';
  });

  protected readonly deltaLabel = computed(() => {
    const delta = this.metric().delta ?? 0;
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(1)}%`;
  });

  private readonly sparkPoints = computed(() => {
    const values = this.metric().sparkline ?? [];
    if (values.length < 2) {
      return [];
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values.map((value, index) => ({
      x: (index / (values.length - 1)) * 100,
      y: 30 - ((value - min) / range) * 26,
    }));
  });

  protected readonly sparkLinePath = computed(() => {
    const points = this.sparkPoints();
    if (points.length === 0) {
      return '';
    }
    return points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(' ');
  });

  protected readonly sparkAreaPath = computed(() => {
    const line = this.sparkLinePath();
    return line ? `${line} L100,32 L0,32 Z` : '';
  });
}
