import type { Routes } from '@angular/router';

import { PERMISSIONS } from '@core/constants/permission.constants';
import { permissionGuard } from '@core/guards/permission.guard';

export const LOTTERY_ROUTES: Routes = [
  {
    path: '',
    title: 'Lottery Types',
    data: { breadcrumb: '' },
    loadComponent: () => import('./lottery-list/lottery-list').then((m) => m.LotteryList),
  },
  {
    path: 'configuration',
    title: 'Lottery Configuration',
    data: { breadcrumb: 'Configuration', permissions: [PERMISSIONS.lottery.configure] },
    canActivate: [permissionGuard],
    loadComponent: () =>
      import('./lottery-configuration/lottery-configuration').then((m) => m.LotteryConfigurationPage),
  },
  {
    path: 'prizes',
    title: 'Prize Structure',
    data: { breadcrumb: 'Prize structure', permissions: [PERMISSIONS.lottery.prizes] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./prize-structure/prize-structure').then((m) => m.PrizeStructure),
  },
];
