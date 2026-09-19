import type { Routes } from '@angular/router';

import { FEATURE_FLAGS } from '@core/constants/feature-flags.constants';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { featureFlagGuard, permissionGuard } from '@core/guards/permission.guard';

export const WALLET_ROUTES: Routes = [
  {
    path: '',
    title: 'Wallet Accounts',
    data: { breadcrumb: '' },
    loadComponent: () => import('./wallet-list/wallet-list').then((m) => m.WalletList),
  },
  {
    path: 'transactions',
    title: 'Wallet Transactions',
    data: { breadcrumb: 'Transactions' },
    loadComponent: () =>
      import('./wallet-transactions/wallet-transactions').then((m) => m.WalletTransactions),
  },
  {
    path: 'transfer',
    title: 'Transfer & Adjust',
    data: {
      breadcrumb: 'Transfer',
      permissions: [PERMISSIONS.wallet.transfer],
      featureFlag: FEATURE_FLAGS.walletTransfer,
    },
    canActivate: [permissionGuard, featureFlagGuard],
    loadComponent: () => import('./wallet-transfer/wallet-transfer').then((m) => m.WalletTransfer),
  },
  {
    path: 'settlement',
    title: 'Settlements',
    data: { breadcrumb: 'Settlements', permissions: [PERMISSIONS.agents.settlement] },
    canActivate: [permissionGuard],
    loadComponent: () => import('./settlements/settlements').then((m) => m.Settlements),
  },
];
