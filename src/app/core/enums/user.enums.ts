/**
 * Identity & access enums.
 *
 * Values are the exact strings the backend contract uses, so DTOs can be cast
 * directly once the mock repositories are swapped for HTTP calls.
 */

export enum UserRole {
  SuperAdmin = 'SUPER_ADMIN',
  Admin = 'ADMIN',
  SubAdmin = 'SUB_ADMIN',
  Operator = 'OPERATOR',
  Support = 'SUPPORT',
  Auditor = 'AUDITOR',
  Finance = 'FINANCE',
  Agent = 'AGENT',
  Retailer = 'RETAILER',
  Customer = 'CUSTOMER',
}

export enum UserStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Pending = 'PENDING',
  Suspended = 'SUSPENDED',
  Blocked = 'BLOCKED',
  Locked = 'LOCKED',
}

export enum UserType {
  Customer = 'CUSTOMER',
  Admin = 'ADMIN',
  SubAdmin = 'SUB_ADMIN',
  Operator = 'OPERATOR',
  Support = 'SUPPORT',
}

export enum KycStatus {
  NotSubmitted = 'NOT_SUBMITTED',
  Pending = 'PENDING',
  UnderReview = 'UNDER_REVIEW',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  Expired = 'EXPIRED',
}

export enum Gender {
  Male = 'MALE',
  Female = 'FEMALE',
  Other = 'OTHER',
  Undisclosed = 'UNDISCLOSED',
}

export enum DocumentType {
  NationalId = 'NATIONAL_ID',
  Passport = 'PASSPORT',
  DrivingLicence = 'DRIVING_LICENCE',
  FamilyBook = 'FAMILY_BOOK',
  BusinessLicence = 'BUSINESS_LICENCE',
  TaxCertificate = 'TAX_CERTIFICATE',
  BankStatement = 'BANK_STATEMENT',
  ProofOfAddress = 'PROOF_OF_ADDRESS',
  Other = 'OTHER',
}

export enum DocumentStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  Expired = 'EXPIRED',
}

export enum DeviceType {
  Web = 'WEB',
  Android = 'ANDROID',
  Ios = 'IOS',
  Pos = 'POS',
  Kiosk = 'KIOSK',
}

export enum LoginResult {
  Success = 'SUCCESS',
  InvalidCredentials = 'INVALID_CREDENTIALS',
  MfaRequired = 'MFA_REQUIRED',
  AccountLocked = 'ACCOUNT_LOCKED',
  AccountSuspended = 'ACCOUNT_SUSPENDED',
  ExpiredPassword = 'EXPIRED_PASSWORD',
}
