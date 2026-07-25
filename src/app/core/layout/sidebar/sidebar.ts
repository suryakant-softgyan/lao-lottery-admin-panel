import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { environment } from '@env/environment';
import type { NavItem } from '@core/models/navigation.model';
import { LayoutService } from '@core/services/layout.service';
import { NavigationService } from '@core/services/navigation.service';
import { ThemeService } from '@core/services/theme.service';

/**
 * Primary navigation rail.
 *
 * Renders the RBAC-filtered menu tree with nested groups, live badges, a search
 * box, pinned and favourite shortcuts and recent pages. Collapsing swaps to an
 * icon rail with tooltips; on handsets it becomes an overlay drawer.
 */
@Component({
  selector: 'll-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, MatButtonModule, MatTooltipModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  protected readonly nav = inject(NavigationService);
  protected readonly layout = inject(LayoutService);
  protected readonly theme = inject(ThemeService);

  protected readonly version = environment.appVersion;
  protected readonly environmentName = environment.name;

  protected readonly collapsed = computed(() => this.layout.sidebarCollapsed());
  protected readonly branding = computed(() => this.theme.branding());

  /** Shortcut strip: pinned first, then favourites, de-duplicated. */
  protected readonly shortcuts = computed(() => {
    const pinned = this.nav.pinnedItems();
    const favourites = this.nav.favouriteItems().filter((item) => !pinned.includes(item));
    return [...pinned, ...favourites].slice(0, 6);
  });

  protected readonly recent = computed(() => this.nav.recentPages().slice(0, 4));

  protected badgeFor(item: NavItem): number {
    return this.nav.badgeValue(item.badge?.key);
  }

  /** A collapsed group shows the aggregate of its children's badges. */
  protected groupBadge(item: NavItem): number {
    if (!item.children?.length) {
      return this.badgeFor(item);
    }
    return item.children.reduce((total, child) => total + this.badgeFor(child), this.badgeFor(item));
  }

  protected onNavigate(): void {
    if (this.layout.sidebarIsOverlay()) {
      this.layout.closeMobileSidebar();
    }
  }

  protected toggleGroup(item: NavItem, event: Event): void {
    event.preventDefault();
    if (this.collapsed()) {
      // In rail mode a group click expands the sidebar rather than the group.
      this.layout.setSidebarCollapsed(false);
    }
    this.nav.toggleExpanded(item);
  }

  protected onFavourite(item: NavItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.nav.toggleFavourite(item.id);
  }

  protected trackItem = (_index: number, item: NavItem): string => item.id;
}
