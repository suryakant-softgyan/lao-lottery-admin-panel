import type { Routes } from '@angular/router';

import { PERMISSIONS } from '@core/constants/permission.constants';
import { permissionGuard } from '@core/guards/permission.guard';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    title: 'My Profile',
    data: { breadcrumb: '' },
    loadComponent: () => import('./profile-overview/profile-overview').then((m) => m.ProfileOverview),
  },
  {
    path: 'security',
    title: 'Password & Security',
    data: { breadcrumb: 'Security', permissions: [PERMISSIONS.profile.changePassword] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./profile-security/profile-security').then((m) => m.ProfileSecurity),
  },
];
