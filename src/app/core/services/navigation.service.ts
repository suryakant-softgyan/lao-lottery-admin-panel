import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { STORAGE_KEYS } from '../constants/app.constants';
import { NAVIGATION, flattenNavigation } from '../constants/navigation.constants';
import { PermissionService } from '../authentication/permission.service';
import type { NavItem, RecentPage } from '../models/navigation.model';
import { StorageService } from './storage.service';

const MAX_RECENT_PAGES = 8;

/**
 * Sidebar state: RBAC-filtered menu, search, favourites, pinned entries and
 * recently visited pages. All personalisation is persisted locally and is ready
 * to move behind a `/me/preferences` endpoint.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);
  private readonly permissions = inject(PermissionService);

  private readonly searchTerm = signal('');
  private readonly favouriteIds = signal<string[]>(this.storage.get<string[]>(STORAGE_KEYS.favourites, []));
  private readonly pinnedIds = signal<string[]>(this.storage.get<string[]>(STORAGE_KEYS.pinned, []));
  private readonly recent = signal<RecentPage[]>(
    this.storage.get<RecentPage[]>(STORAGE_KEYS.recentPages, []),
  );
  private readonly expandedIds = signal<Set<string>>(new Set());
  private readonly activeUrl = signal(this.router.url);

  /** Live counters rendered as sidebar badges. */
  private readonly badgeValues = signal<Record<string, number>>({});

  readonly search = this.searchTerm.asReadonly();
  readonly favourites = this.favouriteIds.asReadonly();
  readonly pinned = this.pinnedIds.asReadonly();
  readonly recentPages = this.recent.asReadonly();
  readonly currentUrl = this.activeUrl.asReadonly();
  readonly badges = this.badgeValues.asReadonly();

  /** Menu after RBAC and feature-flag filtering. */
  readonly menu = computed(() => this.permissions.filterNavigation(NAVIGATION));

  /** Menu narrowed by the sidebar search box. */
  readonly visibleMenu = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return this.menu();
    }
    return this.filterByTerm(this.menu(), term);
  });

  /** Flat list of routable entries — used by the command palette. */
  readonly routableItems = computed(() =>
    flattenNavigation(this.menu()).filter((item) => this.permissions.canAccess(item)),
  );

  readonly favouriteItems = computed(() => {
    const ids = new Set(this.favouriteIds());
    return this.routableItems().filter((item) => ids.has(item.id));
  });

  readonly pinnedItems = computed(() => {
    const ids = new Set(this.pinnedIds());
    return this.routableItems().filter((item) => ids.has(item.id));
  });

  /**
   * The single deepest menu route matching the current URL.
   *
   * Menu siblings are nested by convention: a group's landing page is the bare
   * route (`/retailers`) and the entries beside it extend it
   * (`/retailers/devices`). A plain prefix test therefore matches both at once
   * and lights up two siblings, so the longest matching route wins and every
   * shorter candidate loses. Prefix matching still has to happen — it is what
   * keeps "Retail Shops" lit on a detail page like `/retailers/42`, which has
   * no menu entry of its own.
   */
  private readonly activeLeafRoute = computed(() => {
    const [path = ''] = this.activeUrl().split('?');
    let deepest = '';
    for (const { route } of this.routableItems()) {
      if (route && route.length > deepest.length && this.routeMatches(route, path)) {
        deepest = route;
      }
    }
    return deepest;
  });

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.activeUrl.set(event.urlAfterRedirects);
        this.expandActiveBranch(event.urlAfterRedirects);
        this.recordVisit(event.urlAfterRedirects);
      });

    this.expandActiveBranch(this.router.url);
  }

  setSearch(term: string): void {
    this.searchTerm.set(term);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  /**
   * True for the one menu entry that owns the current URL.
   *
   * Use this for leaf links instead of `routerLinkActive`, which can only test
   * each link in isolation and so cannot tell a sibling from an ancestor.
   */
  isLeafActive(item: NavItem): boolean {
    return Boolean(item.route) && item.route === this.activeLeafRoute();
  }

  /** True when the URL matches the item, or any of its descendants. */
  isActive(item: NavItem): boolean {
    const url = this.activeUrl();
    if (item.route && this.routeMatches(item.route, url)) {
      return true;
    }
    return (item.children ?? []).some((child) => this.isActive(child));
  }

  isExpanded(item: NavItem): boolean {
    return this.expandedIds().has(item.id);
  }

  toggleExpanded(item: NavItem): void {
    this.expandedIds.update((current) => {
      const next = new Set(current);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }

  isFavourite(id: string): boolean {
    return this.favouriteIds().includes(id);
  }

  toggleFavourite(id: string): void {
    this.favouriteIds.update((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
    this.storage.set(STORAGE_KEYS.favourites, this.favouriteIds());
  }

  isPinned(id: string): boolean {
    return this.pinnedIds().includes(id);
  }

  togglePinned(id: string): void {
    this.pinnedIds.update((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
    this.storage.set(STORAGE_KEYS.pinned, this.pinnedIds());
  }

  clearRecent(): void {
    this.recent.set([]);
    this.storage.set(STORAGE_KEYS.recentPages, []);
  }

  /** Feeds live badge counters (pending approvals, unread messages, …). */
  setBadge(key: string, value: number): void {
    this.badgeValues.update((current) => ({ ...current, [key]: value }));
  }

  setBadges(values: Record<string, number>): void {
    this.badgeValues.update((current) => ({ ...current, ...values }));
  }

  badgeValue(key: string | undefined): number {
    return key ? (this.badgeValues()[key] ?? 0) : 0;
  }

  // ------------------------------------------------------------------ helpers

  private routeMatches(route: string, url: string): boolean {
    const [path] = url.split('?');
    if (path === route) {
      return true;
    }
    // A parent route highlights for its detail/edit children.
    return Boolean(path?.startsWith(`${route}/`));
  }

  private filterByTerm(items: readonly NavItem[], term: string): NavItem[] {
    const output: NavItem[] = [];
    for (const item of items) {
      if (item.sectionTitle || item.divider) {
        continue;
      }
      const haystack = [item.label, ...(item.keywords ?? [])].join(' ').toLowerCase();
      const children = item.children ? this.filterByTerm(item.children, term) : [];
      if (haystack.includes(term) || children.length > 0) {
        output.push({ ...item, children: children.length > 0 ? children : item.children });
      }
    }
    return output;
  }

  private expandActiveBranch(url: string): void {
    const expanded = new Set(this.expandedIds());
    const walk = (items: readonly NavItem[]): void => {
      for (const item of items) {
        if (item.children?.length) {
          const active = item.children.some(
            (child) =>
              (child.route && this.routeMatches(child.route, url)) ||
              (child.children ?? []).some((grand) => grand.route && this.routeMatches(grand.route, url)),
          );
          if (active) {
            expanded.add(item.id);
          }
          walk(item.children);
        }
      }
    };
    walk(this.menu());
    this.expandedIds.set(expanded);
  }

  private recordVisit(url: string): void {
    const [path] = url.split('?');
    const match = this.routableItems().find((item) => item.route === path);
    if (!match) {
      return;
    }

    const entry: RecentPage = {
      route: match.route!,
      label: match.label,
      icon: match.icon ?? 'chevron_right',
      visitedAt: Date.now(),
    };

    this.recent.update((current) =>
      [entry, ...current.filter((page) => page.route !== entry.route)].slice(0, MAX_RECENT_PAGES),
    );
    this.storage.set(STORAGE_KEYS.recentPages, this.recent());
  }
}
