import type { Routes } from '@angular/router';

import { FEATURE_FLAGS } from '@core/constants/feature-flags.constants';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { featureFlagGuard, permissionGuard } from '@core/guards/permission.guard';

export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    title: 'Notification Centre',
    data: { breadcrumb: '' },
    loadComponent: () =>
      import('./notification-centre/notification-centre').then((m) => m.NotificationCentre),
  },
  {
    path: 'templates',
    title: 'Templates',
    data: { breadcrumb: 'Templates', permissions: [PERMISSIONS.notifications.templates] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./templates/templates').then((m) => m.Templates),
  },
  {
    path: 'campaigns',
    title: 'Campaigns',
    data: {
      breadcrumb: 'Campaigns',
      permissions: [PERMISSIONS.notifications.create],
      featureFlag: FEATURE_FLAGS.campaigns,
    },
    canActivate: [permissionGuard, featureFlagGuard],
    loadComponent: () => import('./campaigns/campaigns').then((m) => m.Campaigns),
  },
  {
    path: 'segments',
    title: 'Segments',
    data: { breadcrumb: 'Segments', permissions: [PERMISSIONS.notifications.segments] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./segments/segments').then((m) => m.Segments),
  },
];
