import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { BreadcrumbService } from '@core/services/breadcrumb.service';
import { ThemeService } from '@core/services/theme.service';

export interface PageHeaderAction {
  id: string;
  label: string;
  icon: string;
  /** `primary` renders a filled button, everything else an outlined one. */
  variant?: 'primary' | 'secondary' | 'ghost';
  permissions?: string[];
  disabled?: boolean;
  menu?: { id: string; label: string; icon: string; danger?: boolean }[];
}

export interface PageHeaderStat {
  label: string;
  value: string;
  icon?: string;
}

/**
 * The hero banner that opens every page.
 *
 * Combines the breadcrumb trail, the page title, an at-a-glance stat strip and
 * the primary actions, so no screen ever starts with a bare table. The banner
 * image and gradient come from the branding/theme settings.
 */
@Component({
  selector: 'll-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatMenuModule, MatTooltipModule],
  template: `
    <header class="hero" [class.hero--compact]="compact()" [style.background-image]="backgroundLayers()">
      <div class="hero__overlay"></div>

      <div class="hero__content">
        @if (showBreadcrumb()) {
          <nav class="hero__crumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <a routerLink="/dashboard" aria-label="Dashboard">
                  <span class="material-symbols-rounded" aria-hidden="true">home</span>
                </a>
              </li>
              @for (crumb of crumbs(); track crumb.url) {
                <li>
                  <span class="hero__crumb-sep material-symbols-rounded" aria-hidden="true">
                    chevron_right
                  </span>
                  @if (crumb.terminal) {
                    <span aria-current="page">{{ crumb.label }}</span>
                  } @else {
                    <a [routerLink]="crumb.url">{{ crumb.label }}</a>
                  }
                </li>
              }
            </ol>
          </nav>
        }

        <div class="hero__main">
          <div class="hero__titles">
            @if (eyebrow(); as text) {
              <p class="hero__eyebrow">{{ text }}</p>
            }
            <h1 class="hero__title">
              @if (icon(); as glyph) {
                <span class="material-symbols-rounded" aria-hidden="true">{{ glyph }}</span>
              }
              {{ title() }}
            </h1>
            @if (subtitle(); as text) {
              <p class="hero__subtitle">{{ text }}</p>
            }
          </div>

          @if (actions().length) {
            <div class="hero__actions">
              @for (action of actions(); track action.id) {
                @if (action.menu?.length) {
                  <button
                    mat-stroked-button
                    type="button"
                    class="hero__button"
                    [disabled]="action.disabled"
                    [matMenuTriggerFor]="actionMenu">
                    <span class="material-symbols-rounded" aria-hidden="true">{{ action.icon }}</span>
                    {{ action.label }}
                    <span class="material-symbols-rounded" aria-hidden="true">expand_more</span>
                  </button>
                  <mat-menu #actionMenu="matMenu">
                    @for (item of action.menu ?? []; track item.id) {
                      <button
                        mat-menu-item
                        type="button"
                        [class.ll-menu-item--danger]="item.danger"
                        (click)="actionSelected.emit(item.id)">
                        <span matMenuItemIcon class="material-symbols-rounded" aria-hidden="true">{{
                          item.icon
                        }}</span>
                        <span>{{ item.label }}</span>
                      </button>
                    }
                  </mat-menu>
                } @else {
                  <!-- One button directive throughout; the primary look is a
                       CSS variant so the hero keeps a single visual language. -->
                  <button
                    mat-stroked-button
                    type="button"
                    class="hero__button"
                    [class.hero__button--primary]="action.variant === 'primary'"
                    [disabled]="action.disabled"
                    (click)="actionSelected.emit(action.id)">
                    <span class="material-symbols-rounded" aria-hidden="true">{{ action.icon }}</span>
                    {{ action.label }}
                  </button>
                }
              }
            </div>
          }
        </div>

        @if (stats().length) {
          <div class="hero__stats">
            @for (stat of stats(); track stat.label) {
              <div class="hero__stat">
                @if (stat.icon) {
                  <span class="material-symbols-rounded" aria-hidden="true">{{ stat.icon }}</span>
                }
                <div>
                  <span class="hero__stat-value ll-numeric">{{ stat.value }}</span>
                  <span class="hero__stat-label">{{ stat.label }}</span>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </header>
  `,
  styleUrl: './page-header.scss',
})
export class PageHeader {
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly theme = inject(ThemeService);

  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly eyebrow = input<string>('');
  readonly icon = input<string>('');
  readonly actions = input<PageHeaderAction[]>([]);
  readonly stats = input<PageHeaderStat[]>([]);
  readonly compact = input(false);
  /** Optional background photograph layered under the gradient. */
  readonly bannerUrl = input<string>('');

  readonly actionSelected = output<string>();

  protected readonly crumbs = computed(() =>
    this.breadcrumbService.breadcrumbs().filter((crumb) => crumb.url !== '/dashboard'),
  );

  protected readonly showBreadcrumb = computed(() => this.theme.settings().layout.showBreadcrumb);

  /** Gradient always sits on top; the photo is optional. */
  protected readonly backgroundLayers = computed(() => {
    const image = this.bannerUrl();
    const gradient = 'var(--ll-gradient-hero)';
    return image ? `${gradient}, url('${image}')` : gradient;
  });
}
