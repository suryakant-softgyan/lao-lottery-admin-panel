import type {
  AgentStatus,
  AgentTier,
  CommissionModel,
  KycStatus,
  PosDeviceModel,
  PosDeviceStatus,
  RetailerStatus,
  ShopType,
} from '../enums';
import type { Address, AuditableEntity, ContactDetails } from './common.model';
import type { UserDocument } from './user.model';

export interface CommissionRule {
  id: string;
  lotteryType: string;
  model: CommissionModel;
  /** Percentage points when `model` is PERCENTAGE / HYBRID. */
  rate: number;
  /** Flat LAK amount when `model` is FLAT / HYBRID. */
  flatAmount: number;
  minSales?: number;
  maxSales?: number;
  effectiveFrom: string;
  effectiveTo?: string;
  active: boolean;
}

export interface AgentPerformance {
  ticketsSold: number;
  salesAmount: number;
  commissionEarned: number;
  activeRetailers: number;
  winningTickets: number;
  payoutAmount: number;
  targetAmount: number;
  achievementPercent: number;
  rank: number;
  monthlyTrend: number[];
}

export interface Agent extends AuditableEntity {
  code: string;
  name: string;
  businessName: string;
  tier: AgentTier;
  parentAgentId?: string;
  parentAgentName?: string;
  status: AgentStatus;
  kycStatus: KycStatus;
  userId: string;
  contact: ContactDetails;
  address: Address;
  province: string;
  district: string;
  territory: string;
  walletId: string;
  walletBalance: number;
  creditLimit: number;
  outstandingBalance: number;
  commissionRules: CommissionRule[];
  performance: AgentPerformance;
  documents: UserDocument[];
  contractStartDate: string;
  contractEndDate?: string;
  taxId?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankName?: string;
  retailerCount: number;
  deviceCount: number;
  suspendedReason?: string;
  blockedReason?: string;
  avatarUrl: string;
  tenantId: string;
  notes?: string;
}

export interface PosDevice extends AuditableEntity {
  serialNumber: string;
  imei: string;
  model: PosDeviceModel;
  status: PosDeviceStatus;
  retailerId?: string;
  retailerName?: string;
  agentId?: string;
  qrCode?: string;
  firmwareVersion: string;
  appVersion: string;
  activatedAt?: string;
  lastHeartbeatAt?: string;
  batteryLevel?: number;
  simNumber?: string;
  network?: string;
  ticketsToday: number;
  salesToday: number;
  latitude?: number;
  longitude?: number;
  tenantId: string;
}

export interface Retailer extends AuditableEntity {
  code: string;
  shopName: string;
  ownerName: string;
  shopType: ShopType;
  status: RetailerStatus;
  kycStatus: KycStatus;
  agentId: string;
  agentName: string;
  contact: ContactDetails;
  address: Address;
  province: string;
  district: string;
  latitude: number;
  longitude: number;
  openingTime: string;
  closingTime: string;
  walletId: string;
  walletBalance: number;
  creditLimit: number;
  commissionRate: number;
  deviceCount: number;
  devices: PosDevice[];
  ticketsToday: number;
  salesToday: number;
  salesMonth: number;
  rating: number;
  photoUrl: string;
  licenceNumber?: string;
  licenceExpiry?: string;
  tenantId: string;
  notes?: string;
}
