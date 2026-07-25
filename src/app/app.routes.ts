import type { Routes } from '@angular/router';

import { authGuard, guestGuard } from '@core/guards/auth.guard';
import { featureFlagGuard, permissionGuard } from '@core/guards/permission.guard';
import { PERMISSIONS } from '@core/constants/permission.constants';

/**
 * Root route table.
 *
 * Every feature is lazily loaded through `loadChildren`, guarded by
 * authentication plus a permission check, and annotated with `title` (consumed
 * by {@link AppTitleStrategy}), `breadcrumb` and `icon` so the shell can build
 * the trail without a per-page registry.
 *
 * `preload: true | 'idle'` marks the routes an operator almost always visits,
 * which the selective preloading strategy fetches once the first view settles.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },

  // ------------------------------------------------------------------ public
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () => import('@features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },

  // --------------------------------------------------------- authenticated
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () => import('@core/layout/main-layout/main-layout').then((m) => m.MainLayout),
    children: [
      {
        path: 'dashboard',
        title: 'Dashboard',
        data: { breadcrumb: 'Dashboard', icon: 'space_dashboard', preload: true },
        loadComponent: () => import('@features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'users',
        title: 'User Management',
        data: {
          breadcrumb: 'Users',
          icon: 'group',
          permissions: [PERMISSIONS.users.view],
          preload: 'idle',
        },
        canActivate: [permissionGuard],
        loadChildren: () => import('@features/users/users.routes').then((m) => m.USERS_ROUTES),
      },
      {
        path: 'agents',
        title: 'Agent Management',
        data: { breadcrumb: 'Agents', icon: 'handshake', permissions: [PERMISSIONS.agents.view] },
        canActivate: [permissionGuard],
        loadChildren: () => import('@features/agents/agents.routes').then((m) => m.AGENTS_ROUTES),
      },
      {
        path: 'retailers',
        title: 'Retailers',
        data: {
          breadcrumb: 'Retailers',
          icon: 'storefront',
          permissions: [PERMISSIONS.retailers.view],
        },
        canActivate: [permissionGuard],
        loadChildren: () => import('@features/retailers/retailers.routes').then((m) => m.RETAILERS_ROUTES),
      },
      {
        path: 'lottery',
        title: 'Lottery',
        data: { breadcrumb: 'Lottery', icon: 'casino', permissions: [PERMISSIONS.lottery.view] },
        canActivate: [permissionGuard],
        loadChildren: () => import('@features/lottery/lottery.routes').then((m) => m.LOTTERY_ROUTES),
      },
      {
        path: 'draws',
        title: 'Draw Management',
        data: {
          breadcrumb: 'Draws',
          icon: 'stadia_controller',
          permissions: [PERMISSIONS.draws.view],
          preload: 'idle',
        },
        canActivate: [permissionGuard],
        loadChildren: () => import('@features/draws/draws.routes').then((m) => m.DRAWS_ROUTES),
      },
      {
        path: 'tickets',
        title: 'Tickets',
        data: {
          breadcrumb: 'Tickets',
          icon: 'confirmation_number',
          permissions: [PERMISSIONS.tickets.view],
        },
        canActivate: [permissionGuard],
        loadChildren: () => import('@features/tickets/tickets.routes').then((m) => m.TICKETS_ROUTES),
      },
      {
        path: 'wallet',
        title: 'Wallet',
        data: {
          breadcrumb: 'Wallet',
          icon: 'account_balance_wallet',
          permissions: [PERMISSIONS.wallet.view],
        },
        canActivate: [permissionGuard],
        loadChildren: () => import('@features/wallet/wallet.routes').then((m) => m.WALLET_ROUTES),
      },
      {
        path: 'payment',
        title: 'Payments',
        data: { breadcrumb: 'Payments', icon: 'payments', permissions: [PERMISSIONS.payment.view] },
        canActivate: [permissionGuard],
        loadChildren: () => import('@features/payment/payment.routes').then((m) => m.PAYMENT_ROUTES),
      },
      {
        path: 'notifications',
        title: 'Notifications',
        data: {
          breadcrumb: 'Notifications',
          icon: 'notifications_active',
          permissions: [PERMISSIONS.notifications.view],
        },
        canActivate: [permissionGuard],
        loadChildren: () =>
          import('@features/notifications/notifications.routes').then((m) => m.NOTIFICATIONS_ROUTES),
      },
      {
        path: 'reports',
        title: 'Reports',
        data: { breadcrumb: 'Reports', icon: 'assessment', permissions: [PERMISSIONS.reports.view] },
        canActivate: [permissionGuard],
        loadChildren: () => import('@features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      {
        path: 'audit',
        title: 'Audit & Logs',
        data: { breadcrumb: 'Audit', icon: 'gavel', permissions: [PERMISSIONS.audit.view] },
        canActivate: [permissionGuard],
        loadChildren: () => import('@features/audit/audit.routes').then((m) => m.AUDIT_ROUTES),
      },
      {
        path: 'settings',
        title: 'Settings',
        data: { breadcrumb: 'Settings', icon: 'settings', permissions: [PERMISSIONS.settings.view] },
        canActivate: [permissionGuard],
        loadChildren: () => import('@features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      {
        path: 'profile',
        title: 'My Profile',
        data: {
          breadcrumb: 'Profile',
          icon: 'account_circle',
          permissions: [PERMISSIONS.profile.view],
        },
        canActivate: [permissionGuard],
        loadChildren: () => import('@features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
      },
      {
        path: 'search',
        title: 'Search',
        data: { breadcrumb: 'Search results', icon: 'search' },
        loadComponent: () => import('@features/search/search-results').then((m) => m.SearchResults),
      },
      {
        path: 'error',
        data: { breadcrumb: '' },
        loadChildren: () => import('@features/errors/errors.routes').then((m) => m.ERROR_ROUTES),
      },
    ],
  },

  // ---------------------------------------------------------------- fallback
  {
    path: '**',
    loadComponent: () => import('@features/errors/error-page').then((m) => m.ErrorPage),
    data: { code: 404 },
  },
];

/** Re-exported so route data stays discoverable next to the table. */
export { featureFlagGuard };
