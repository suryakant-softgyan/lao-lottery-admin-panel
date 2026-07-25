import type { Routes } from '@angular/router';

import { FEATURE_FLAGS } from '@core/constants/feature-flags.constants';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { featureFlagGuard, permissionGuard } from '@core/guards/permission.guard';

export const DRAWS_ROUTES: Routes = [
  {
    path: '',
    title: 'All Draws',
    data: { breadcrumb: '' },
    loadComponent: () => import('./draw-list/draw-list').then((m) => m.DrawList),
  },
  {
    path: 'schedule',
    title: 'Draw Schedule',
    data: { breadcrumb: 'Schedule', permissions: [PERMISSIONS.draws.schedule] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./draw-schedule/draw-schedule').then((m) => m.DrawSchedule),
  },
  {
    path: 'live',
    title: 'Live Draw Studio',
    data: {
      breadcrumb: 'Live studio',
      permissions: [PERMISSIONS.draws.execute],
      featureFlag: FEATURE_FLAGS.liveDraw,
    },
    canActivate: [permissionGuard, featureFlagGuard],
    loadComponent: () => import('./live-draw/live-draw').then((m) => m.LiveDraw),
  },
  {
    path: 'results',
    title: 'Results & Verification',
    data: { breadcrumb: 'Results', permissions: [PERMISSIONS.draws.verify] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./draw-results/draw-results').then((m) => m.DrawResults),
  },
  {
    path: 'details/:id',
    title: 'Draw Details',
    data: { breadcrumb: 'Details' },
    loadComponent: () => import('./draw-detail/draw-detail').then((m) => m.DrawDetail),
  },
];
