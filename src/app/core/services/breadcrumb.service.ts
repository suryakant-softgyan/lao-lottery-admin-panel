import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, type ActivatedRouteSnapshot } from '@angular/router';
import { filter } from 'rxjs';

import type { Breadcrumb } from '../models/navigation.model';
import { humanise } from '../utilities/format.util';

/**
 * Automatic breadcrumb generation.
 *
 * Trails are derived from the route tree using `data.breadcrumb` (a static
 * label) or `data.breadcrumbResolver` (a function of the route params, so
 * detail pages can show the record name). Any page can also publish a dynamic
 * trailing crumb once its data has loaded via {@link setDynamicLabel}.
 */
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly trail = signal<Breadcrumb[]>([]);
  /** Overrides the last crumb, e.g. "Somsak Vongphachanh" on a detail page. */
  private readonly dynamicLabel = signal<string | null>(null);

  readonly breadcrumbs = computed<Breadcrumb[]>(() => {
    const crumbs = this.trail();
    const override = this.dynamicLabel();
    if (!override || crumbs.length === 0) {
      return crumbs;
    }
    return crumbs.map((crumb, index) =>
      index === crumbs.length - 1 ? { ...crumb, label: override } : crumb,
    );
  });

  /** Convenience accessor for page headers. */
  readonly currentLabel = computed(() => this.breadcrumbs().at(-1)?.label ?? '');

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.dynamicLabel.set(null);
        this.trail.set(this.build(this.route.snapshot.root, '', []));
      });

    this.trail.set(this.build(this.route.snapshot.root, '', []));
  }

  setDynamicLabel(label: string | null): void {
    this.dynamicLabel.set(label);
  }

  /** Replaces the computed trail entirely — for pages with bespoke hierarchy. */
  override(crumbs: Breadcrumb[]): void {
    this.trail.set(crumbs);
  }

  private build(route: ActivatedRouteSnapshot, url: string, accumulated: Breadcrumb[]): Breadcrumb[] {
    const segment = route.url.map((part) => part.path).join('/');
    const nextUrl = segment ? `${url}/${segment}` : url;

    const label = this.labelFor(route, segment);
    const crumbs = [...accumulated];

    if (label) {
      crumbs.push({
        label,
        labelKey: route.data['breadcrumbKey'] as string | undefined,
        url: nextUrl || '/',
        icon: route.data['icon'] as string | undefined,
      });
    }

    if (route.firstChild) {
      return this.build(route.firstChild, nextUrl, crumbs);
    }

    return crumbs.map((crumb, index) => ({ ...crumb, terminal: index === crumbs.length - 1 }));
  }

  private labelFor(route: ActivatedRouteSnapshot, segment: string): string | null {
    const resolver = route.data['breadcrumbResolver'] as
      ((snapshot: ActivatedRouteSnapshot) => string) | undefined;
    if (resolver) {
      return resolver(route);
    }

    const explicit = route.data['breadcrumb'] as string | undefined;
    if (explicit) {
      return explicit;
    }

    // Skip layout/pathless routes and raw id segments.
    if (!segment || /^[0-9a-f-]{8,}$/i.test(segment)) {
      return null;
    }
    return humanise(segment);
  }
}
