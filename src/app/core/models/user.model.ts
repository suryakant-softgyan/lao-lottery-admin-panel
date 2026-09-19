import type {
  DeviceType,
  DocumentStatus,
  DocumentType,
  Gender,
  KycStatus,
  UserRole,
  UserStatus,
  UserType,
} from '../enums';
import type { Address, AuditableEntity, ContactDetails } from './common.model';

export interface Permission {
  id: string;
  /** Dotted resource key, e.g. `users.create`. */
  code: string;
  name: string;
  module: string;
  description: string;
  /** Sensitive permissions require dual approval before they take effect. */
  sensitive: boolean;
}

export interface Role extends AuditableEntity {
  code: UserRole | string;
  name: string;
  description: string;
  /** Lower number = higher authority. Used to stop privilege escalation. */
  level: number;
  system: boolean;
  status: UserStatus;
  permissionCodes: string[];
  userCount: number;
}

export interface UserDocument {
  id: string;
  type: DocumentType;
  number: string;
  fileName: string;
  fileUrl: string;
  status: DocumentStatus;
  issuedAt?: string;
  expiresAt?: string;
  uploadedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  remarks?: string;
}

export interface LoginHistoryEntry {
  id: string;
  timestamp: string;
  ipAddress: string;
  location: string;
  device: string;
  deviceType: DeviceType;
  browser: string;
  os: string;
  success: boolean;
  failureReason?: string;
}

export interface DeviceHistoryEntry {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  os: string;
  appVersion?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  trusted: boolean;
  active: boolean;
}

export interface UserActivityEntry {
  id: string;
  timestamp: string;
  action: string;
  module: string;
  description: string;
  ipAddress: string;
}

export interface User extends AuditableEntity {
  code: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  displayName: string;
  avatarUrl: string;
  email: string;
  phone: string;
  gender: Gender;
  dateOfBirth?: string;
  nationalId?: string;
  type: UserType;
  roles: (UserRole | string)[];
  primaryRole: UserRole | string;
  permissionOverrides: string[];
  status: UserStatus;
  kycStatus: KycStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
  passwordUpdatedAt?: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  loginCount: number;
  failedLoginAttempts: number;
  lockedUntil?: string;
  department?: string;
  designation?: string;
  reportsTo?: string;
  tenantId: string;
  language: string;
  timezone: string;
  address?: Address;
  contact?: ContactDetails;
  documents: UserDocument[];
  notes?: string;
  tags: string[];
}

/** Payload for create / edit user forms. */
export interface UserPayload {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  gender: Gender;
  dateOfBirth?: string | null;
  nationalId?: string | null;
  type: UserType;
  primaryRole: UserRole | string;
  roles: (UserRole | string)[];
  status: UserStatus;
  department?: string | null;
  designation?: string | null;
  reportsTo?: string | null;
  language: string;
  timezone: string;
  address?: Partial<Address>;
  notes?: string | null;
  tags?: string[];
  permissionOverrides?: string[];
  sendWelcomeEmail?: boolean;
  requirePasswordChange?: boolean;
}
