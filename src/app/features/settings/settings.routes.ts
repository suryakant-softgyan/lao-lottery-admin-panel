import type { Routes } from '@angular/router';

import { FEATURE_FLAGS } from '@core/constants/feature-flags.constants';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { featureFlagGuard, permissionGuard } from '@core/guards/permission.guard';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    title: 'General Settings',
    data: { breadcrumb: '', permissions: [PERMISSIONS.settings.general] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./general/general').then((m) => m.GeneralSettings),
  },
  {
    path: 'appearance',
    title: 'Appearance',
    data: { breadcrumb: 'Appearance', permissions: [PERMISSIONS.settings.appearance] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./appearance/appearance').then((m) => m.Appearance),
  },
  {
    path: 'branding',
    title: 'Branding & White Label',
    data: {
      breadcrumb: 'Branding',
      permissions: [PERMISSIONS.settings.branding],
      featureFlag: FEATURE_FLAGS.whiteLabelling,
    },
    canActivate: [permissionGuard, featureFlagGuard],
    loadComponent: () => import('./branding/branding').then((m) => m.Branding),
  },
  {
    path: 'financial',
    title: 'Financial Rules',
    data: { breadcrumb: 'Financial rules', permissions: [PERMISSIONS.settings.commission] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./financial/financial').then((m) => m.FinancialSettings),
  },
  {
    path: 'notifications',
    title: 'Notification Rules',
    data: { breadcrumb: 'Notification rules', permissions: [PERMISSIONS.settings.notification] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./notification-rules/notification-rules').then((m) => m.NotificationRules),
  },
  {
    path: 'feature-flags',
    title: 'Feature Flags',
    data: { breadcrumb: 'Feature flags', permissions: [PERMISSIONS.settings.featureFlags] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./feature-flags/feature-flags').then((m) => m.FeatureFlags),
  },
  {
    path: 'about',
    title: 'About & System',
    data: { breadcrumb: 'About' },
    loadComponent: () => import('./about/about').then((m) => m.About),
  },
];
