import { PLACEHOLDER } from '../constants/app.constants';
import { ROLE_PERMISSIONS } from '../constants/permission.constants';
import { UserRole } from '../enums';
import type { AuthenticatedUser } from '../models/auth.model';

export interface DemoAccount {
  username: string;
  password: string;
  /** Demo accounts with 2FA on route through the OTP screen after login. */
  requiresOtp: boolean;
  user: AuthenticatedUser;
}

function account(
  username: string,
  password: string,
  role: UserRole,
  fullName: string,
  designation: string,
  department: string,
  options: { requiresOtp?: boolean; mustChangePassword?: boolean } = {},
): DemoAccount {
  return {
    username,
    password,
    requiresOtp: options.requiresOtp ?? false,
    user: {
      id: `usr-${username}`,
      username,
      fullName,
      email: `${username}@laolottery.la`,
      phone: '+856 20 5555 0100',
      avatarUrl: PLACEHOLDER.avatar(fullName),
      primaryRole: role,
      roles: [role],
      permissions: ROLE_PERMISSIONS[role] ?? [],
      tenantId: 'lao-national-lottery',
      tenantName: 'Lao National Lottery',
      department,
      designation,
      language: 'en',
      timezone: 'Asia/Vientiane',
      mustChangePassword: options.mustChangePassword ?? false,
      twoFactorEnabled: options.requiresOtp ?? false,
      lastLoginAt: '2026-07-24T02:14:00.000Z',
    },
  };
}

/**
 * Demo credentials for the mock authentication backend.
 *
 * Every password is `Lottery@2026`, which is also shown on the login screen so
 * the portal can be explored without a running API. Replace
 * {@link AuthService.login}'s mock branch with the real `/auth/login` call and
 * this file can be deleted outright.
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  account(
    'superadmin',
    'Lottery@2026',
    UserRole.SuperAdmin,
    'Somsak Vongphachanh',
    'Chief Technology Officer',
    'Executive',
  ),
  account('admin', 'Lottery@2026', UserRole.Admin, 'Bounmy Sisouphanh', 'Head of Operations', 'Operations'),
  account(
    'subadmin',
    'Lottery@2026',
    UserRole.SubAdmin,
    'Khamla Phommachanh',
    'Regional Supervisor',
    'Operations',
  ),
  account(
    'operator',
    'Lottery@2026',
    UserRole.Operator,
    'Vilaysone Keodara',
    'Draw Operator',
    'Draw Management',
    { requiresOtp: true },
  ),
  account(
    'support',
    'Lottery@2026',
    UserRole.Support,
    'Noy Chanthavong',
    'Customer Support Lead',
    'Customer Care',
  ),
  account('finance', 'Lottery@2026', UserRole.Finance, 'Souphaphone Inthavong', 'Finance Manager', 'Finance'),
  account(
    'auditor',
    'Lottery@2026',
    UserRole.Auditor,
    'Thongdy Rattanavong',
    'Internal Auditor',
    'Compliance',
  ),
];

/** Shown on the login page so reviewers can switch roles quickly. */
export const DEMO_CREDENTIAL_HINTS: readonly { username: string; role: string; description: string }[] = [
  { username: 'superadmin', role: 'Super Admin', description: 'Unrestricted access to every module.' },
  { username: 'admin', role: 'Administrator', description: 'Full operations access, no tenant control.' },
  {
    username: 'operator',
    role: 'Draw Operator',
    description: 'Draw execution only — demonstrates OTP login.',
  },
  { username: 'finance', role: 'Finance', description: 'Wallet, payments, settlement and reports.' },
  { username: 'auditor', role: 'Auditor', description: 'Read-only across the platform plus audit logs.' },
];
