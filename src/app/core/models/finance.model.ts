import type {
  PaymentGatewayStatus,
  PaymentMethod,
  ReconciliationStatus,
  RefundStatus,
  SettlementStatus,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
  WalletOwnerType,
  WalletStatus,
} from '../enums';
import type { AuditableEntity } from './common.model';

export interface Wallet extends AuditableEntity {
  code: string;
  ownerId: string;
  ownerName: string;
  ownerType: WalletOwnerType;
  ownerAvatar: string;
  status: WalletStatus;
  currency: string;
  balance: number;
  availableBalance: number;
  heldBalance: number;
  creditLimit: number;
  lifetimeCredit: number;
  lifetimeDebit: number;
  lastTransactionAt?: string;
  frozenAt?: string;
  frozenBy?: string;
  freezeReason?: string;
  province?: string;
  tenantId: string;
}

export interface WalletTransaction extends AuditableEntity {
  reference: string;
  walletId: string;
  walletCode: string;
  ownerName: string;
  ownerType: WalletOwnerType;
  type: TransactionType;
  direction: TransactionDirection;
  status: TransactionStatus;
  amount: number;
  fee: number;
  tax: number;
  netAmount: number;
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  counterpartyId?: string;
  counterpartyName?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  method?: PaymentMethod;
  narration: string;
  failureReason?: string;
  reversedByReference?: string;
  processedAt?: string;
  tenantId: string;
}

export interface Bank extends AuditableEntity {
  code: string;
  name: string;
  nameLo: string;
  swiftCode: string;
  logoUrl: string;
  active: boolean;
  supportsInstantTransfer: boolean;
  settlementAccount: string;
  contactPerson?: string;
  contactPhone?: string;
  transactionCount: number;
  transactionVolume: number;
}

export interface PaymentGateway extends AuditableEntity {
  code: string;
  name: string;
  provider: string;
  logoUrl: string;
  status: PaymentGatewayStatus;
  methods: PaymentMethod[];
  currencies: string[];
  feePercent: number;
  feeFlat: number;
  settlementDays: number;
  successRate: number;
  avgResponseMs: number;
  volumeToday: number;
  volumeMonth: number;
  sandbox: boolean;
  webhookUrl: string;
  priority: number;
}

export interface PaymentTransaction extends AuditableEntity {
  reference: string;
  gatewayReference?: string;
  gatewayId: string;
  gatewayName: string;
  method: PaymentMethod;
  status: TransactionStatus;
  direction: TransactionDirection;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  bankId?: string;
  bankName?: string;
  accountNumber?: string;
  relatedTicketId?: string;
  narration: string;
  failureCode?: string;
  failureReason?: string;
  reconciliationStatus: ReconciliationStatus;
  retryCount: number;
  initiatedAt: string;
  completedAt?: string;
  tenantId: string;
}

export interface Refund extends AuditableEntity {
  reference: string;
  paymentReference: string;
  amount: number;
  currency: string;
  reason: string;
  status: RefundStatus;
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  completedAt?: string;
  customerName: string;
  remarks?: string;
}

export interface Settlement extends AuditableEntity {
  reference: string;
  partyType: WalletOwnerType;
  partyId: string;
  partyName: string;
  periodStart: string;
  periodEnd: string;
  grossSales: number;
  commission: number;
  prizePayout: number;
  tax: number;
  adjustments: number;
  netPayable: number;
  currency: string;
  status: SettlementStatus;
  bankName?: string;
  bankAccountNumber?: string;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  paymentReference?: string;
  remarks?: string;
  tenantId: string;
}

export interface ReconciliationRecord extends AuditableEntity {
  batchReference: string;
  gatewayName: string;
  statementDate: string;
  systemCount: number;
  systemAmount: number;
  gatewayCount: number;
  gatewayAmount: number;
  matchedCount: number;
  unmatchedCount: number;
  varianceAmount: number;
  status: ReconciliationStatus;
  reconciledBy?: string;
  reconciledAt?: string;
  remarks?: string;
}
