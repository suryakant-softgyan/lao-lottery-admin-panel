import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject, signal } from '@angular/core';

import { PermissionService } from '@core/authentication/permission.service';
import { FeatureFlagService } from '@core/services/feature-flag.service';

/**
 * Structural RBAC directive.
 *
 * ```html
 * <button *llHasPermission="'users.create'">New user</button>
 * <button *llHasPermission="['draws.publish', 'draws.verify']; requireAll: true">Publish</button>
 * <section *llHasPermission="'reports.view'; featureFlag: 'reports.advanced'">…</section>
 * ```
 *
 * Because it reads signal-backed state through an effect, revoking a permission
 * mid-session removes the element without a page reload.
 */
@Directive({ selector: '[llHasPermission]' })
export class HasPermissionDirective {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private readonly permissions = inject(PermissionService);
  private readonly featureFlags = inject(FeatureFlagService);

  private readonly required = signal<string[]>([]);
  private readonly requireAll = signal(false);
  private readonly featureFlag = signal<string | null>(null);
  private readonly roles = signal<string[]>([]);
  private rendered = false;

  @Input({ required: true })
  set llHasPermission(value: string | string[] | null | undefined) {
    this.required.set(value ? (Array.isArray(value) ? value : [value]) : []);
  }

  /** Switches the check from "any of" to "all of". */
  @Input()
  set llHasPermissionRequireAll(value: boolean | '') {
    this.requireAll.set(value === '' ? true : Boolean(value));
  }

  /** Additionally requires the named feature flag to be on. */
  @Input()
  set llHasPermissionFeatureFlag(value: string | null | undefined) {
    this.featureFlag.set(value ?? null);
  }

  /** Additionally requires one of these roles. */
  @Input()
  set llHasPermissionRoles(value: string | string[] | null | undefined) {
    this.roles.set(value ? (Array.isArray(value) ? value : [value]) : []);
  }

  constructor() {
    effect(() => {
      const allowed = this.evaluate();
      if (allowed && !this.rendered) {
        this.container.createEmbeddedView(this.template);
        this.rendered = true;
      } else if (!allowed && this.rendered) {
        this.container.clear();
        this.rendered = false;
      }
    });
  }

  private evaluate(): boolean {
    const flag = this.featureFlag();
    if (flag && !this.featureFlags.isEnabled(flag)) {
      return false;
    }
    if (!this.permissions.hasAnyRole(this.roles())) {
      return false;
    }
    const codes = this.required();
    if (codes.length === 0) {
      return true;
    }
    return this.requireAll() ? this.permissions.hasAll(codes) : this.permissions.hasAny(codes);
  }
}
