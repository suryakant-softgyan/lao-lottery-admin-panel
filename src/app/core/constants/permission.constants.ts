import { UserRole } from '../enums';

/**
 * Canonical permission catalogue.
 *
 * Codes follow `<module>.<action>`. The RBAC layer only ever compares these
 * strings, so a backend can hand back its own list without any client change.
 */
export const PERMISSIONS = {
  dashboard: {
    view: 'dashboard.view',
    customise: 'dashboard.customise',
  },
  users: {
    view: 'users.view',
    create: 'users.create',
    update: 'users.update',
    delete: 'users.delete',
    approve: 'users.approve',
    suspend: 'users.suspend',
    resetPassword: 'users.reset-password',
    impersonate: 'users.impersonate',
    export: 'users.export',
  },
  roles: {
    view: 'roles.view',
    create: 'roles.create',
    update: 'roles.update',
    delete: 'roles.delete',
    assignPermissions: 'roles.assign-permissions',
  },
  agents: {
    view: 'agents.view',
    create: 'agents.create',
    update: 'agents.update',
    delete: 'agents.delete',
    approve: 'agents.approve',
    suspend: 'agents.suspend',
    block: 'agents.block',
    commission: 'agents.commission',
    settlement: 'agents.settlement',
    export: 'agents.export',
  },
  retailers: {
    view: 'retailers.view',
    create: 'retailers.create',
    update: 'retailers.update',
    delete: 'retailers.delete',
    approve: 'retailers.approve',
    devices: 'retailers.devices',
    activateDevice: 'retailers.activate-device',
    export: 'retailers.export',
  },
  lottery: {
    view: 'lottery.view',
    create: 'lottery.create',
    update: 'lottery.update',
    delete: 'lottery.delete',
    configure: 'lottery.configure',
    prizes: 'lottery.prizes',
  },
  draws: {
    view: 'draws.view',
    create: 'draws.create',
    update: 'draws.update',
    schedule: 'draws.schedule',
    execute: 'draws.execute',
    publish: 'draws.publish',
    verify: 'draws.verify',
    rollback: 'draws.rollback',
    cancel: 'draws.cancel',
  },
  tickets: {
    view: 'tickets.view',
    validate: 'tickets.validate',
    cancel: 'tickets.cancel',
    void: 'tickets.void',
    payout: 'tickets.payout',
    export: 'tickets.export',
  },
  wallet: {
    view: 'wallet.view',
    credit: 'wallet.credit',
    debit: 'wallet.debit',
    transfer: 'wallet.transfer',
    freeze: 'wallet.freeze',
    unfreeze: 'wallet.unfreeze',
    adjust: 'wallet.adjust',
    export: 'wallet.export',
  },
  payment: {
    view: 'payment.view',
    gateways: 'payment.gateways',
    banks: 'payment.banks',
    refund: 'payment.refund',
    reconcile: 'payment.reconcile',
    settle: 'payment.settle',
    retry: 'payment.retry',
    export: 'payment.export',
  },
  notifications: {
    view: 'notifications.view',
    create: 'notifications.create',
    send: 'notifications.send',
    broadcast: 'notifications.broadcast',
    templates: 'notifications.templates',
    segments: 'notifications.segments',
  },
  reports: {
    view: 'reports.view',
    sales: 'reports.sales',
    revenue: 'reports.revenue',
    commission: 'reports.commission',
    tax: 'reports.tax',
    winners: 'reports.winners',
    export: 'reports.export',
  },
  audit: {
    view: 'audit.view',
    security: 'audit.security',
    api: 'audit.api',
    export: 'audit.export',
  },
  settings: {
    view: 'settings.view',
    general: 'settings.general',
    lottery: 'settings.lottery',
    payment: 'settings.payment',
    wallet: 'settings.wallet',
    commission: 'settings.commission',
    tax: 'settings.tax',
    notification: 'settings.notification',
    appearance: 'settings.appearance',
    branding: 'settings.branding',
    featureFlags: 'settings.feature-flags',
    tenants: 'settings.tenants',
  },
  profile: {
    view: 'profile.view',
    update: 'profile.update',
    changePassword: 'profile.change-password',
  },
} as const;

/** Flattened list of every permission code in the catalogue. */
export const ALL_PERMISSIONS: string[] = Object.values(PERMISSIONS).flatMap((group) =>
  Object.values(group as Record<string, string>),
);

const READ_ONLY_PERMISSIONS: string[] = ALL_PERMISSIONS.filter(
  (code) => code.endsWith('.view') || code.endsWith('.export'),
);

/**
 * Default role → permission mapping used by the mock backend. In production the
 * gateway returns the effective permission list at login and this map is only a
 * fallback for offline/PWA cold starts.
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  [UserRole.SuperAdmin]: ALL_PERMISSIONS,
  [UserRole.Admin]: ALL_PERMISSIONS.filter(
    (code) =>
      !['settings.tenants', 'users.impersonate', 'draws.rollback'].includes(code) &&
      !code.endsWith('.delete'),
  ),
  [UserRole.SubAdmin]: [
    ...READ_ONLY_PERMISSIONS,
    PERMISSIONS.users.create,
    PERMISSIONS.users.update,
    PERMISSIONS.agents.create,
    PERMISSIONS.agents.update,
    PERMISSIONS.retailers.create,
    PERMISSIONS.retailers.update,
    PERMISSIONS.draws.create,
    PERMISSIONS.draws.schedule,
    PERMISSIONS.tickets.validate,
    PERMISSIONS.notifications.create,
    PERMISSIONS.profile.update,
    PERMISSIONS.profile.changePassword,
  ],
  [UserRole.Operator]: [
    PERMISSIONS.dashboard.view,
    PERMISSIONS.lottery.view,
    PERMISSIONS.draws.view,
    PERMISSIONS.draws.create,
    PERMISSIONS.draws.schedule,
    PERMISSIONS.draws.execute,
    PERMISSIONS.draws.publish,
    PERMISSIONS.tickets.view,
    PERMISSIONS.tickets.validate,
    PERMISSIONS.reports.view,
    PERMISSIONS.reports.sales,
    PERMISSIONS.profile.view,
    PERMISSIONS.profile.update,
    PERMISSIONS.profile.changePassword,
  ],
  [UserRole.Support]: [
    PERMISSIONS.dashboard.view,
    PERMISSIONS.users.view,
    PERMISSIONS.users.update,
    PERMISSIONS.agents.view,
    PERMISSIONS.retailers.view,
    PERMISSIONS.tickets.view,
    PERMISSIONS.tickets.validate,
    PERMISSIONS.wallet.view,
    PERMISSIONS.payment.view,
    PERMISSIONS.notifications.view,
    PERMISSIONS.notifications.create,
    PERMISSIONS.profile.view,
    PERMISSIONS.profile.update,
    PERMISSIONS.profile.changePassword,
  ],
  [UserRole.Auditor]: [
    ...READ_ONLY_PERMISSIONS,
    PERMISSIONS.audit.security,
    PERMISSIONS.audit.api,
    PERMISSIONS.profile.changePassword,
  ],
  [UserRole.Finance]: [
    PERMISSIONS.dashboard.view,
    PERMISSIONS.wallet.view,
    PERMISSIONS.wallet.credit,
    PERMISSIONS.wallet.debit,
    PERMISSIONS.wallet.transfer,
    PERMISSIONS.wallet.freeze,
    PERMISSIONS.wallet.unfreeze,
    PERMISSIONS.wallet.export,
    PERMISSIONS.payment.view,
    PERMISSIONS.payment.refund,
    PERMISSIONS.payment.reconcile,
    PERMISSIONS.payment.settle,
    PERMISSIONS.payment.export,
    PERMISSIONS.agents.settlement,
    PERMISSIONS.reports.view,
    PERMISSIONS.reports.revenue,
    PERMISSIONS.reports.commission,
    PERMISSIONS.reports.tax,
    PERMISSIONS.reports.export,
    PERMISSIONS.profile.view,
    PERMISSIONS.profile.update,
    PERMISSIONS.profile.changePassword,
  ],
};

/** Human-readable metadata for the permission matrix screen. */
export const PERMISSION_MODULES: { key: string; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'users', label: 'User Management', icon: 'group' },
  { key: 'roles', label: 'Roles & Permissions', icon: 'admin_panel_settings' },
  { key: 'agents', label: 'Agent Management', icon: 'handshake' },
  { key: 'retailers', label: 'Retailers', icon: 'storefront' },
  { key: 'lottery', label: 'Lottery', icon: 'casino' },
  { key: 'draws', label: 'Draw Management', icon: 'stadia_controller' },
  { key: 'tickets', label: 'Tickets', icon: 'confirmation_number' },
  { key: 'wallet', label: 'Wallet', icon: 'account_balance_wallet' },
  { key: 'payment', label: 'Payments', icon: 'payments' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications_active' },
  { key: 'reports', label: 'Reports', icon: 'assessment' },
  { key: 'audit', label: 'Audit', icon: 'gavel' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
  { key: 'profile', label: 'Profile', icon: 'person' },
];
