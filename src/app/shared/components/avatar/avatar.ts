import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { initials } from '@core/utilities/format.util';

/**
 * Avatar with a deterministic colour fallback.
 *
 * When no image is supplied — or the placeholder service is unreachable — the
 * component degrades to tinted initials rather than a broken image icon, which
 * keeps long tables looking intentional on a poor connection.
 */
@Component({
  selector: 'll-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="avatar"
      [class.avatar--square]="square()"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.font-size.px]="size() * 0.38"
      [style.background]="showImage() ? null : tint()"
      [style.color]="showImage() ? null : accent()"
      [attr.title]="name()"
      [attr.aria-label]="name()"
      role="img">
      @if (showImage()) {
        <img [src]="src()" [alt]="name()" (error)="onImageError()" loading="lazy" />
      } @else {
        {{ label() }}
      }
      @if (status(); as state) {
        <span class="avatar__status" [style.background]="'var(--ll-' + state + ')'"></span>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
    }

    .avatar {
      position: relative;
      display: inline-grid;
      place-items: center;
      border-radius: 50%;
      overflow: visible;
      font-weight: 700;
      letter-spacing: 0.02em;
      user-select: none;
      border: 1px solid var(--ll-border);
      background: var(--ll-surface-hover);

      &--square {
        border-radius: var(--ll-radius-sm);
      }

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: inherit;
      }

      &__status {
        position: absolute;
        right: -1px;
        bottom: -1px;
        width: 28%;
        height: 28%;
        min-width: 8px;
        min-height: 8px;
        border-radius: 50%;
        border: 2px solid var(--ll-surface-elevated);
      }
    }
  `,
})
export class Avatar {
  readonly name = input<string | null | undefined>('');
  readonly src = input<string | null | undefined>(null);
  readonly size = input(36);
  readonly square = input(false);

  /** Renders a presence dot using a theme tone name. */
  readonly status = input<'success' | 'warning' | 'danger' | 'neutral' | null>(null);

  private readonly imageFailed = signal(false);

  protected readonly label = computed(() => initials(this.name()));

  protected readonly showImage = computed(() => Boolean(this.src()) && !this.imageFailed());

  /** Stable hue derived from the name, so the same person keeps one colour. */
  private readonly hue = computed(() => {
    const source = this.name() ?? '';
    let hash = 0;
    for (let index = 0; index < source.length; index++) {
      hash = source.charCodeAt(index) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
  });

  protected readonly tint = computed(() => `hsl(${this.hue()} 68% 92%)`);
  protected readonly accent = computed(() => `hsl(${this.hue()} 62% 32%)`);

  protected onImageError(): void {
    this.imageFailed.set(true);
  }
}
