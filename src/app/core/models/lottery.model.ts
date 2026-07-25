import type {
  ClaimStatus,
  DrawFrequency,
  DrawMode,
  DrawStatus,
  LotteryStatus,
  LotteryType,
  PrizeTierCode,
  TicketChannel,
  TicketStatus,
} from '../enums';
import type { AuditableEntity } from './common.model';

export interface PrizeTier {
  id: string;
  code: PrizeTierCode;
  name: string;
  /** Number of matching digits/positions required. */
  matchCriteria: string;
  /** Multiplier applied to the stake, when `fixedAmount` is 0. */
  multiplier: number;
  fixedAmount: number;
  maxWinners: number;
  taxPercent: number;
  order: number;
}

export interface LotteryConfiguration {
  openTime: string;
  closeTime: string;
  cutOffMinutes: number;
  minStake: number;
  maxStake: number;
  maxTicketsPerCustomer: number;
  maxExposurePerNumber: number;
  taxPercent: number;
  agentCommissionPercent: number;
  retailerCommissionPercent: number;
  allowCancellation: boolean;
  cancellationWindowMinutes: number;
  claimWindowDays: number;
}

export interface LotteryGame extends AuditableEntity {
  code: string;
  name: string;
  nameLo: string;
  type: LotteryType;
  status: LotteryStatus;
  description: string;
  frequency: DrawFrequency;
  drawDays: string[];
  digitCount: number;
  bannerUrl: string;
  iconUrl: string;
  colour: string;
  configuration: LotteryConfiguration;
  prizeTiers: PrizeTier[];
  totalDraws: number;
  activeDraws: number;
  ticketsSoldToday: number;
  salesToday: number;
  salesMonth: number;
  popularityScore: number;
  tenantId: string;
}

export interface DrawWinningNumber {
  tierCode: PrizeTierCode;
  tierName: string;
  numbers: string[];
  winnerCount: number;
  prizePerWinner: number;
  totalPayout: number;
}

export interface DrawVerification {
  verifiedBy?: string;
  verifiedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  witnessNames: string[];
  checksum: string;
  remarks?: string;
}

export interface Draw extends AuditableEntity {
  code: string;
  lotteryId: string;
  lotteryName: string;
  lotteryType: LotteryType;
  drawNumber: number;
  status: DrawStatus;
  mode: DrawMode;
  scheduledAt: string;
  salesOpenAt: string;
  salesCloseAt: string;
  drawnAt?: string;
  publishedAt?: string;
  winningNumbers: DrawWinningNumber[];
  ticketsSold: number;
  salesAmount: number;
  winnerCount: number;
  payoutAmount: number;
  grossProfit: number;
  taxCollected: number;
  commissionPaid: number;
  jackpotAmount: number;
  rolloverAmount: number;
  verification: DrawVerification;
  streamUrl?: string;
  rollbackReason?: string;
  cancelledReason?: string;
  tenantId: string;
}

export interface TicketLine {
  id: string;
  numbers: string[];
  betType: string;
  stake: number;
  potentialPayout: number;
  won: boolean;
  matchedTier?: PrizeTierCode;
  payout: number;
}

export interface Ticket extends AuditableEntity {
  ticketNumber: string;
  serialNumber: string;
  barcode: string;
  qrPayload: string;
  drawId: string;
  drawCode: string;
  lotteryId: string;
  lotteryName: string;
  lotteryType: LotteryType;
  status: TicketStatus;
  channel: TicketChannel;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  retailerId?: string;
  retailerName?: string;
  agentId?: string;
  agentName?: string;
  deviceId?: string;
  lines: TicketLine[];
  totalStake: number;
  totalPayout: number;
  taxDeducted: number;
  netPayout: number;
  purchasedAt: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  claimStatus: ClaimStatus;
  claimedAt?: string;
  claimedBy?: string;
  validatedAt?: string;
  validatedBy?: string;
  expiresAt: string;
  province: string;
  tenantId: string;
}

/** Read model used by the "recent winners" widgets. */
export interface WinnerSummary {
  id: string;
  ticketNumber: string;
  customerName: string;
  customerAvatar: string;
  lotteryName: string;
  drawCode: string;
  tier: PrizeTierCode;
  prizeAmount: number;
  province: string;
  wonAt: string;
  claimStatus: ClaimStatus;
}
