import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { countdownParts } from '@core/utilities/format.util';

/**
 * Live countdown to the next draw.
 *
 * The one-second tick runs outside Angular's zone and writes to a signal, so
 * the widget updates without scheduling application-wide change detection.
 */
@Component({
  selector: 'll-countdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="countdown" [class.countdown--compact]="compact()" [class.countdown--urgent]="urgent()">
      @if (parts().expired) {
        <span class="countdown__expired">
          <span class="material-symbols-rounded" aria-hidden="true">check_circle</span>
          {{ expiredLabel() }}
        </span>
      } @else {
        @for (unit of units(); track unit.label) {
          <div class="countdown__unit">
            <span class="countdown__value ll-numeric">{{ unit.value }}</span>
            <span class="countdown__label">{{ unit.label }}</span>
          </div>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .countdown {
      display: flex;
      align-items: stretch;
      gap: 7px;

      &__unit {
        display: grid;
        justify-items: center;
        gap: 1px;
        min-width: 52px;
        padding: 8px 6px;
        border-radius: var(--ll-radius-sm);
        background: color-mix(in srgb, var(--ll-primary) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--ll-primary) 22%, transparent);
      }

      &__value {
        font-size: 1.28rem;
        font-weight: 740;
        line-height: 1.1;
        letter-spacing: -0.03em;
        color: var(--ll-primary);
        font-variant-numeric: tabular-nums;
      }

      &__label {
        font-size: 0.6rem;
        font-weight: 700;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--ll-text-muted);
      }

      &__expired {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--ll-success);
      }

      &--compact &__unit {
        min-width: 40px;
        padding: 5px 4px;
      }

      &--compact &__value {
        font-size: 1rem;
      }

      /* Inside the final hour the countdown turns urgent. */
      &--urgent &__unit {
        background: var(--ll-danger-soft);
        border-color: var(--ll-danger-border);
      }

      &--urgent &__value {
        color: var(--ll-danger);
      }
    }
  `,
})
export class Countdown {
  private readonly zone = inject(NgZone);

  readonly target = input<string | Date | null>(null);
  readonly compact = input(false);
  readonly expiredLabel = input('Draw closed');
  /** Hides the days column when the target is always within a day. */
  readonly showDays = input(true);

  readonly expired = output<void>();

  private readonly now = signal(Date.now());
  private notified = false;

  protected readonly parts = computed(() => countdownParts(this.target(), new Date(this.now())));

  protected readonly urgent = computed(() => {
    const parts = this.parts();
    return !parts.expired && parts.days === 0 && parts.hours === 0;
  });

  protected readonly units = computed(() => {
    const parts = this.parts();
    const pad = (value: number): string => value.toString().padStart(2, '0');
    const units = [
      { label: 'Hours', value: pad(parts.hours) },
      { label: 'Min', value: pad(parts.minutes) },
      { label: 'Sec', value: pad(parts.seconds) },
    ];
    if (this.showDays() && parts.days > 0) {
      units.unshift({ label: 'Days', value: pad(parts.days) });
    }
    return units;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);

    this.zone.runOutsideAngular(() => {
      const ticker = setInterval(() => {
        this.now.set(Date.now());
        if (!this.notified && this.parts().expired) {
          this.notified = true;
          this.zone.run(() => this.expired.emit());
        }
      }, 1000);

      destroyRef.onDestroy(() => clearInterval(ticker));
    });
  }
}
