import type { LoginResult, UserRole } from '../enums';
import type { User } from './user.model';

export interface LoginRequest {
  username: string;
  password: string;
  rememberMe: boolean;
  tenantId?: string;
  captchaToken?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Epoch milliseconds at which the access token stops being valid. */
  expiresAt: number;
  /** Epoch milliseconds at which the refresh token stops being valid. */
  refreshExpiresAt: number;
}

export interface LoginResponse {
  result: LoginResult;
  tokens?: AuthTokens;
  user?: AuthenticatedUser;
  /** Present when `result === MFA_REQUIRED`. */
  challengeId?: string;
  challengeTarget?: string;
  message?: string;
}

/** Slim projection of {@link User} kept in memory for the whole session. */
export interface AuthenticatedUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  primaryRole: UserRole | string;
  roles: (UserRole | string)[];
  permissions: string[];
  tenantId: string;
  tenantName: string;
  department?: string;
  designation?: string;
  language: string;
  timezone: string;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
}

export interface OtpVerifyRequest {
  challengeId: string;
  code: string;
}

export interface ForgotPasswordRequest {
  identifier: string;
  channel: 'EMAIL' | 'SMS';
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** Convenience mapper used by the mock backend and by the real API adapter. */
export function toAuthenticatedUser(
  user: User,
  permissions: string[],
  tenantName: string,
): AuthenticatedUser {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    primaryRole: user.primaryRole,
    roles: user.roles,
    permissions,
    tenantId: user.tenantId,
    tenantName,
    department: user.department,
    designation: user.designation,
    language: user.language,
    timezone: user.timezone,
    mustChangePassword: user.mustChangePassword,
    twoFactorEnabled: user.twoFactorEnabled,
    lastLoginAt: user.lastLoginAt,
  };
}
