import type { Routes } from '@angular/router';

import { FEATURE_FLAGS } from '@core/constants/feature-flags.constants';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { featureFlagGuard, permissionGuard } from '@core/guards/permission.guard';

export const TICKETS_ROUTES: Routes = [
  {
    path: '',
    title: 'All Tickets',
    data: { breadcrumb: '' },
    loadComponent: () => import('./ticket-list/ticket-list').then((m) => m.TicketList),
  },
  {
    path: 'winning',
    title: 'Winning Tickets',
    data: { breadcrumb: 'Winning', mode: 'winning' },
    loadComponent: () => import('./ticket-list/ticket-list').then((m) => m.TicketList),
  },
  {
    path: 'cancelled',
    title: 'Cancelled Tickets',
    data: { breadcrumb: 'Cancelled', mode: 'cancelled' },
    loadComponent: () => import('./ticket-list/ticket-list').then((m) => m.TicketList),
  },
  {
    path: 'validate',
    title: 'Validate Ticket',
    data: {
      breadcrumb: 'Validate',
      permissions: [PERMISSIONS.tickets.validate],
      featureFlag: FEATURE_FLAGS.qrValidation,
    },
    canActivate: [permissionGuard, featureFlagGuard],
    loadComponent: () => import('./ticket-validate/ticket-validate').then((m) => m.TicketValidate),
  },
  {
    path: 'details/:id',
    title: 'Ticket Details',
    data: { breadcrumb: 'Details' },
    loadComponent: () => import('./ticket-detail/ticket-detail').then((m) => m.TicketDetail),
  },
];
