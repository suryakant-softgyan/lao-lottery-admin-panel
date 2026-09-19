import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

export type StatePanelKind = 'empty' | 'no-results' | 'error' | 'offline' | 'forbidden' | 'coming-soon';

interface StatePreset {
  icon: string;
  title: string;
  message: string;
  tone: string;
}

const PRESETS: Record<StatePanelKind, StatePreset> = {
  empty: {
    icon: 'inbox',
    title: 'Nothing here yet',
    message: 'Once records are created they will appear in this list.',
    tone: 'neutral',
  },
  'no-results': {
    icon: 'search_off',
    title: 'No matching records',
    message: 'Try widening your filters or clearing the search term.',
    tone: 'info',
  },
  error: {
    icon: 'error',
    title: 'Something went wrong',
    message: 'The data could not be loaded. Please try again.',
    tone: 'danger',
  },
  offline: {
    icon: 'wifi_off',
    title: 'You appear to be offline',
    message: 'Reconnect to load the latest data. Cached pages remain available.',
    tone: 'warning',
  },
  forbidden: {
    icon: 'lock',
    title: 'Access denied',
    message: 'You do not have permission to view this content.',
    tone: 'warning',
  },
  'coming-soon': {
    icon: 'construction',
    title: 'Coming soon',
    message: 'This area is being prepared and will be enabled shortly.',
    tone: 'info',
  },
};

/**
 * The single component behind every empty, no-data, error and offline state.
 *
 * Centralising these means a list page never renders a bare blank area, and the
 * retry affordance is consistent across the portal.
 */
@Component({
  selector: 'll-state-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule],
  template: `
    <div class="state" [class.state--compact]="compact()" role="status">
      <div class="state__icon" [style.color]="'var(--ll-' + preset().tone + ')'">
        <span class="material-symbols-rounded" aria-hidden="true">{{ icon() || preset().icon }}</span>
      </div>
      <h3 class="state__title">{{ title() || preset().title }}</h3>
      <p class="state__message">{{ message() || preset().message }}</p>

      @if (detail(); as text) {
        <p class="state__detail ll-mono">{{ text }}</p>
      }

      <div class="state__actions">
        @if (showRetry()) {
          <button mat-flat-button type="button" (click)="retry.emit()">
            <span class="material-symbols-rounded" aria-hidden="true">refresh</span>
            {{ retryLabel() }}
          </button>
        }
        @if (actionLabel()) {
          <button mat-stroked-button type="button" (click)="action.emit()">
            @if (actionIcon()) {
              <span class="material-symbols-rounded" aria-hidden="true">{{ actionIcon() }}</span>
            }
            {{ actionLabel() }}
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    .state {
      display: grid;
      justify-items: center;
      gap: 10px;
      padding: 56px 24px;
      text-align: center;
      animation: ll-fade-up var(--ll-duration) var(--ll-ease) both;

      &--compact {
        padding: 28px 16px;
      }

      &__icon {
        display: grid;
        place-items: center;
        width: 68px;
        height: 68px;
        border-radius: 50%;
        background: color-mix(in srgb, currentcolor 12%, transparent);
        margin-bottom: 4px;

        .material-symbols-rounded {
          font-size: 34px;
          width: 34px;
          height: 34px;
        }
      }

      &__title {
        margin: 0;
        font-size: 1.02rem;
        font-weight: 660;
        color: var(--ll-text);
      }

      &__message {
        margin: 0;
        max-width: 460px;
        color: var(--ll-text-muted);
        font-size: 0.86rem;
        line-height: 1.6;
      }

      &__detail {
        margin: 4px 0 0;
        padding: 6px 10px;
        border-radius: var(--ll-radius-sm);
        background: var(--ll-surface-hover);
        color: var(--ll-text-secondary);
        font-size: 0.74rem;
        max-width: 520px;
        overflow-wrap: anywhere;
      }

      &__actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
        margin-top: 8px;

        button .material-symbols-rounded {
          font-size: 18px;
          width: 18px;
          height: 18px;
          margin-inline-end: 6px;
        }
      }
    }
  `,
})
export class StatePanel {
  readonly kind = input<StatePanelKind>('empty');
  readonly title = input<string>('');
  readonly message = input<string>('');
  /** Technical detail, e.g. a trace id — shown in monospace. */
  readonly detail = input<string>('');
  readonly icon = input<string>('');
  readonly compact = input(false);
  readonly showRetry = input(false);
  readonly retryLabel = input('Try again');
  readonly actionLabel = input<string>('');
  readonly actionIcon = input<string>('');

  readonly retry = output<void>();
  readonly action = output<void>();

  protected readonly preset = computed(() => PRESETS[this.kind()]);
}
