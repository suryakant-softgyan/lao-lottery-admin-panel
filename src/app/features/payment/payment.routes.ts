import type { Routes } from '@angular/router';

import { FEATURE_FLAGS } from '@core/constants/feature-flags.constants';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { featureFlagGuard, permissionGuard } from '@core/guards/permission.guard';

export const PAYMENT_ROUTES: Routes = [
  {
    path: '',
    title: 'Payment Transactions',
    data: { breadcrumb: '' },
    loadComponent: () =>
      import('./payment-transactions/payment-transactions').then((m) => m.PaymentTransactions),
  },
  {
    path: 'gateways',
    title: 'Payment Gateways',
    data: { breadcrumb: 'Gateways', permissions: [PERMISSIONS.payment.gateways] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./payment-gateways/payment-gateways').then((m) => m.PaymentGateways),
  },
  {
    path: 'banks',
    title: 'Banks',
    data: { breadcrumb: 'Banks', permissions: [PERMISSIONS.payment.banks] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./banks/banks').then((m) => m.Banks),
  },
  {
    path: 'refunds',
    title: 'Refunds',
    data: { breadcrumb: 'Refunds', permissions: [PERMISSIONS.payment.refund] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./refunds/refunds').then((m) => m.Refunds),
  },
  {
    path: 'reconciliation',
    title: 'Reconciliation',
    data: {
      breadcrumb: 'Reconciliation',
      permissions: [PERMISSIONS.payment.reconcile],
      featureFlag: FEATURE_FLAGS.paymentReconciliation,
    },
    canActivate: [permissionGuard, featureFlagGuard],
    loadComponent: () => import('./reconciliation/reconciliation').then((m) => m.Reconciliation),
  },
];
