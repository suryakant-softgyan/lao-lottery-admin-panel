import type { Routes } from '@angular/router';

import { AuditCategory } from '@core/enums';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { permissionGuard } from '@core/guards/permission.guard';

/**
 * Audit views.
 *
 * All five routes render the same component; `data.categories` and `data.copy`
 * select which slice of the trail is shown.
 */
export const AUDIT_ROUTES: Routes = [
  {
    path: '',
    title: 'Activity Audit',
    data: {
      breadcrumb: '',
      categories: [AuditCategory.Activity],
      copy: {
        title: 'Activity Audit',
        subtitle: 'Every create, update, delete and approval performed in the portal.',
        icon: 'history',
      },
    },
    loadComponent: () => import('./audit-log/audit-log').then((m) => m.AuditLogPage),
  },
  {
    path: 'login',
    title: 'Login Audit',
    data: {
      breadcrumb: 'Login',
      categories: [AuditCategory.Login],
      copy: {
        title: 'Login Audit',
        subtitle: 'Sign-in and sign-out events with device, location and outcome.',
        icon: 'login',
      },
    },
    loadComponent: () => import('./audit-log/audit-log').then((m) => m.AuditLogPage),
  },
  {
    path: 'transaction',
    title: 'Transaction Audit',
    data: {
      breadcrumb: 'Transaction',
      categories: [AuditCategory.Transaction],
      copy: {
        title: 'Transaction Audit',
        subtitle: 'Financial movements with the operator responsible for each one.',
        icon: 'receipt_long',
      },
    },
    loadComponent: () => import('./audit-log/audit-log').then((m) => m.AuditLogPage),
  },
  {
    path: 'security',
    title: 'Security Logs',
    data: {
      breadcrumb: 'Security',
      categories: [AuditCategory.Security],
      permissions: [PERMISSIONS.audit.security],
      copy: {
        title: 'Security Logs',
        subtitle: 'Permission changes, lockouts and anything the risk rules flagged.',
        icon: 'shield',
      },
    },
    canActivate: [permissionGuard],
    loadComponent: () => import('./audit-log/audit-log').then((m) => m.AuditLogPage),
  },
  {
    path: 'api',
    title: 'API & Error Logs',
    data: {
      breadcrumb: 'API & errors',
      categories: [AuditCategory.Api, AuditCategory.Error],
      permissions: [PERMISSIONS.audit.api],
      copy: {
        title: 'API & Error Logs',
        subtitle: 'Gateway calls and unhandled failures, with status codes and durations.',
        icon: 'bug_report',
      },
    },
    canActivate: [permissionGuard],
    loadComponent: () => import('./audit-log/audit-log').then((m) => m.AuditLogPage),
  },
];
