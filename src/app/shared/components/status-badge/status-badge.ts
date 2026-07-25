import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { BadgeMapEntry } from '@core/models/table.model';
import { humanise } from '@core/utilities/format.util';

/**
 * Renders an enum value as a coloured pill.
 *
 * The badge map comes from `status-maps.constants`, so a status looks identical
 * everywhere it appears — tables, detail pages, dialogs and exports.
 */
@Component({
  selector: 'll-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="ll-badge"
      [class]="'ll-badge ll-badge--' + meta().tone"
      [class.ll-badge--solid]="solid()"
      [class.ll-badge--dot]="dot()"
      [style.background]="solid() ? 'var(--ll-' + meta().tone + ')' : null"
      [attr.aria-label]="meta().label">
      @if (showIcon() && meta().icon && !dot()) {
        <span class="material-symbols-rounded" aria-hidden="true">{{ meta().icon }}</span>
      }
      {{ meta().label }}
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class StatusBadge {
  /** Raw enum value, e.g. `'PENDING_APPROVAL'`. */
  readonly value = input<string | boolean | null | undefined>(null);

  /** Lookup table for label, tone and icon. */
  readonly map = input<Record<string, BadgeMapEntry> | null>(null);

  readonly showIcon = input(true);
  readonly solid = input(false);
  readonly dot = input(false);

  /** Fallback tone when the value is missing from the map. */
  readonly fallbackTone = input<BadgeMapEntry['tone']>('neutral');

  protected readonly meta = computed<BadgeMapEntry>(() => {
    const raw = this.value();
    const key = raw === null || raw === undefined ? '' : String(raw);
    const entry = this.map()?.[key];
    return entry ?? { label: key ? humanise(key) : '—', tone: this.fallbackTone() };
  });
}
