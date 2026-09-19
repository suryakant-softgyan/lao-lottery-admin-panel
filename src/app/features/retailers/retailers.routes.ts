import type { Routes } from '@angular/router';

import { PERMISSIONS } from '@core/constants/permission.constants';
import { FEATURE_FLAGS } from '@core/constants/feature-flags.constants';
import { featureFlagGuard, permissionGuard } from '@core/guards/permission.guard';

export const RETAILERS_ROUTES: Routes = [
  {
    path: '',
    title: 'Retailers',
    data: { breadcrumb: '' },
    loadComponent: () => import('./retailer-list/retailer-list').then((m) => m.RetailerList),
  },
  {
    path: 'devices',
    title: 'POS Devices',
    data: {
      breadcrumb: 'POS devices',
      permissions: [PERMISSIONS.retailers.devices],
      featureFlag: FEATURE_FLAGS.posDevices,
    },
    canActivate: [permissionGuard, featureFlagGuard],
    loadComponent: () => import('./pos-devices/pos-devices').then((m) => m.PosDevices),
  },
  {
    path: 'map',
    title: 'Coverage Map',
    data: { breadcrumb: 'Coverage map' },
    loadComponent: () => import('./coverage-map/coverage-map').then((m) => m.CoverageMap),
  },
  {
    path: 'details/:id',
    title: 'Retailer Details',
    data: { breadcrumb: 'Details' },
    loadComponent: () => import('./retailer-detail/retailer-detail').then((m) => m.RetailerDetail),
  },
];
