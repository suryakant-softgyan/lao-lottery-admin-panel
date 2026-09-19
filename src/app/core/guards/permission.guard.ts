import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { AuthService } from '../authentication/auth.service';
import { PermissionService } from '../authentication/permission.service';
import { FeatureFlagService } from '../services/feature-flag.service';
import { ToastService } from '../services/toast.service';

/**
 * Route-level RBAC.
 *
 * Configure with route data:
 * ```ts
 * { path: 'users', canActivate: [permissionGuard], data: { permissions: ['users.view'] } }
 * ```
 * `requireAll: true` switches the check from "any of" to "all of".
 */
export const permissionGuard: CanActivateFn = (route) => {
  const permissions = inject(PermissionService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const required = (route.data['permissions'] as string[] | undefined) ?? [];
  const requireAll = Boolean(route.data['requireAll']);

  if (required.length === 0) {
    return true;
  }

  const allowed = requireAll ? permissions.hasAll(required) : permissions.hasAny(required);
  if (allowed) {
    return true;
  }

  toast.error('Access denied', 'You do not have permission to open that page.');
  return router.createUrlTree(['/error/403']);
};

/** Route-level role check, configured with `data: { roles: [...] }`. */
export const roleGuard: CanActivateFn = (route) => {
  const permissions = inject(PermissionService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const required = (route.data['roles'] as string[] | undefined) ?? [];
  if (required.length === 0 || permissions.hasAnyRole(required)) {
    return true;
  }

  toast.error('Access denied', 'Your role does not have access to that page.');
  return router.createUrlTree(['/error/403']);
};

/** Hides a route entirely when its feature flag is off. */
export const featureFlagGuard: CanActivateFn = (route) => {
  const flags = inject(FeatureFlagService);
  const auth = inject(AuthService);
  const router = inject(Router);

  const key = route.data['featureFlag'] as string | undefined;
  if (!key) {
    return true;
  }

  const roles = (auth.user()?.roles ?? []) as string[];
  return flags.isEnabled(key, roles) ? true : router.createUrlTree(['/error/404']);
};
