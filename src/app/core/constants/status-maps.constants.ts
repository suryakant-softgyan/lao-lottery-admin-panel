import {
  AgentStatus,
  AgentTier,
  CampaignStatus,
  ClaimStatus,
  DocumentStatus,
  DrawMode,
  DrawStatus,
  HealthState,
  KycStatus,
  LotteryStatus,
  LotteryType,
  NotificationChannel,
  NotificationStatus,
  PaymentGatewayStatus,
  PaymentMethod,
  PosDeviceStatus,
  ReconciliationStatus,
  RefundStatus,
  RetailerStatus,
  SettlementStatus,
  Severity,
  TicketChannel,
  TicketStatus,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
  UserRole,
  UserStatus,
  WalletStatus,
} from '../enums';
import type { BadgeMapEntry } from '../models/table.model';

type BadgeMap = Record<string, BadgeMapEntry>;

/** Presentation metadata for every status enum used across the portal. */

export const USER_STATUS_MAP: BadgeMap = {
  [UserStatus.Active]: { label: 'Active', tone: 'success', icon: 'check_circle' },
  [UserStatus.Inactive]: { label: 'Inactive', tone: 'neutral', icon: 'do_not_disturb_on' },
  [UserStatus.Pending]: { label: 'Pending', tone: 'warning', icon: 'hourglass_top' },
  [UserStatus.Suspended]: { label: 'Suspended', tone: 'warning', icon: 'pause_circle' },
  [UserStatus.Blocked]: { label: 'Blocked', tone: 'danger', icon: 'block' },
  [UserStatus.Locked]: { label: 'Locked', tone: 'danger', icon: 'lock' },
};

export const ROLE_MAP: BadgeMap = {
  [UserRole.SuperAdmin]: { label: 'Super Admin', tone: 'danger', icon: 'shield_person' },
  [UserRole.Admin]: { label: 'Administrator', tone: 'primary', icon: 'admin_panel_settings' },
  [UserRole.SubAdmin]: { label: 'Sub Admin', tone: 'primary', icon: 'manage_accounts' },
  [UserRole.Operator]: { label: 'Operator', tone: 'info', icon: 'stadia_controller' },
  [UserRole.Support]: { label: 'Support', tone: 'info', icon: 'support_agent' },
  [UserRole.Auditor]: { label: 'Auditor', tone: 'neutral', icon: 'gavel' },
  [UserRole.Finance]: { label: 'Finance', tone: 'success', icon: 'account_balance' },
  [UserRole.Agent]: { label: 'Agent', tone: 'warning', icon: 'handshake' },
  [UserRole.Retailer]: { label: 'Retailer', tone: 'warning', icon: 'storefront' },
  [UserRole.Customer]: { label: 'Customer', tone: 'neutral', icon: 'person' },
};

export const KYC_STATUS_MAP: BadgeMap = {
  [KycStatus.NotSubmitted]: { label: 'Not Submitted', tone: 'neutral', icon: 'note_add' },
  [KycStatus.Pending]: { label: 'Pending', tone: 'warning', icon: 'hourglass_top' },
  [KycStatus.UnderReview]: { label: 'Under Review', tone: 'info', icon: 'search' },
  [KycStatus.Approved]: { label: 'Approved', tone: 'success', icon: 'verified' },
  [KycStatus.Rejected]: { label: 'Rejected', tone: 'danger', icon: 'cancel' },
  [KycStatus.Expired]: { label: 'Expired', tone: 'warning', icon: 'schedule' },
};

export const DOCUMENT_STATUS_MAP: BadgeMap = {
  [DocumentStatus.Pending]: { label: 'Pending', tone: 'warning', icon: 'hourglass_top' },
  [DocumentStatus.Approved]: { label: 'Approved', tone: 'success', icon: 'check_circle' },
  [DocumentStatus.Rejected]: { label: 'Rejected', tone: 'danger', icon: 'cancel' },
  [DocumentStatus.Expired]: { label: 'Expired', tone: 'neutral', icon: 'event_busy' },
};

export const AGENT_STATUS_MAP: BadgeMap = {
  [AgentStatus.Active]: { label: 'Active', tone: 'success', icon: 'check_circle' },
  [AgentStatus.Inactive]: { label: 'Inactive', tone: 'neutral', icon: 'do_not_disturb_on' },
  [AgentStatus.PendingApproval]: { label: 'Pending Approval', tone: 'warning', icon: 'pending' },
  [AgentStatus.Suspended]: { label: 'Suspended', tone: 'warning', icon: 'pause_circle' },
  [AgentStatus.Blocked]: { label: 'Blocked', tone: 'danger', icon: 'block' },
  [AgentStatus.Terminated]: { label: 'Terminated', tone: 'danger', icon: 'gpp_bad' },
};

export const AGENT_TIER_MAP: BadgeMap = {
  [AgentTier.Master]: { label: 'Master Agent', tone: 'primary', icon: 'workspace_premium' },
  [AgentTier.Distributor]: { label: 'Distributor', tone: 'info', icon: 'hub' },
  [AgentTier.Retail]: { label: 'Retail Agent', tone: 'neutral', icon: 'store' },
};

export const RETAILER_STATUS_MAP: BadgeMap = {
  [RetailerStatus.Active]: { label: 'Active', tone: 'success', icon: 'check_circle' },
  [RetailerStatus.Inactive]: { label: 'Inactive', tone: 'neutral', icon: 'do_not_disturb_on' },
  [RetailerStatus.PendingApproval]: { label: 'Pending Approval', tone: 'warning', icon: 'pending' },
  [RetailerStatus.Suspended]: { label: 'Suspended', tone: 'warning', icon: 'pause_circle' },
  [RetailerStatus.Closed]: { label: 'Closed', tone: 'danger', icon: 'store_mall_directory' },
};

export const POS_DEVICE_STATUS_MAP: BadgeMap = {
  [PosDeviceStatus.PendingActivation]: { label: 'Pending Activation', tone: 'warning', icon: 'pending' },
  [PosDeviceStatus.Active]: { label: 'Active', tone: 'success', icon: 'check_circle' },
  [PosDeviceStatus.Inactive]: { label: 'Inactive', tone: 'neutral', icon: 'power_settings_new' },
  [PosDeviceStatus.Maintenance]: { label: 'Maintenance', tone: 'info', icon: 'build' },
  [PosDeviceStatus.Faulty]: { label: 'Faulty', tone: 'danger', icon: 'error' },
  [PosDeviceStatus.Blocked]: { label: 'Blocked', tone: 'danger', icon: 'block' },
  [PosDeviceStatus.Decommissioned]: { label: 'Decommissioned', tone: 'neutral', icon: 'delete_forever' },
};

export const LOTTERY_TYPE_MAP: BadgeMap = {
  [LotteryType.TwoDigit]: { label: '2 Digit', tone: 'info', icon: 'looks_two' },
  [LotteryType.ThreeDigit]: { label: '3 Digit', tone: 'info', icon: 'looks_3' },
  [LotteryType.FourDigit]: { label: '4 Digit', tone: 'primary', icon: 'looks_4' },
  [LotteryType.FiveDigit]: { label: '5 Digit', tone: 'primary', icon: 'looks_5' },
  [LotteryType.SixDigit]: { label: '6 Digit', tone: 'primary', icon: 'looks_6' },
  [LotteryType.Animal]: { label: 'Animal', tone: 'warning', icon: 'pets' },
  [LotteryType.Special]: { label: 'Special', tone: 'danger', icon: 'auto_awesome' },
  [LotteryType.Holiday]: { label: 'Holiday', tone: 'success', icon: 'celebration' },
};

export const LOTTERY_STATUS_MAP: BadgeMap = {
  [LotteryStatus.Draft]: { label: 'Draft', tone: 'neutral', icon: 'edit_note' },
  [LotteryStatus.Active]: { label: 'Active', tone: 'success', icon: 'play_circle' },
  [LotteryStatus.Paused]: { label: 'Paused', tone: 'warning', icon: 'pause_circle' },
  [LotteryStatus.Archived]: { label: 'Archived', tone: 'neutral', icon: 'inventory_2' },
};

export const DRAW_STATUS_MAP: BadgeMap = {
  [DrawStatus.Scheduled]: { label: 'Scheduled', tone: 'info', icon: 'event' },
  [DrawStatus.SalesOpen]: { label: 'Sales Open', tone: 'success', icon: 'lock_open' },
  [DrawStatus.SalesClosed]: { label: 'Sales Closed', tone: 'warning', icon: 'lock' },
  [DrawStatus.Drawing]: { label: 'Drawing', tone: 'primary', icon: 'sensors' },
  [DrawStatus.PendingVerification]: { label: 'Pending Verification', tone: 'warning', icon: 'fact_check' },
  [DrawStatus.Published]: { label: 'Published', tone: 'success', icon: 'campaign' },
  [DrawStatus.RolledBack]: { label: 'Rolled Back', tone: 'danger', icon: 'undo' },
  [DrawStatus.Cancelled]: { label: 'Cancelled', tone: 'danger', icon: 'cancel' },
};

export const DRAW_MODE_MAP: BadgeMap = {
  [DrawMode.Manual]: { label: 'Manual', tone: 'neutral', icon: 'back_hand' },
  [DrawMode.Automatic]: { label: 'Automatic', tone: 'primary', icon: 'smart_toy' },
  [DrawMode.Live]: { label: 'Live', tone: 'danger', icon: 'sensors' },
};

export const TICKET_STATUS_MAP: BadgeMap = {
  [TicketStatus.Pending]: { label: 'Pending', tone: 'warning', icon: 'hourglass_top' },
  [TicketStatus.Sold]: { label: 'Sold', tone: 'info', icon: 'shopping_cart_checkout' },
  [TicketStatus.Cancelled]: { label: 'Cancelled', tone: 'neutral', icon: 'cancel' },
  [TicketStatus.Void]: { label: 'Void', tone: 'danger', icon: 'block' },
  [TicketStatus.Winning]: { label: 'Winning', tone: 'success', icon: 'emoji_events' },
  [TicketStatus.Claimed]: { label: 'Claimed', tone: 'success', icon: 'redeem' },
  [TicketStatus.Expired]: { label: 'Expired', tone: 'neutral', icon: 'schedule' },
};

export const TICKET_CHANNEL_MAP: BadgeMap = {
  [TicketChannel.Retailer]: { label: 'Retailer', tone: 'primary', icon: 'storefront' },
  [TicketChannel.MobileApp]: { label: 'Mobile App', tone: 'info', icon: 'smartphone' },
  [TicketChannel.Web]: { label: 'Web', tone: 'info', icon: 'language' },
  [TicketChannel.Pos]: { label: 'POS', tone: 'primary', icon: 'point_of_sale' },
  [TicketChannel.Kiosk]: { label: 'Kiosk', tone: 'neutral', icon: 'storage' },
  [TicketChannel.Ussd]: { label: 'USSD', tone: 'neutral', icon: 'dialpad' },
};

export const CLAIM_STATUS_MAP: BadgeMap = {
  [ClaimStatus.Unclaimed]: { label: 'Unclaimed', tone: 'warning', icon: 'pending_actions' },
  [ClaimStatus.Submitted]: { label: 'Submitted', tone: 'info', icon: 'upload_file' },
  [ClaimStatus.UnderReview]: { label: 'Under Review', tone: 'info', icon: 'search' },
  [ClaimStatus.Approved]: { label: 'Approved', tone: 'success', icon: 'check_circle' },
  [ClaimStatus.Paid]: { label: 'Paid', tone: 'success', icon: 'paid' },
  [ClaimStatus.Rejected]: { label: 'Rejected', tone: 'danger', icon: 'cancel' },
  [ClaimStatus.Expired]: { label: 'Expired', tone: 'neutral', icon: 'schedule' },
};

export const WALLET_STATUS_MAP: BadgeMap = {
  [WalletStatus.Active]: { label: 'Active', tone: 'success', icon: 'check_circle' },
  [WalletStatus.Frozen]: { label: 'Frozen', tone: 'info', icon: 'ac_unit' },
  [WalletStatus.Suspended]: { label: 'Suspended', tone: 'warning', icon: 'pause_circle' },
  [WalletStatus.Closed]: { label: 'Closed', tone: 'neutral', icon: 'lock' },
};

export const TRANSACTION_STATUS_MAP: BadgeMap = {
  [TransactionStatus.Pending]: { label: 'Pending', tone: 'warning', icon: 'hourglass_top' },
  [TransactionStatus.Processing]: { label: 'Processing', tone: 'info', icon: 'sync' },
  [TransactionStatus.Success]: { label: 'Success', tone: 'success', icon: 'check_circle' },
  [TransactionStatus.Failed]: { label: 'Failed', tone: 'danger', icon: 'error' },
  [TransactionStatus.Reversed]: { label: 'Reversed', tone: 'warning', icon: 'undo' },
  [TransactionStatus.Cancelled]: { label: 'Cancelled', tone: 'neutral', icon: 'cancel' },
  [TransactionStatus.OnHold]: { label: 'On Hold', tone: 'warning', icon: 'pause_circle' },
};

export const TRANSACTION_TYPE_MAP: BadgeMap = {
  [TransactionType.Deposit]: { label: 'Deposit', tone: 'success', icon: 'south_west' },
  [TransactionType.Withdrawal]: { label: 'Withdrawal', tone: 'warning', icon: 'north_east' },
  [TransactionType.Transfer]: { label: 'Transfer', tone: 'info', icon: 'sync_alt' },
  [TransactionType.TicketPurchase]: {
    label: 'Ticket Purchase',
    tone: 'primary',
    icon: 'confirmation_number',
  },
  [TransactionType.TicketRefund]: { label: 'Ticket Refund', tone: 'neutral', icon: 'undo' },
  [TransactionType.PrizePayout]: { label: 'Prize Payout', tone: 'success', icon: 'emoji_events' },
  [TransactionType.Commission]: { label: 'Commission', tone: 'info', icon: 'percent' },
  [TransactionType.Settlement]: { label: 'Settlement', tone: 'primary', icon: 'receipt' },
  [TransactionType.Fee]: { label: 'Fee', tone: 'neutral', icon: 'toll' },
  [TransactionType.Tax]: { label: 'Tax', tone: 'neutral', icon: 'request_quote' },
  [TransactionType.Adjustment]: { label: 'Adjustment', tone: 'warning', icon: 'tune' },
  [TransactionType.Reversal]: { label: 'Reversal', tone: 'danger', icon: 'restart_alt' },
};

export const TRANSACTION_DIRECTION_MAP: BadgeMap = {
  [TransactionDirection.Credit]: { label: 'Credit', tone: 'success', icon: 'add_circle' },
  [TransactionDirection.Debit]: { label: 'Debit', tone: 'danger', icon: 'remove_circle' },
};

export const PAYMENT_METHOD_MAP: BadgeMap = {
  [PaymentMethod.BankTransfer]: { label: 'Bank Transfer', tone: 'primary', icon: 'account_balance' },
  [PaymentMethod.Card]: { label: 'Card', tone: 'info', icon: 'credit_card' },
  [PaymentMethod.MobileMoney]: { label: 'Mobile Money', tone: 'success', icon: 'smartphone' },
  [PaymentMethod.Qr]: { label: 'QR', tone: 'info', icon: 'qr_code_2' },
  [PaymentMethod.Cash]: { label: 'Cash', tone: 'neutral', icon: 'payments' },
  [PaymentMethod.Wallet]: { label: 'Wallet', tone: 'primary', icon: 'account_balance_wallet' },
  [PaymentMethod.Voucher]: { label: 'Voucher', tone: 'warning', icon: 'local_activity' },
};

export const GATEWAY_STATUS_MAP: BadgeMap = {
  [PaymentGatewayStatus.Active]: { label: 'Active', tone: 'success', icon: 'check_circle' },
  [PaymentGatewayStatus.Inactive]: { label: 'Inactive', tone: 'neutral', icon: 'power_settings_new' },
  [PaymentGatewayStatus.Maintenance]: { label: 'Maintenance', tone: 'info', icon: 'build' },
  [PaymentGatewayStatus.Degraded]: { label: 'Degraded', tone: 'warning', icon: 'warning' },
};

export const SETTLEMENT_STATUS_MAP: BadgeMap = {
  [SettlementStatus.Draft]: { label: 'Draft', tone: 'neutral', icon: 'edit_note' },
  [SettlementStatus.Pending]: { label: 'Pending', tone: 'warning', icon: 'hourglass_top' },
  [SettlementStatus.Approved]: { label: 'Approved', tone: 'info', icon: 'thumb_up' },
  [SettlementStatus.Paid]: { label: 'Paid', tone: 'success', icon: 'paid' },
  [SettlementStatus.Rejected]: { label: 'Rejected', tone: 'danger', icon: 'cancel' },
  [SettlementStatus.Disputed]: { label: 'Disputed', tone: 'danger', icon: 'gavel' },
};

export const RECONCILIATION_STATUS_MAP: BadgeMap = {
  [ReconciliationStatus.Matched]: { label: 'Matched', tone: 'success', icon: 'check_circle' },
  [ReconciliationStatus.Unmatched]: { label: 'Unmatched', tone: 'danger', icon: 'error' },
  [ReconciliationStatus.PartiallyMatched]: { label: 'Partial', tone: 'warning', icon: 'rule' },
  [ReconciliationStatus.Disputed]: { label: 'Disputed', tone: 'danger', icon: 'gavel' },
  [ReconciliationStatus.Resolved]: { label: 'Resolved', tone: 'success', icon: 'task_alt' },
};

export const REFUND_STATUS_MAP: BadgeMap = {
  [RefundStatus.Requested]: { label: 'Requested', tone: 'warning', icon: 'pending' },
  [RefundStatus.Approved]: { label: 'Approved', tone: 'info', icon: 'thumb_up' },
  [RefundStatus.Processing]: { label: 'Processing', tone: 'info', icon: 'sync' },
  [RefundStatus.Completed]: { label: 'Completed', tone: 'success', icon: 'check_circle' },
  [RefundStatus.Rejected]: { label: 'Rejected', tone: 'danger', icon: 'cancel' },
};

export const NOTIFICATION_CHANNEL_MAP: BadgeMap = {
  [NotificationChannel.Push]: { label: 'Push', tone: 'primary', icon: 'notifications_active' },
  [NotificationChannel.Sms]: { label: 'SMS', tone: 'info', icon: 'sms' },
  [NotificationChannel.Email]: { label: 'Email', tone: 'success', icon: 'mail' },
  [NotificationChannel.InApp]: { label: 'In-App', tone: 'neutral', icon: 'inbox' },
  [NotificationChannel.Webhook]: { label: 'Webhook', tone: 'warning', icon: 'webhook' },
};

export const NOTIFICATION_STATUS_MAP: BadgeMap = {
  [NotificationStatus.Draft]: { label: 'Draft', tone: 'neutral', icon: 'edit_note' },
  [NotificationStatus.Scheduled]: { label: 'Scheduled', tone: 'info', icon: 'schedule_send' },
  [NotificationStatus.Sending]: { label: 'Sending', tone: 'primary', icon: 'sync' },
  [NotificationStatus.Sent]: { label: 'Sent', tone: 'success', icon: 'check_circle' },
  [NotificationStatus.Failed]: { label: 'Failed', tone: 'danger', icon: 'error' },
  [NotificationStatus.Cancelled]: { label: 'Cancelled', tone: 'neutral', icon: 'cancel' },
};

export const CAMPAIGN_STATUS_MAP: BadgeMap = {
  [CampaignStatus.Draft]: { label: 'Draft', tone: 'neutral', icon: 'edit_note' },
  [CampaignStatus.Scheduled]: { label: 'Scheduled', tone: 'info', icon: 'event' },
  [CampaignStatus.Running]: { label: 'Running', tone: 'primary', icon: 'play_circle' },
  [CampaignStatus.Paused]: { label: 'Paused', tone: 'warning', icon: 'pause_circle' },
  [CampaignStatus.Completed]: { label: 'Completed', tone: 'success', icon: 'task_alt' },
  [CampaignStatus.Cancelled]: { label: 'Cancelled', tone: 'danger', icon: 'cancel' },
};

export const SEVERITY_MAP: BadgeMap = {
  [Severity.Info]: { label: 'Info', tone: 'info', icon: 'info' },
  [Severity.Low]: { label: 'Low', tone: 'neutral', icon: 'low_priority' },
  [Severity.Medium]: { label: 'Medium', tone: 'warning', icon: 'warning' },
  [Severity.High]: { label: 'High', tone: 'danger', icon: 'priority_high' },
  [Severity.Critical]: { label: 'Critical', tone: 'danger', icon: 'crisis_alert' },
};

export const HEALTH_STATE_MAP: BadgeMap = {
  [HealthState.Healthy]: { label: 'Healthy', tone: 'success', icon: 'favorite' },
  [HealthState.Degraded]: { label: 'Degraded', tone: 'warning', icon: 'warning' },
  [HealthState.Down]: { label: 'Down', tone: 'danger', icon: 'error' },
  [HealthState.Unknown]: { label: 'Unknown', tone: 'neutral', icon: 'help' },
};

export const BOOLEAN_MAP: BadgeMap = {
  true: { label: 'Yes', tone: 'success', icon: 'check' },
  false: { label: 'No', tone: 'neutral', icon: 'close' },
};

/** Converts any badge map into select options for filter panels and forms. */
export function toOptions(map: BadgeMap): { value: string; label: string; icon?: string }[] {
  return Object.entries(map).map(([value, meta]) => ({
    value,
    label: meta.label,
    icon: meta.icon,
  }));
}
