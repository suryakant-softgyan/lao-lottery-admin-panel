import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SkeletonVariant = 'text' | 'title' | 'card' | 'stat' | 'table' | 'chart' | 'list' | 'avatar';

/**
 * Loading placeholder.
 *
 * Skeletons are shaped like the content they replace, which keeps the layout
 * stable and avoids the jarring reflow a spinner causes on data-dense pages.
 */
@Component({
  selector: 'll-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="skeleton" [attr.aria-busy]="true" aria-live="polite">
      <span class="ll-visually-hidden">Loading…</span>

      @switch (variant()) {
        @case ('stat') {
          @for (row of rows(); track row) {
            <div class="skeleton__stat">
              <div class="ll-skeleton" style="width: 42px; height: 42px; border-radius: 12px"></div>
              <div class="skeleton__stack">
                <div class="ll-skeleton" style="width: 58%; height: 11px"></div>
                <div class="ll-skeleton" style="width: 76%; height: 22px"></div>
                <div class="ll-skeleton" style="width: 40%; height: 10px"></div>
              </div>
            </div>
          }
        }
        @case ('table') {
          <div class="skeleton__table">
            <div class="ll-skeleton skeleton__table-head"></div>
            @for (row of rows(); track row) {
              <div class="skeleton__table-row">
                <div class="ll-skeleton" style="width: 22px; height: 22px; border-radius: 6px"></div>
                <div class="ll-skeleton" style="width: 32px; height: 32px; border-radius: 50%"></div>
                <div class="ll-skeleton" style="flex: 2; height: 12px"></div>
                <div class="ll-skeleton" style="flex: 1.4; height: 12px"></div>
                <div class="ll-skeleton" style="flex: 1; height: 12px"></div>
                <div class="ll-skeleton" style="width: 76px; height: 22px; border-radius: 999px"></div>
              </div>
            }
          </div>
        }
        @case ('chart') {
          <div class="skeleton__chart">
            <div class="ll-skeleton" style="width: 34%; height: 13px"></div>
            <div class="skeleton__bars">
              @for (row of rows(); track row) {
                <div class="ll-skeleton skeleton__bar" [style.height.%]="barHeight($index)"></div>
              }
            </div>
          </div>
        }
        @case ('list') {
          @for (row of rows(); track row) {
            <div class="skeleton__list-item">
              <div class="ll-skeleton" style="width: 36px; height: 36px; border-radius: 50%"></div>
              <div class="skeleton__stack">
                <div class="ll-skeleton" style="width: 46%; height: 12px"></div>
                <div class="ll-skeleton" style="width: 72%; height: 10px"></div>
              </div>
            </div>
          }
        }
        @case ('avatar') {
          <div class="ll-skeleton" style="width: 40px; height: 40px; border-radius: 50%"></div>
        }
        @case ('title') {
          <div class="ll-skeleton" style="width: 40%; height: 22px"></div>
        }
        @case ('card') {
          @for (row of rows(); track row) {
            <div class="skeleton__card">
              <div class="ll-skeleton" style="width: 100%; height: 116px; border-radius: 10px"></div>
              <div class="ll-skeleton" style="width: 62%; height: 13px"></div>
              <div class="ll-skeleton" style="width: 88%; height: 10px"></div>
            </div>
          }
        }
        @default {
          @for (row of rows(); track row) {
            <div class="ll-skeleton" [style.height.px]="12" [style.width.%]="lineWidth($index)"></div>
          }
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .skeleton {
      display: grid;
      gap: 10px;

      &__stack {
        display: grid;
        gap: 7px;
        flex: 1;
      }

      &__stat {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 18px;
        border: 1px solid var(--ll-border);
        border-radius: var(--ll-radius);
        background: var(--ll-surface-elevated);
      }

      &__card {
        display: grid;
        gap: 9px;
        padding: 16px;
        border: 1px solid var(--ll-border);
        border-radius: var(--ll-radius);
        background: var(--ll-surface-elevated);
      }

      &__table {
        border: 1px solid var(--ll-border);
        border-radius: var(--ll-radius);
        overflow: hidden;
        background: var(--ll-surface-elevated);
      }

      &__table-head {
        height: 40px;
        border-radius: 0;
      }

      &__table-row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 13px 16px;
        border-top: 1px solid var(--ll-border);
      }

      &__list-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 0;
      }

      &__chart {
        display: grid;
        gap: 16px;
        padding: 18px;
        border: 1px solid var(--ll-border);
        border-radius: var(--ll-radius);
        background: var(--ll-surface-elevated);
      }

      &__bars {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        height: 180px;
      }

      &__bar {
        flex: 1;
        border-radius: 6px 6px 0 0;
      }
    }
  `,
})
export class Skeleton {
  readonly variant = input<SkeletonVariant>('text');
  readonly count = input(3);

  protected readonly rows = computed(() => Array.from({ length: Math.max(1, this.count()) }, (_, i) => i));

  /** Varies line widths so the placeholder reads as prose, not a block. */
  protected lineWidth(index: number): number {
    return [96, 82, 68, 90, 74][index % 5] ?? 80;
  }

  protected barHeight(index: number): number {
    return [48, 72, 36, 88, 60, 78, 42, 66][index % 8] ?? 55;
  }
}
