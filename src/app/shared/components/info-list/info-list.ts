import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { BadgeMapEntry } from '@core/models/table.model';
import { StatusBadge } from '../status-badge/status-badge';

export interface InfoItem {
  label: string;
  value: string | number | null | undefined;
  icon?: string;
  /** Renders the value as a status pill using this map. */
  badgeMap?: Record<string, BadgeMapEntry>;
  /** Renders the value as a link. */
  route?: unknown[];
  href?: string;
  /** Monospace treatment for references, hashes and account numbers. */
  mono?: boolean;
  /** Spans the full width of the grid, for addresses and notes. */
  wide?: boolean;
  copyable?: boolean;
}

/**
 * Definition list used on every detail page and in view dialogs.
 *
 * Keeps label/value pairs visually identical across modules, which matters when
 * an operator moves between an agent, a retailer and a ticket in one workflow.
 */
@Component({
  selector: 'll-info-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatusBadge],
  template: `
    <dl class="info" [class.info--single]="columns() === 1" [style.--columns]="columns()">
      @for (item of items(); track item.label) {
        <div class="info__row" [class.info__row--wide]="item.wide">
          <dt class="info__label">
            @if (item.icon) {
              <span class="material-symbols-rounded" aria-hidden="true">{{ item.icon }}</span>
            }
            {{ item.label }}
          </dt>
          <dd class="info__value" [class.ll-mono]="item.mono">
            @if (item.badgeMap) {
              <ll-status-badge [value]="$any(item.value)" [map]="item.badgeMap" />
            } @else if (item.route) {
              <a [routerLink]="item.route">{{ display(item) }}</a>
            } @else if (item.href) {
              <a [href]="item.href" target="_blank" rel="noopener noreferrer">{{ display(item) }}</a>
            } @else {
              {{ display(item) }}
            }
          </dd>
        </div>
      }
    </dl>
  `,
  styles: `
    :host {
      display: block;
    }

    .info {
      display: grid;
      grid-template-columns: repeat(var(--columns, 2), minmax(0, 1fr));
      gap: 2px 26px;
      margin: 0;

      &__row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 14px;
        padding: 9px 0;
        border-bottom: 1px dashed color-mix(in srgb, var(--ll-border) 80%, transparent);
        min-width: 0;

        &--wide {
          grid-column: 1 / -1;
        }
      }

      &__label {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        flex: 0 0 auto;
        font-size: 0.76rem;
        font-weight: 600;
        color: var(--ll-text-muted);
        white-space: nowrap;

        .material-symbols-rounded {
          font-size: 16px;
          width: 16px;
          height: 16px;
          opacity: 0.75;
        }
      }

      &__value {
        margin: 0;
        text-align: end;
        font-size: 0.85rem;
        font-weight: 550;
        color: var(--ll-text);
        min-width: 0;
        overflow-wrap: anywhere;
      }
    }

    @media (max-width: 720px) {
      .info {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class InfoList {
  readonly items = input<InfoItem[]>([]);
  readonly columns = input(2);

  protected display(item: InfoItem): string {
    if (item.value === null || item.value === undefined || item.value === '') {
      return '—';
    }
    return String(item.value);
  }
}
