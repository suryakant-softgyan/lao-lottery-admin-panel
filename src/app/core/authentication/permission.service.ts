import { Injectable, computed, inject } from '@angular/core';

import { UserRole } from '../enums';
import type { NavItem } from '../models/navigation.model';
import { FeatureFlagService } from '../services/feature-flag.service';
import { AuthService } from './auth.service';

/**
 * RBAC evaluation.
 *
 * The single authority for "can this user see/do X". Guards, the `*llHasPermission`
 * directive, the navigation filter and table actions all route through here so
 * the rules exist in exactly one place.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);
  private readonly featureFlags = inject(FeatureFlagService);

  /** Permission codes held by the signed-in user, as a lookup set. */
  private readonly granted = computed(() => new Set(this.auth.user()?.permissions ?? []));

  private readonly roles = computed(() => this.auth.user()?.roles ?? []);

  /** Super admins bypass every check by design. */
  readonly isSuperAdmin = computed(() => this.roles().includes(UserRole.SuperAdmin));

  has(permission: string): boolean {
    if (!permission) {
      return true;
    }
    return this.isSuperAdmin() || this.granted().has(permission);
  }

  /** True when the user holds at least one of the codes (or the list is empty). */
  hasAny(permissions: readonly string[] | undefined): boolean {
    if (!permissions?.length) {
      return true;
    }
    return this.isSuperAdmin() || permissions.some((permission) => this.granted().has(permission));
  }

  hasAll(permissions: readonly string[] | undefined): boolean {
    if (!permissions?.length) {
      return true;
    }
    return this.isSuperAdmin() || permissions.every((permission) => this.granted().has(permission));
  }

  hasRole(role: string): boolean {
    return this.roles().includes(role);
  }

  hasAnyRole(roles: readonly string[] | undefined): boolean {
    if (!roles?.length) {
      return true;
    }
    return roles.some((role) => this.roles().includes(role));
  }

  /** Combined permission + role + feature-flag test used for menu entries. */
  canAccess(item: Pick<NavItem, 'permissions' | 'roles' | 'featureFlag'>): boolean {
    if (item.featureFlag && !this.featureFlags.isEnabled(item.featureFlag, this.roles() as string[])) {
      return false;
    }
    if (!this.hasAnyRole(item.roles)) {
      return false;
    }
    return this.hasAny(item.permissions);
  }

  /**
   * Prunes the navigation tree to what the current user may see. Parents whose
   * children are all hidden disappear too, and orphaned section captions are
   * dropped so the sidebar never shows an empty group.
   */
  filterNavigation(items: readonly NavItem[]): NavItem[] {
    const filtered: NavItem[] = [];

    for (const item of items) {
      if (item.sectionTitle || item.divider) {
        filtered.push(item);
        continue;
      }
      if (!this.canAccess(item)) {
        continue;
      }
      if (item.children?.length) {
        const children = this.filterNavigation(item.children);
        if (children.length === 0 && !item.route) {
          continue;
        }
        filtered.push({ ...item, children });
        continue;
      }
      filtered.push(item);
    }

    return this.dropEmptySections(filtered);
  }

  private dropEmptySections(items: readonly NavItem[]): NavItem[] {
    return items.filter((item, index) => {
      if (!item.sectionTitle) {
        return true;
      }
      // Keep the caption only when a real entry follows before the next caption.
      const next = items.slice(index + 1).find((candidate) => !candidate.divider);
      return Boolean(next && !next.sectionTitle);
    });
  }
}
