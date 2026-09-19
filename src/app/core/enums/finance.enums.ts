/** Wallet, payment and settlement enums. */

export enum WalletOwnerType {
  Customer = 'CUSTOMER',
  Agent = 'AGENT',
  Retailer = 'RETAILER',
  System = 'SYSTEM',
}

export enum WalletStatus {
  Active = 'ACTIVE',
  Frozen = 'FROZEN',
  Suspended = 'SUSPENDED',
  Closed = 'CLOSED',
}

export enum TransactionType {
  Deposit = 'DEPOSIT',
  Withdrawal = 'WITHDRAWAL',
  Transfer = 'TRANSFER',
  TicketPurchase = 'TICKET_PURCHASE',
  TicketRefund = 'TICKET_REFUND',
  PrizePayout = 'PRIZE_PAYOUT',
  Commission = 'COMMISSION',
  Settlement = 'SETTLEMENT',
  Fee = 'FEE',
  Tax = 'TAX',
  Adjustment = 'ADJUSTMENT',
  Reversal = 'REVERSAL',
}

export enum TransactionStatus {
  Pending = 'PENDING',
  Processing = 'PROCESSING',
  Success = 'SUCCESS',
  Failed = 'FAILED',
  Reversed = 'REVERSED',
  Cancelled = 'CANCELLED',
  OnHold = 'ON_HOLD',
}

export enum TransactionDirection {
  Credit = 'CREDIT',
  Debit = 'DEBIT',
}

export enum PaymentMethod {
  BankTransfer = 'BANK_TRANSFER',
  Card = 'CARD',
  MobileMoney = 'MOBILE_MONEY',
  Qr = 'QR',
  Cash = 'CASH',
  Wallet = 'WALLET',
  Voucher = 'VOUCHER',
}

export enum PaymentGatewayStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Maintenance = 'MAINTENANCE',
  Degraded = 'DEGRADED',
}

export enum SettlementStatus {
  Draft = 'DRAFT',
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Paid = 'PAID',
  Rejected = 'REJECTED',
  Disputed = 'DISPUTED',
}

export enum ReconciliationStatus {
  Matched = 'MATCHED',
  Unmatched = 'UNMATCHED',
  PartiallyMatched = 'PARTIALLY_MATCHED',
  Disputed = 'DISPUTED',
  Resolved = 'RESOLVED',
}

export enum RefundStatus {
  Requested = 'REQUESTED',
  Approved = 'APPROVED',
  Processing = 'PROCESSING',
  Completed = 'COMPLETED',
  Rejected = 'REJECTED',
}

export enum CommissionModel {
  Percentage = 'PERCENTAGE',
  Flat = 'FLAT',
  Tiered = 'TIERED',
  Hybrid = 'HYBRID',
}

export enum Currency {
  Lak = 'LAK',
  Usd = 'USD',
  Thb = 'THB',
}
