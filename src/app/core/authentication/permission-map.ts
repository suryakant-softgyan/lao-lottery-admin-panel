/**
 * The API and this panel grew their permission catalogues independently. The API is the source of
 * truth for *what a user may do*; this table translates each API code into the panel code(s) that
 * guard the matching menus, routes and buttons. Unknown API codes pass through unchanged.
 */
const API_TO_PANEL: Readonly<Record<string, readonly string[]>> = {
  'dashboard.view': ['dashboard.view', 'dashboard.customise', 'profile.view', 'profile.update', 'profile.change-password'],

  'users.view': ['users.view', 'users.export'],
  'users.status': ['users.suspend'],
  'users.kyc': ['users.approve'],
  'users.reset-password': ['users.reset-password'],
  'roles.view': ['roles.view'],
  'roles.manage': ['roles.create', 'roles.update', 'roles.delete', 'roles.assign-permissions'],

  'agents.view': ['agents.view', 'agents.export'],
  'agents.status': ['agents.suspend', 'agents.block'],
  'agents.update': ['agents.update', 'agents.commission'],
  'settlements.view': ['agents.settlement'],

  'retailers.view': ['retailers.view', 'retailers.export'],
  'retailers.status': ['retailers.suspend'],
  'pos.view': ['retailers.devices'],
  'pos.manage': ['retailers.devices', 'retailers.activate-device'],

  'lottery.update': ['lottery.update', 'lottery.configure', 'lottery.prizes'],
  'lottery.status': ['lottery.update'],

  'draws.create': ['draws.create', 'draws.schedule'],

  'tickets.view': ['tickets.view', 'tickets.export'],
  'tickets.cancel': ['tickets.cancel', 'tickets.void'],
  'tickets.claims': ['tickets.payout'],

  'wallets.view': ['wallet.view', 'wallet.export'],
  'wallets.freeze': ['wallet.freeze', 'wallet.unfreeze'],
  'wallets.adjust': ['wallet.adjust', 'wallet.credit', 'wallet.debit', 'wallet.transfer'],

  'payments.view': ['payment.view', 'payment.export'],
  'payments.gateways': ['payment.gateways', 'payment.banks'],
  'payments.refund': ['payment.refund'],
  'payments.refund-approve': ['payment.refund'],
  'payments.reconcile': ['payment.reconcile'],
  'payments.withdrawals': ['payment.retry'],
  'settlements.approve': ['payment.settle'],
  'settlements.pay': ['payment.settle'],

  'notifications.campaigns': ['notifications.create', 'notifications.segments'],
  'notifications.send': ['notifications.send', 'notifications.broadcast'],

  'reports.view': ['reports.view', 'reports.sales', 'reports.revenue', 'reports.commission', 'reports.tax', 'reports.winners'],

  'audit.view': ['audit.view', 'audit.security', 'audit.api'],

  'settings.view': ['settings.view', 'settings.appearance'],
  'settings.manage': [
    'settings.general',
    'settings.lottery',
    'settings.payment',
    'settings.wallet',
    'settings.commission',
    'settings.tax',
    'settings.notification',
  ],
  'settings.branding': ['settings.branding'],
  'settings.feature-flags': ['settings.feature-flags', 'settings.tenants'],
};

/** Reverse lookup used when the permission matrix is saved back to the API. */
const PANEL_TO_API: Readonly<Record<string, string>> = (() => {
  const reverse: Record<string, string> = {};
  for (const [api, panel] of Object.entries(API_TO_PANEL)) {
    for (const code of panel) {
      reverse[code] ??= api;
    }
  }
  return reverse;
})();

export function toPanelPermissions(apiCodes: readonly string[]): string[] {
  const result = new Set<string>();
  for (const code of apiCodes) {
    result.add(code);
    for (const mapped of API_TO_PANEL[code] ?? []) {
      result.add(mapped);
    }
  }
  return [...result];
}

export function toApiPermissions(panelCodes: readonly string[], known: ReadonlySet<string>): string[] {
  const result = new Set<string>();
  for (const code of panelCodes) {
    if (known.has(code)) {
      result.add(code);
    } else if (PANEL_TO_API[code] && known.has(PANEL_TO_API[code])) {
      result.add(PANEL_TO_API[code]);
    }
  }
  return [...result];
}
