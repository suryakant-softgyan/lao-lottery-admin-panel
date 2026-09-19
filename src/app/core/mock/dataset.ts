import { PLACEHOLDER } from '../constants/app.constants';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from '../constants/permission.constants';
import {
  AgentStatus,
  AgentTier,
  AuditAction,
  AuditCategory,
  CampaignStatus,
  ClaimStatus,
  CommissionModel,
  DeviceType,
  DocumentStatus,
  DocumentType,
  DrawFrequency,
  DrawMode,
  DrawStatus,
  Gender,
  HealthState,
  KycStatus,
  LotteryStatus,
  LotteryType,
  NotificationCategory,
  NotificationChannel,
  NotificationStatus,
  PaymentGatewayStatus,
  PaymentMethod,
  PosDeviceModel,
  PosDeviceStatus,
  PrizeTierCode,
  ReconciliationStatus,
  RefundStatus,
  RetailerStatus,
  SettlementStatus,
  Severity,
  ShopType,
  TicketChannel,
  TicketStatus,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
  UserRole,
  UserStatus,
  UserType,
  WalletOwnerType,
  WalletStatus,
} from '../enums';
import type {
  Agent,
  Announcement,
  AudienceSegment,
  AuditLog,
  Bank,
  DeviceHistoryEntry,
  Draw,
  DrawWinningNumber,
  LoginHistoryEntry,
  LotteryGame,
  NotificationCampaign,
  NotificationMessage,
  NotificationTemplate,
  PaymentGateway,
  PaymentTransaction,
  PosDevice,
  PrizeTier,
  ReconciliationRecord,
  Refund,
  Retailer,
  Role,
  Settlement,
  SystemHealth,
  Ticket,
  TicketLine,
  User,
  UserActivityEntry,
  Wallet,
  WalletTransaction,
} from '../models';
import { SeededRandom, mockRandom } from '../utilities/random.util';
import {
  ANNOUNCEMENT_SEEDS,
  AUDIT_DESCRIPTIONS,
  BANKS,
  DEPARTMENTS,
  DESIGNATIONS,
  DEVICE_BROWSERS,
  DEVICE_OS,
  LAO_FAMILY_NAMES,
  LAO_GIVEN_NAMES,
  PAYMENT_GATEWAYS,
  PROVINCES,
  SHOP_PREFIXES,
  SHOP_SUFFIXES,
  VILLAGES,
  laoPhone,
} from './reference';

/** Single evaluation so every generated timestamp shares one reference point. */
const NOW = new Date();
const TENANT = 'lao-national-lottery';

const COUNTS = {
  users: 64,
  agents: 42,
  retailers: 96,
  devices: 130,
  draws: 140,
  tickets: 420,
  walletTransactions: 520,
  paymentTransactions: 360,
  refunds: 42,
  settlements: 64,
  reconciliations: 32,
  notifications: 64,
  campaigns: 18,
  auditLogs: 420,
} as const;

function iso(date: Date): string {
  return date.toISOString();
}

function daysAgo(days: number): string {
  return iso(new Date(NOW.getTime() - days * 86_400_000));
}

function daysAhead(days: number): string {
  return iso(new Date(NOW.getTime() + days * 86_400_000));
}

function atTime(base: Date, hours: number, minutes: number): Date {
  const output = new Date(base);
  output.setHours(hours, minutes, 0, 0);
  return output;
}

/**
 * The single in-memory dataset backing every mock repository.
 *
 * Entities are generated once, lazily, and cross-reference each other by id so
 * the portal behaves like a real system: a retailer belongs to a real agent, a
 * ticket points at a real draw, a wallet transaction moves a real wallet.
 *
 * Generation is seeded, so the data is identical on every reload — essential
 * for demoing, screenshotting and writing tests against fixed expectations.
 */
class MockDataset {
  // ------------------------------------------------------------------- roles

  private rolesCache?: Role[];

  get roles(): Role[] {
    this.rolesCache ??= this.buildRoles();
    return this.rolesCache;
  }

  private buildRoles(): Role[] {
    const definitions: { code: UserRole; name: string; description: string; level: number }[] = [
      {
        code: UserRole.SuperAdmin,
        name: 'Super Administrator',
        description: 'Unrestricted platform control including tenant configuration.',
        level: 0,
      },
      {
        code: UserRole.Admin,
        name: 'Administrator',
        description: 'Full operational control across every business module.',
        level: 1,
      },
      {
        code: UserRole.SubAdmin,
        name: 'Sub Administrator',
        description: 'Delegated administration for an assigned region.',
        level: 2,
      },
      {
        code: UserRole.Operator,
        name: 'Draw Operator',
        description: 'Executes, verifies and publishes lottery draws.',
        level: 3,
      },
      {
        code: UserRole.Finance,
        name: 'Finance Officer',
        description: 'Wallet, settlement, reconciliation and payout authority.',
        level: 3,
      },
      {
        code: UserRole.Support,
        name: 'Support Agent',
        description: 'Customer assistance with limited write access.',
        level: 4,
      },
      {
        code: UserRole.Auditor,
        name: 'Internal Auditor',
        description: 'Read-only access plus the full audit trail.',
        level: 4,
      },
      {
        code: UserRole.Agent,
        name: 'Agent Portal',
        description: 'External agent access to their own network.',
        level: 5,
      },
    ];

    const random = mockRandom('roles');
    return definitions.map((definition, index) => ({
      id: `role-${definition.code.toLowerCase()}`,
      code: definition.code,
      name: definition.name,
      description: definition.description,
      level: definition.level,
      system: index < 3,
      status: UserStatus.Active,
      permissionCodes: ROLE_PERMISSIONS[definition.code] ?? [],
      userCount: random.int(2, 26),
      createdAt: daysAgo(720 - index * 30),
      createdBy: 'System',
      updatedAt: daysAgo(random.int(5, 200)),
      updatedBy: 'System',
    }));
  }

  // ------------------------------------------------------------------- users

  private usersCache?: User[];

  get users(): User[] {
    this.usersCache ??= this.buildUsers();
    return this.usersCache;
  }

  private buildUsers(): User[] {
    const random = mockRandom('users');
    const staffRoles = [
      UserRole.Admin,
      UserRole.SubAdmin,
      UserRole.Operator,
      UserRole.Support,
      UserRole.Finance,
      UserRole.Auditor,
    ];

    return Array.from({ length: COUNTS.users }, (_, index) => {
      const firstName = random.pick(LAO_GIVEN_NAMES);
      const lastName = random.pick(LAO_FAMILY_NAMES);
      const fullName = `${firstName} ${lastName}`;
      const isStaff = index < 26;
      const role = isStaff ? random.pick(staffRoles) : UserRole.Customer;
      const province = random.pick(PROVINCES);
      const status = random.weighted([
        { value: UserStatus.Active, weight: 72 },
        { value: UserStatus.Inactive, weight: 9 },
        { value: UserStatus.Pending, weight: 8 },
        { value: UserStatus.Suspended, weight: 6 },
        { value: UserStatus.Blocked, weight: 3 },
        { value: UserStatus.Locked, weight: 2 },
      ]);
      const kycStatus = random.weighted([
        { value: KycStatus.Approved, weight: 60 },
        { value: KycStatus.Pending, weight: 15 },
        { value: KycStatus.UnderReview, weight: 10 },
        { value: KycStatus.NotSubmitted, weight: 8 },
        { value: KycStatus.Rejected, weight: 5 },
        { value: KycStatus.Expired, weight: 2 },
      ]);
      const createdAt = random.dateWithin(NOW, 30, 900);
      const username = `${firstName.toLowerCase()}.${lastName.toLowerCase().slice(0, 6)}${index}`;

      return {
        id: `usr-${(index + 1).toString().padStart(4, '0')}`,
        code: `U-${(index + 1).toString().padStart(5, '0')}`,
        username,
        firstName,
        lastName,
        fullName,
        displayName: fullName,
        avatarUrl: PLACEHOLDER.avatar(fullName),
        email: `${username}@${isStaff ? 'laolottery.la' : 'example.la'}`,
        phone: laoPhone(random.digits(6)),
        gender: random.pick([Gender.Male, Gender.Female, Gender.Other]),
        dateOfBirth: random.dateWithin(NOW, 6570, 20075).slice(0, 10),
        nationalId: `LA${random.digits(9)}`,
        type: isStaff
          ? random.pick([UserType.Admin, UserType.SubAdmin, UserType.Operator, UserType.Support])
          : UserType.Customer,
        roles: [role],
        primaryRole: role,
        permissionOverrides: random.bool(0.12) ? random.pickMany(ALL_PERMISSIONS, random.int(1, 3)) : [],
        status,
        kycStatus,
        emailVerified: random.bool(0.86),
        phoneVerified: random.bool(0.92),
        twoFactorEnabled: isStaff ? random.bool(0.55) : random.bool(0.18),
        mustChangePassword: random.bool(0.08),
        passwordUpdatedAt: random.dateWithin(NOW, 5, 260),
        lastLoginAt: status === UserStatus.Active ? random.dateWithin(NOW, 0, 21) : undefined,
        lastLoginIp: `10.${random.int(0, 60)}.${random.int(0, 255)}.${random.int(2, 250)}`,
        loginCount: random.int(1, 940),
        failedLoginAttempts: status === UserStatus.Locked ? random.int(5, 9) : random.int(0, 2),
        lockedUntil: status === UserStatus.Locked ? daysAhead(random.float(0.1, 1)) : undefined,
        department: isStaff ? random.pick(DEPARTMENTS) : undefined,
        designation: isStaff ? random.pick(DESIGNATIONS) : undefined,
        reportsTo: isStaff && index > 3 ? `usr-${random.int(1, 3).toString().padStart(4, '0')}` : undefined,
        tenantId: TENANT,
        language: random.bool(0.6) ? 'en' : 'lo',
        timezone: 'Asia/Vientiane',
        address: {
          line1: `${random.int(1, 320)} ${random.pick(VILLAGES)}`,
          village: random.pick(VILLAGES),
          district: random.pick(province.districts),
          province: province.name,
          postalCode: random.digits(5),
          country: 'Lao PDR',
          latitude: random.float(13.9, 22.5, 4),
          longitude: random.float(100.1, 107.6, 4),
        },
        contact: {
          phone: laoPhone(random.digits(6)),
          email: `${username}@${isStaff ? 'laolottery.la' : 'example.la'}`,
        },
        documents: this.buildDocuments(random, index, kycStatus),
        notes: random.bool(0.2) ? 'Escalated by the support desk for identity re-verification.' : undefined,
        tags: random.pickMany(
          ['vip', 'high-volume', 'watchlist', 'new', 'verified', 'dormant'],
          random.int(0, 2),
        ),
        createdAt,
        createdBy: 'System',
        updatedAt: random.dateWithin(NOW, 0, 60),
        updatedBy: 'System',
      } satisfies User;
    });
  }

  private buildDocuments(random: SeededRandom, seed: number, kyc: KycStatus): User['documents'] {
    if (kyc === KycStatus.NotSubmitted) {
      return [];
    }
    const types = [DocumentType.NationalId, DocumentType.ProofOfAddress, DocumentType.Passport];
    return random.pickMany(types, random.int(1, 3)).map((type, index) => ({
      id: `doc-${seed}-${index}`,
      type,
      number: `${type.slice(0, 2)}${random.digits(8)}`,
      fileName: `${type.toLowerCase()}-${seed}.pdf`,
      fileUrl: PLACEHOLDER.photo(`doc-${seed}-${index}`, 600, 400),
      status:
        kyc === KycStatus.Approved
          ? DocumentStatus.Approved
          : kyc === KycStatus.Rejected
            ? DocumentStatus.Rejected
            : DocumentStatus.Pending,
      issuedAt: random.dateWithin(NOW, 400, 2000).slice(0, 10),
      expiresAt: daysAhead(random.int(200, 2500)).slice(0, 10),
      uploadedAt: random.dateWithin(NOW, 1, 300),
      reviewedBy: kyc === KycStatus.Approved ? 'Compliance Desk' : undefined,
      reviewedAt: kyc === KycStatus.Approved ? random.dateWithin(NOW, 1, 200) : undefined,
      remarks: kyc === KycStatus.Rejected ? 'Document image was not legible.' : undefined,
    }));
  }

  // ------------------------------------------------------------------ agents

  private agentsCache?: Agent[];

  get agents(): Agent[] {
    this.agentsCache ??= this.buildAgents();
    return this.agentsCache;
  }

  private buildAgents(): Agent[] {
    const random = mockRandom('agents');
    const agents: Agent[] = [];

    for (let index = 0; index < COUNTS.agents; index++) {
      const tier = index < 5 ? AgentTier.Master : index < 16 ? AgentTier.Distributor : AgentTier.Retail;
      const firstName = random.pick(LAO_GIVEN_NAMES);
      const lastName = random.pick(LAO_FAMILY_NAMES);
      const name = `${firstName} ${lastName}`;
      const province = random.pick(PROVINCES);
      const status = random.weighted([
        { value: AgentStatus.Active, weight: 70 },
        { value: AgentStatus.PendingApproval, weight: 11 },
        { value: AgentStatus.Suspended, weight: 8 },
        { value: AgentStatus.Inactive, weight: 6 },
        { value: AgentStatus.Blocked, weight: 3 },
        { value: AgentStatus.Terminated, weight: 2 },
      ]);
      const parent =
        tier === AgentTier.Master
          ? undefined
          : agents.find((candidate) =>
              tier === AgentTier.Distributor
                ? candidate.tier === AgentTier.Master
                : candidate.tier === AgentTier.Distributor,
            );

      const salesAmount = random.int(12_000_000, 940_000_000);
      const target = Math.round(salesAmount * random.float(0.8, 1.35));

      agents.push({
        id: `agt-${(index + 1).toString().padStart(4, '0')}`,
        code: `AG-${province.code}-${(index + 1).toString().padStart(3, '0')}`,
        name,
        businessName: `${random.pick(SHOP_PREFIXES)} ${tier === AgentTier.Master ? 'Holdings' : 'Trading'}`,
        tier,
        parentAgentId: parent?.id,
        parentAgentName: parent?.name,
        status,
        kycStatus:
          status === AgentStatus.PendingApproval
            ? random.pick([KycStatus.Pending, KycStatus.UnderReview])
            : KycStatus.Approved,
        userId: `usr-${random.int(1, COUNTS.users).toString().padStart(4, '0')}`,
        contact: {
          phone: laoPhone(random.digits(6)),
          altPhone: laoPhone(random.digits(6)),
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@agents.laolottery.la`,
        },
        address: {
          line1: `${random.int(1, 220)} ${random.pick(VILLAGES)}`,
          district: random.pick(province.districts),
          province: province.name,
          country: 'Lao PDR',
          latitude: random.float(13.9, 22.5, 4),
          longitude: random.float(100.1, 107.6, 4),
        },
        province: province.name,
        district: random.pick(province.districts),
        territory: `${province.name} ${tier === AgentTier.Master ? 'Region' : 'Zone'}`,
        walletId: `wal-agt-${(index + 1).toString().padStart(4, '0')}`,
        walletBalance: random.int(2_000_000, 320_000_000),
        creditLimit: random.int(50_000_000, 600_000_000),
        outstandingBalance: random.int(0, 90_000_000),
        commissionRules: this.buildCommissionRules(random, index, tier),
        performance: {
          ticketsSold: random.int(1_200, 92_000),
          salesAmount,
          commissionEarned: Math.round(salesAmount * random.float(0.04, 0.09)),
          activeRetailers: tier === AgentTier.Retail ? 0 : random.int(3, 48),
          winningTickets: random.int(40, 3_400),
          payoutAmount: Math.round(salesAmount * random.float(0.42, 0.61)),
          targetAmount: target,
          achievementPercent: Math.round((salesAmount / target) * 1000) / 10,
          rank: index + 1,
          monthlyTrend: random.series(12, 20, 100, 0.03),
        },
        documents: this.buildDocuments(random, 1000 + index, KycStatus.Approved),
        contractStartDate: random.dateWithin(NOW, 120, 1400).slice(0, 10),
        contractEndDate: daysAhead(random.int(60, 900)).slice(0, 10),
        taxId: `TIN${random.digits(9)}`,
        bankAccountName: name,
        bankAccountNumber: random.digits(14),
        bankName: random.pick(BANKS).name,
        retailerCount: tier === AgentTier.Retail ? 0 : random.int(2, 34),
        deviceCount: random.int(1, 42),
        suspendedReason:
          status === AgentStatus.Suspended ? 'Settlement overdue by more than 14 days.' : undefined,
        blockedReason:
          status === AgentStatus.Blocked ? 'Repeated ticket cancellation anomalies detected.' : undefined,
        avatarUrl: PLACEHOLDER.avatar(name),
        tenantId: TENANT,
        notes: random.bool(0.25) ? 'Top performer in the last two quarterly reviews.' : undefined,
        createdAt: random.dateWithin(NOW, 60, 1400),
        createdBy: 'System',
        updatedAt: random.dateWithin(NOW, 0, 45),
        updatedBy: 'System',
      });
    }

    return agents
      .sort((a, b) => b.performance.salesAmount - a.performance.salesAmount)
      .map((agent, index) => ({ ...agent, performance: { ...agent.performance, rank: index + 1 } }));
  }

  private buildCommissionRules(
    random: SeededRandom,
    seed: number,
    tier: AgentTier,
  ): Agent['commissionRules'] {
    const baseRate = tier === AgentTier.Master ? 8.5 : tier === AgentTier.Distributor ? 6.5 : 4.5;
    return [LotteryType.TwoDigit, LotteryType.ThreeDigit, LotteryType.SixDigit].map((lotteryType, index) => ({
      id: `cr-${seed}-${index}`,
      lotteryType,
      model: random.pick([CommissionModel.Percentage, CommissionModel.Tiered, CommissionModel.Hybrid]),
      rate: Math.round((baseRate + random.float(-1.2, 1.6)) * 10) / 10,
      flatAmount: random.bool(0.3) ? random.int(500, 5_000) : 0,
      minSales: 0,
      maxSales: random.int(50_000_000, 900_000_000),
      effectiveFrom: daysAgo(random.int(30, 500)).slice(0, 10),
      active: true,
    }));
  }

  // --------------------------------------------------------------- retailers

  private retailersCache?: Retailer[];
  private devicesCache?: PosDevice[];

  get retailers(): Retailer[] {
    if (!this.retailersCache) {
      this.buildRetailersAndDevices();
    }
    return this.retailersCache!;
  }

  get devices(): PosDevice[] {
    if (!this.devicesCache) {
      this.buildRetailersAndDevices();
    }
    return this.devicesCache!;
  }

  private buildRetailersAndDevices(): void {
    const random = mockRandom('retailers');
    const parentAgents = this.agents.filter((agent) => agent.tier !== AgentTier.Retail);
    const devices: PosDevice[] = [];
    let deviceSequence = 0;

    const retailers = Array.from({ length: COUNTS.retailers }, (_, index) => {
      const agent = random.pick(parentAgents);
      const province = PROVINCES.find((item) => item.name === agent.province) ?? random.pick(PROVINCES);
      const shopName = `${random.pick(SHOP_PREFIXES)} ${random.pick(SHOP_SUFFIXES)}`;
      const ownerName = `${random.pick(LAO_GIVEN_NAMES)} ${random.pick(LAO_FAMILY_NAMES)}`;
      const status = random.weighted([
        { value: RetailerStatus.Active, weight: 74 },
        { value: RetailerStatus.PendingApproval, weight: 10 },
        { value: RetailerStatus.Inactive, weight: 8 },
        { value: RetailerStatus.Suspended, weight: 5 },
        { value: RetailerStatus.Closed, weight: 3 },
      ]);
      const retailerId = `rtl-${(index + 1).toString().padStart(4, '0')}`;

      const deviceCount = status === RetailerStatus.Active ? random.int(1, 3) : random.int(0, 1);
      const ownDevices: PosDevice[] = [];
      for (let d = 0; d < deviceCount && devices.length < COUNTS.devices; d++) {
        deviceSequence++;
        const device: PosDevice = {
          id: `pos-${deviceSequence.toString().padStart(4, '0')}`,
          serialNumber: `SN${random.digits(10)}`,
          imei: random.digits(15),
          model: random.pick([
            PosDeviceModel.SunmiV2,
            PosDeviceModel.PaxA920,
            PosDeviceModel.IngenicoDx8000,
            PosDeviceModel.NewlandN910,
            PosDeviceModel.AndroidTablet,
          ]),
          status:
            status === RetailerStatus.Active
              ? random.weighted([
                  { value: PosDeviceStatus.Active, weight: 78 },
                  { value: PosDeviceStatus.Maintenance, weight: 8 },
                  { value: PosDeviceStatus.Faulty, weight: 6 },
                  { value: PosDeviceStatus.Inactive, weight: 5 },
                  { value: PosDeviceStatus.Blocked, weight: 3 },
                ])
              : PosDeviceStatus.PendingActivation,
          retailerId,
          retailerName: shopName,
          agentId: agent.id,
          qrCode: `LLQR${random.digits(12)}`,
          firmwareVersion: `2.${random.int(1, 9)}.${random.int(0, 12)}`,
          appVersion: `4.${random.int(0, 8)}.${random.int(0, 20)}`,
          activatedAt: random.dateWithin(NOW, 10, 700),
          lastHeartbeatAt: random.dateWithin(NOW, 0, 3),
          batteryLevel: random.int(12, 100),
          simNumber: `856${random.digits(9)}`,
          network: random.pick(['Unitel', 'Lao Telecom', 'ETL', 'Beeline']),
          ticketsToday: random.int(0, 320),
          salesToday: random.int(0, 18_000_000),
          latitude: random.float(13.9, 22.5, 4),
          longitude: random.float(100.1, 107.6, 4),
          tenantId: TENANT,
          createdAt: random.dateWithin(NOW, 10, 700),
          createdBy: 'System',
          updatedAt: random.dateWithin(NOW, 0, 10),
        };
        devices.push(device);
        ownDevices.push(device);
      }

      return {
        id: retailerId,
        code: `RT-${province.code}-${(index + 1).toString().padStart(4, '0')}`,
        shopName,
        ownerName,
        shopType: random.pick([
          ShopType.Standalone,
          ShopType.Kiosk,
          ShopType.Convenience,
          ShopType.Supermarket,
          ShopType.FuelStation,
          ShopType.Mobile,
        ]),
        status,
        kycStatus: status === RetailerStatus.PendingApproval ? KycStatus.Pending : KycStatus.Approved,
        agentId: agent.id,
        agentName: agent.name,
        contact: {
          phone: laoPhone(random.digits(6)),
          email: `${shopName.toLowerCase().replace(/\s+/g, '.')}@retail.laolottery.la`,
        },
        address: {
          line1: `${random.int(1, 400)} ${random.pick(VILLAGES)}`,
          district: random.pick(province.districts),
          province: province.name,
          country: 'Lao PDR',
        },
        province: province.name,
        district: random.pick(province.districts),
        latitude: random.float(13.9, 22.5, 4),
        longitude: random.float(100.1, 107.6, 4),
        openingTime: `0${random.int(6, 9)}:00`,
        closingTime: `${random.int(19, 22)}:00`,
        walletId: `wal-rtl-${(index + 1).toString().padStart(4, '0')}`,
        walletBalance: random.int(200_000, 46_000_000),
        creditLimit: random.int(5_000_000, 90_000_000),
        commissionRate: random.float(3, 6.5, 1),
        deviceCount: ownDevices.length,
        devices: ownDevices,
        ticketsToday: random.int(0, 480),
        salesToday: random.int(0, 26_000_000),
        salesMonth: random.int(4_000_000, 640_000_000),
        rating: random.float(3.1, 5, 1),
        photoUrl: PLACEHOLDER.photo(`shop-${index}`, 600, 400),
        licenceNumber: `LIC${random.digits(8)}`,
        licenceExpiry: daysAhead(random.int(30, 900)).slice(0, 10),
        tenantId: TENANT,
        notes: random.bool(0.18) ? 'Requested an additional terminal for the evening peak.' : undefined,
        createdAt: random.dateWithin(NOW, 20, 1100),
        createdBy: 'System',
        updatedAt: random.dateWithin(NOW, 0, 30),
      } satisfies Retailer;
    });

    this.retailersCache = retailers;
    this.devicesCache = devices;
  }

  // --------------------------------------------------------------- lotteries

  private lotteriesCache?: LotteryGame[];

  get lotteries(): LotteryGame[] {
    this.lotteriesCache ??= this.buildLotteries();
    return this.lotteriesCache;
  }

  private buildLotteries(): LotteryGame[] {
    const random = mockRandom('lotteries');
    const definitions: {
      type: LotteryType;
      name: string;
      nameLo: string;
      digits: number;
      frequency: DrawFrequency;
      colour: string;
      days: string[];
    }[] = [
      {
        type: LotteryType.TwoDigit,
        name: 'Lao 2D',
        nameLo: 'ລາວ 2 ໂຕ',
        digits: 2,
        frequency: DrawFrequency.Daily,
        colour: '#0ea5e9',
        days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      },
      {
        type: LotteryType.ThreeDigit,
        name: 'Lao 3D',
        nameLo: 'ລາວ 3 ໂຕ',
        digits: 3,
        frequency: DrawFrequency.Daily,
        colour: '#6366f1',
        days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      },
      {
        type: LotteryType.FourDigit,
        name: 'Lao 4D',
        nameLo: 'ລາວ 4 ໂຕ',
        digits: 4,
        frequency: DrawFrequency.TwiceWeekly,
        colour: '#8b5cf6',
        days: ['WED', 'SAT'],
      },
      {
        type: LotteryType.FiveDigit,
        name: 'Lao 5D',
        nameLo: 'ລາວ 5 ໂຕ',
        digits: 5,
        frequency: DrawFrequency.Weekly,
        colour: '#ec4899',
        days: ['SUN'],
      },
      {
        type: LotteryType.SixDigit,
        name: 'Mekong Mega 6',
        nameLo: 'ແມ່ໂຂງ ເມກາ 6',
        digits: 6,
        frequency: DrawFrequency.TwiceWeekly,
        colour: '#f59e0b',
        days: ['TUE', 'FRI'],
      },
      {
        type: LotteryType.Animal,
        name: 'Animal Fortune 12',
        nameLo: 'ສັດ 12 ນັກສັດ',
        digits: 2,
        frequency: DrawFrequency.Daily,
        colour: '#10b981',
        days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      },
      {
        type: LotteryType.Special,
        name: 'Golden Naga Special',
        nameLo: 'ນາກຄຳພິເສດ',
        digits: 6,
        frequency: DrawFrequency.Monthly,
        colour: '#eab308',
        days: ['LAST_FRI'],
      },
      {
        type: LotteryType.Holiday,
        name: 'Boun Pi Mai Holiday Draw',
        nameLo: 'ຫວຍບຸນປີໃໝ່',
        digits: 6,
        frequency: DrawFrequency.Special,
        colour: '#ef4444',
        days: ['FESTIVAL'],
      },
    ];

    return definitions.map((definition, index) => ({
      id: `lot-${(index + 1).toString().padStart(3, '0')}`,
      code: definition.type,
      name: definition.name,
      nameLo: definition.nameLo,
      type: definition.type,
      status: index === 7 ? LotteryStatus.Paused : LotteryStatus.Active,
      description: `${definition.name} is a ${definition.digits}-digit game drawn ${definition.frequency.toLowerCase().replace('_', ' ')}.`,
      frequency: definition.frequency,
      drawDays: definition.days,
      digitCount: definition.digits,
      bannerUrl: PLACEHOLDER.photo(`lottery-${definition.type}`, 1200, 400),
      iconUrl: PLACEHOLDER.photo(`icon-${definition.type}`, 128, 128),
      colour: definition.colour,
      configuration: {
        openTime: '06:00',
        closeTime: index % 2 === 0 ? '19:30' : '20:00',
        cutOffMinutes: 15,
        minStake: 1_000,
        maxStake: 5_000_000,
        maxTicketsPerCustomer: 50,
        maxExposurePerNumber: 800_000_000,
        taxPercent: 5,
        agentCommissionPercent: random.float(5, 9, 1),
        retailerCommissionPercent: random.float(3, 6, 1),
        allowCancellation: true,
        cancellationWindowMinutes: 10,
        claimWindowDays: 90,
      },
      prizeTiers: this.buildPrizeTiers(definition.digits, index),
      totalDraws: random.int(120, 2_400),
      activeDraws: random.int(1, 4),
      ticketsSoldToday: random.int(400, 42_000),
      salesToday: random.int(18_000_000, 1_400_000_000),
      salesMonth: random.int(600_000_000, 24_000_000_000),
      popularityScore: random.int(45, 99),
      tenantId: TENANT,
      createdAt: daysAgo(900 - index * 40),
      createdBy: 'System',
      updatedAt: random.dateWithin(NOW, 0, 60),
    }));
  }

  private buildPrizeTiers(digits: number, seed: number): PrizeTier[] {
    const random = mockRandom(`prizes-${seed}`);
    const tiers: { code: PrizeTierCode; name: string; criteria: string; multiplier: number }[] = [
      {
        code: PrizeTierCode.Jackpot,
        name: 'Jackpot',
        criteria: `All ${digits} digits in exact order`,
        multiplier: digits * 180,
      },
      {
        code: PrizeTierCode.First,
        name: 'First Prize',
        criteria: `${digits} digits, any order`,
        multiplier: digits * 60,
      },
      {
        code: PrizeTierCode.Second,
        name: 'Second Prize',
        criteria: `Last ${Math.max(2, digits - 1)} digits`,
        multiplier: digits * 20,
      },
      {
        code: PrizeTierCode.Third,
        name: 'Third Prize',
        criteria: `Last ${Math.max(2, digits - 2)} digits`,
        multiplier: digits * 8,
      },
      { code: PrizeTierCode.Consolation, name: 'Consolation', criteria: 'First 2 digits', multiplier: 3 },
    ];

    return tiers.slice(0, digits <= 2 ? 3 : 5).map((tier, index) => ({
      id: `pt-${seed}-${index}`,
      code: tier.code,
      name: tier.name,
      matchCriteria: tier.criteria,
      multiplier: tier.multiplier,
      fixedAmount: 0,
      maxWinners: random.int(1, 400),
      taxPercent: index === 0 ? 8 : 5,
      order: index + 1,
    }));
  }

  // ------------------------------------------------------------------- draws

  private drawsCache?: Draw[];

  get draws(): Draw[] {
    this.drawsCache ??= this.buildDraws();
    return this.drawsCache;
  }

  private buildDraws(): Draw[] {
    const random = mockRandom('draws');
    const draws: Draw[] = [];

    /*
     * The calendar is generated day by day rather than by scattering draws at
     * random offsets. Real operations run a fixed number of draws every day, and
     * a random spread leaves gaps — including, often, today, which makes every
     * "today" figure on the dashboard read as zero.
     *
     * 45 days of history and 21 days ahead, at two draws a day.
     */
    const DRAWS_PER_DAY = 2;
    const PAST_DAYS = 45;
    const FUTURE_DAYS = 21;
    const schedule: { scheduled: Date; isPast: boolean; isImminent: boolean }[] = [];

    for (let dayOffset = -PAST_DAYS; dayOffset <= FUTURE_DAYS; dayOffset++) {
      for (let slot = 0; slot < DRAWS_PER_DAY; slot++) {
        const day = new Date(NOW.getTime() + dayOffset * 86_400_000);
        // Midday and evening draws, the usual national-lottery rhythm.
        const scheduled = atTime(day, slot === 0 ? 13 : 20, slot === 0 ? 30 : 0);
        const delta = scheduled.getTime() - NOW.getTime();
        schedule.push({
          scheduled,
          isPast: delta < 0,
          isImminent: delta >= 0 && delta < 12 * 3_600_000,
        });
      }
    }

    for (let index = 0; index < schedule.length; index++) {
      const lottery = random.pick(this.lotteries);
      const { scheduled, isPast, isImminent } = schedule[index]!;

      const status: DrawStatus = isPast
        ? random.weighted([
            { value: DrawStatus.Published, weight: 86 },
            { value: DrawStatus.PendingVerification, weight: 7 },
            { value: DrawStatus.RolledBack, weight: 4 },
            { value: DrawStatus.Cancelled, weight: 3 },
          ])
        : isImminent
          ? random.pick([DrawStatus.SalesOpen, DrawStatus.SalesClosed, DrawStatus.Drawing])
          : DrawStatus.Scheduled;

      const ticketsSold = isPast || isImminent ? random.int(3_400, 168_000) : random.int(0, 26_000);
      const salesAmount = ticketsSold * random.int(2_000, 26_000);
      const payoutAmount =
        status === DrawStatus.Published ? Math.round(salesAmount * random.float(0.38, 0.63)) : 0;
      const taxCollected = Math.round(payoutAmount * 0.05);
      const commissionPaid = Math.round(salesAmount * random.float(0.06, 0.11));

      draws.push({
        id: `drw-${(index + 1).toString().padStart(4, '0')}`,
        code: `${lottery.code}-${scheduled.getFullYear()}${(scheduled.getMonth() + 1).toString().padStart(2, '0')}${scheduled.getDate().toString().padStart(2, '0')}-${(index % DRAWS_PER_DAY) + 1}`,
        lotteryId: lottery.id,
        lotteryName: lottery.name,
        lotteryType: lottery.type,
        drawNumber: 4000 + index,
        status,
        mode: random.weighted([
          { value: DrawMode.Automatic, weight: 58 },
          { value: DrawMode.Manual, weight: 26 },
          { value: DrawMode.Live, weight: 16 },
        ]),
        scheduledAt: iso(scheduled),
        salesOpenAt: iso(atTime(scheduled, 6, 0)),
        // Sales close thirty minutes before the draw itself.
        salesCloseAt: iso(new Date(scheduled.getTime() - 30 * 60_000)),
        // Execution timestamps can never be in the future, whatever the schedule.
        drawnAt:
          status === DrawStatus.Published || status === DrawStatus.PendingVerification
            ? iso(new Date(Math.min(scheduled.getTime() + 2 * 60_000, NOW.getTime())))
            : undefined,
        publishedAt:
          status === DrawStatus.Published
            ? iso(new Date(Math.min(scheduled.getTime() + 18 * 60_000, NOW.getTime())))
            : undefined,
        winningNumbers:
          status === DrawStatus.Published || status === DrawStatus.PendingVerification
            ? this.buildWinningNumbers(random, lottery, salesAmount)
            : [],
        ticketsSold,
        salesAmount,
        winnerCount: status === DrawStatus.Published ? random.int(12, 2_800) : 0,
        payoutAmount,
        grossProfit: salesAmount - payoutAmount - commissionPaid,
        taxCollected,
        commissionPaid,
        jackpotAmount: random.int(200_000_000, 5_400_000_000),
        rolloverAmount: random.bool(0.3) ? random.int(50_000_000, 900_000_000) : 0,
        verification: {
          verifiedBy: status === DrawStatus.Published ? 'Vilaysone Keodara' : undefined,
          verifiedAt: status === DrawStatus.Published ? iso(atTime(scheduled, 20, 10)) : undefined,
          approvedBy: status === DrawStatus.Published ? 'Bounmy Sisouphanh' : undefined,
          approvedAt: status === DrawStatus.Published ? iso(atTime(scheduled, 20, 15)) : undefined,
          witnessNames: ['Ministry of Finance Observer', 'Internal Audit', 'Notary Public'],
          checksum: `sha256:${random.digits(12)}`,
          remarks:
            status === DrawStatus.RolledBack ? 'Number entry mismatch found during verification.' : undefined,
        },
        streamUrl: random.bool(0.3) ? 'https://live.laolottery.la/stream' : undefined,
        rollbackReason:
          status === DrawStatus.RolledBack ? 'Verification checksum did not match the RNG log.' : undefined,
        cancelledReason:
          status === DrawStatus.Cancelled ? 'Draw cancelled due to a national day of mourning.' : undefined,
        tenantId: TENANT,
        createdAt: iso(new Date(scheduled.getTime() - 14 * 86_400_000)),
        createdBy: 'Scheduler',
        updatedAt: random.dateWithin(NOW, 0, 20),
      });
    }

    return draws.sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt));
  }

  private buildWinningNumbers(
    random: SeededRandom,
    lottery: LotteryGame,
    salesAmount: number,
  ): DrawWinningNumber[] {
    return lottery.prizeTiers.map((tier) => {
      const winnerCount = random.int(0, tier.maxWinners);
      const prizePerWinner = random.int(50_000, 12_000_000);
      return {
        tierCode: tier.code,
        tierName: tier.name,
        numbers: [random.digits(lottery.digitCount)],
        winnerCount,
        prizePerWinner,
        totalPayout: Math.min(winnerCount * prizePerWinner, Math.round(salesAmount * 0.7)),
      };
    });
  }

  // ----------------------------------------------------------------- tickets

  private ticketsCache?: Ticket[];

  get tickets(): Ticket[] {
    this.ticketsCache ??= this.buildTickets();
    return this.ticketsCache;
  }

  private buildTickets(): Ticket[] {
    const random = mockRandom('tickets');
    const customers = this.users.filter((user) => user.type === UserType.Customer);
    const activeRetailers = this.retailers.filter((retailer) => retailer.status === RetailerStatus.Active);

    /*
     * A ticket can only exist once its draw's sales window has opened, so
     * future draws are excluded. Recent draws are weighted more heavily so
     * "today" and "this week" always have visible activity on the dashboard.
     */
    const sellable = this.draws
      .filter((draw) => Date.parse(draw.salesOpenAt) <= NOW.getTime())
      .sort((a, b) => Date.parse(b.salesOpenAt) - Date.parse(a.salesOpenAt));

    const pickDraw = (): Draw => {
      // Squaring a uniform sample biases selection towards the newest draws.
      const bias = random.next() ** 2;
      return sellable[Math.min(sellable.length - 1, Math.floor(bias * sellable.length))] as Draw;
    };

    return Array.from({ length: COUNTS.tickets }, (_, index) => {
      const draw = pickDraw();
      const lottery = this.lotteries.find((item) => item.id === draw.lotteryId) ?? this.lotteries[0]!;
      const retailer = random.pick(activeRetailers);
      const customer = random.pick(customers);

      // Purchased inside the sales window, and never later than right now.
      const windowStart = Date.parse(draw.salesOpenAt);
      const windowEnd = Math.min(Date.parse(draw.salesCloseAt), NOW.getTime());
      const purchasedAt = new Date(windowStart + random.next() * Math.max(0, windowEnd - windowStart));

      const drawPublished = draw.status === DrawStatus.Published;
      const status: TicketStatus = drawPublished
        ? random.weighted([
            // ~7% of tickets on a published draw win, which lands the return
            // to player near 55% against the fixed prize amounts below.
            { value: TicketStatus.Sold, weight: 83 },
            { value: TicketStatus.Winning, weight: 4 },
            { value: TicketStatus.Claimed, weight: 3 },
            { value: TicketStatus.Cancelled, weight: 6 },
            { value: TicketStatus.Expired, weight: 3 },
            { value: TicketStatus.Void, weight: 1 },
          ])
        : random.weighted([
            { value: TicketStatus.Sold, weight: 84 },
            { value: TicketStatus.Pending, weight: 10 },
            { value: TicketStatus.Cancelled, weight: 6 },
          ]);

      const lines = this.buildTicketLines(random, lottery.digitCount, status);
      const totalStake = lines.reduce((sum, line) => sum + line.stake, 0);
      const totalPayout = lines.reduce((sum, line) => sum + line.payout, 0);
      const taxDeducted = Math.round(totalPayout * 0.05);

      return {
        id: `tkt-${(index + 1).toString().padStart(5, '0')}`,
        ticketNumber: `LL-${purchasedAt.getFullYear()}-${(index + 1).toString().padStart(6, '0')}`,
        serialNumber: random.digits(16),
        barcode: random.digits(13),
        qrPayload: `LLQR|${draw.code}|${random.digits(18)}`,
        drawId: draw.id,
        drawCode: draw.code,
        lotteryId: lottery.id,
        lotteryName: lottery.name,
        lotteryType: lottery.type,
        status,
        channel: random.weighted([
          { value: TicketChannel.Retailer, weight: 44 },
          { value: TicketChannel.Pos, weight: 22 },
          { value: TicketChannel.MobileApp, weight: 20 },
          { value: TicketChannel.Web, weight: 8 },
          { value: TicketChannel.Kiosk, weight: 4 },
          { value: TicketChannel.Ussd, weight: 2 },
        ]),
        customerId: customer.id,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        retailerId: retailer.id,
        retailerName: retailer.shopName,
        agentId: retailer.agentId,
        agentName: retailer.agentName,
        deviceId: retailer.devices[0]?.id,
        lines,
        totalStake,
        totalPayout,
        taxDeducted,
        netPayout: totalPayout - taxDeducted,
        purchasedAt: iso(purchasedAt),
        cancelledAt:
          status === TicketStatus.Cancelled ? iso(new Date(purchasedAt.getTime() + 300_000)) : undefined,
        cancelledBy: status === TicketStatus.Cancelled ? retailer.ownerName : undefined,
        cancellationReason:
          status === TicketStatus.Cancelled
            ? 'Cancelled at customer request within the allowed window.'
            : undefined,
        claimStatus:
          status === TicketStatus.Claimed
            ? ClaimStatus.Paid
            : status === TicketStatus.Winning
              ? random.pick([
                  ClaimStatus.Unclaimed,
                  ClaimStatus.Submitted,
                  ClaimStatus.UnderReview,
                  ClaimStatus.Approved,
                ])
              : ClaimStatus.Unclaimed,
        claimedAt: status === TicketStatus.Claimed ? random.dateWithin(NOW, 0, 40) : undefined,
        claimedBy: status === TicketStatus.Claimed ? customer.fullName : undefined,
        validatedAt: status === TicketStatus.Claimed ? random.dateWithin(NOW, 0, 40) : undefined,
        validatedBy: status === TicketStatus.Claimed ? 'Counter Validation' : undefined,
        expiresAt: iso(new Date(Date.parse(draw.scheduledAt) + 90 * 86_400_000)),
        province: retailer.province,
        tenantId: TENANT,
        createdAt: iso(purchasedAt),
        createdBy: retailer.shopName,
        updatedAt: iso(purchasedAt),
      } satisfies Ticket;
    });
  }

  private buildTicketLines(random: SeededRandom, digits: number, status: TicketStatus): TicketLine[] {
    const won = status === TicketStatus.Winning || status === TicketStatus.Claimed;
    const lineCount = random.int(1, 4);

    /*
     * Prizes are fixed amounts per tier, not stake multiplied by a factor.
     *
     * That is how a published prize table actually works, and it keeps the
     * aggregate return to player stable: with only a couple of dozen winners in
     * a demo-sized sample, stake-multiplied prizes swing the monthly margin from
     * strongly positive to strongly negative purely on which stakes happened to
     * win. Fixed amounts land the return near 55%, matching the house edge the
     * draw-level figures already assume.
     */
    const prizeTier = (): { tier: PrizeTierCode; amount: number } =>
      random.weighted([
        { value: { tier: PrizeTierCode.Consolation, amount: 200_000 }, weight: 70 },
        { value: { tier: PrizeTierCode.Third, amount: 800_000 }, weight: 22 },
        { value: { tier: PrizeTierCode.Second, amount: 3_000_000 }, weight: 8 },
      ]);

    return Array.from({ length: lineCount }, (_, index) => {
      const stake = random.pick([1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000]);
      const lineWon = won && index === 0;
      const prize = prizeTier();
      return {
        id: `line-${index}`,
        numbers: [random.digits(digits)],
        betType: random.pick(['Straight', 'Rumble', 'Front Pair', 'Back Pair', 'Box']),
        stake,
        potentialPayout: prize.amount,
        won: lineWon,
        matchedTier: lineWon ? prize.tier : undefined,
        payout: lineWon ? prize.amount : 0,
      };
    });
  }

  // ------------------------------------------------------------------ wallet

  private walletsCache?: Wallet[];

  get wallets(): Wallet[] {
    this.walletsCache ??= this.buildWallets();
    return this.walletsCache;
  }

  private buildWallets(): Wallet[] {
    const random = mockRandom('wallets');
    const wallets: Wallet[] = [];

    const push = (
      id: string,
      ownerId: string,
      ownerName: string,
      ownerType: WalletOwnerType,
      balance: number,
      province: string | undefined,
      avatar: string,
    ): void => {
      const held = Math.round(balance * random.float(0, 0.14));
      const status = random.weighted([
        { value: WalletStatus.Active, weight: 84 },
        { value: WalletStatus.Frozen, weight: 8 },
        { value: WalletStatus.Suspended, weight: 5 },
        { value: WalletStatus.Closed, weight: 3 },
      ]);
      wallets.push({
        id,
        code: `W-${id.toUpperCase()}`,
        ownerId,
        ownerName,
        ownerType,
        ownerAvatar: avatar,
        status,
        currency: 'LAK',
        balance,
        availableBalance: balance - held,
        heldBalance: held,
        creditLimit: random.int(0, 120_000_000),
        lifetimeCredit: balance + random.int(10_000_000, 2_400_000_000),
        lifetimeDebit: random.int(8_000_000, 2_200_000_000),
        lastTransactionAt: random.dateWithin(NOW, 0, 12),
        frozenAt: status === WalletStatus.Frozen ? random.dateWithin(NOW, 1, 40) : undefined,
        frozenBy: status === WalletStatus.Frozen ? 'Risk & Compliance' : undefined,
        freezeReason:
          status === WalletStatus.Frozen ? 'Unusual withdrawal pattern under investigation.' : undefined,
        province,
        tenantId: TENANT,
        createdAt: random.dateWithin(NOW, 40, 1200),
        createdBy: 'System',
        updatedAt: random.dateWithin(NOW, 0, 6),
      });
    };

    for (const agent of this.agents) {
      push(
        agent.walletId,
        agent.id,
        agent.name,
        WalletOwnerType.Agent,
        agent.walletBalance,
        agent.province,
        agent.avatarUrl,
      );
    }
    for (const retailer of this.retailers) {
      push(
        retailer.walletId,
        retailer.id,
        retailer.shopName,
        WalletOwnerType.Retailer,
        retailer.walletBalance,
        retailer.province,
        retailer.photoUrl,
      );
    }
    for (const customer of this.users.filter((user) => user.type === UserType.Customer).slice(0, 30)) {
      push(
        `wal-cus-${customer.id.slice(-4)}`,
        customer.id,
        customer.fullName,
        WalletOwnerType.Customer,
        random.int(0, 24_000_000),
        customer.address?.province,
        customer.avatarUrl,
      );
    }
    push(
      'wal-sys-0001',
      'system',
      'Prize Pool Account',
      WalletOwnerType.System,
      18_400_000_000,
      undefined,
      PLACEHOLDER.avatar('Prize Pool'),
    );
    push(
      'wal-sys-0002',
      'system',
      'Operational Float',
      WalletOwnerType.System,
      4_200_000_000,
      undefined,
      PLACEHOLDER.avatar('Operational Float'),
    );

    return wallets;
  }

  private walletTransactionsCache?: WalletTransaction[];

  get walletTransactions(): WalletTransaction[] {
    this.walletTransactionsCache ??= this.buildWalletTransactions();
    return this.walletTransactionsCache;
  }

  private buildWalletTransactions(): WalletTransaction[] {
    const random = mockRandom('wallet-transactions');

    return Array.from({ length: COUNTS.walletTransactions }, (_, index) => {
      const wallet = random.pick(this.wallets);
      const type = random.weighted([
        { value: TransactionType.TicketPurchase, weight: 26 },
        { value: TransactionType.Commission, weight: 16 },
        { value: TransactionType.Deposit, weight: 14 },
        { value: TransactionType.PrizePayout, weight: 12 },
        { value: TransactionType.Withdrawal, weight: 10 },
        { value: TransactionType.Settlement, weight: 8 },
        { value: TransactionType.Transfer, weight: 6 },
        { value: TransactionType.Fee, weight: 3 },
        { value: TransactionType.Adjustment, weight: 3 },
        { value: TransactionType.Reversal, weight: 2 },
      ]);
      const direction = [
        TransactionType.Deposit,
        TransactionType.Commission,
        TransactionType.PrizePayout,
        TransactionType.TicketRefund,
      ].includes(type)
        ? TransactionDirection.Credit
        : TransactionDirection.Debit;

      const amount = random.int(20_000, 96_000_000);
      const fee = Math.round(amount * random.float(0, 0.012));
      const tax = type === TransactionType.PrizePayout ? Math.round(amount * 0.05) : 0;
      const status = random.weighted([
        { value: TransactionStatus.Success, weight: 82 },
        { value: TransactionStatus.Pending, weight: 6 },
        { value: TransactionStatus.Processing, weight: 4 },
        { value: TransactionStatus.Failed, weight: 5 },
        { value: TransactionStatus.Reversed, weight: 2 },
        { value: TransactionStatus.OnHold, weight: 1 },
      ]);
      const balanceBefore = wallet.balance + random.int(-40_000_000, 40_000_000);
      const createdAt = random.dateWithin(NOW, 0, 120);

      return {
        id: `wtx-${(index + 1).toString().padStart(6, '0')}`,
        reference: `WTX${random.digits(12)}`,
        walletId: wallet.id,
        walletCode: wallet.code,
        ownerName: wallet.ownerName,
        ownerType: wallet.ownerType,
        type,
        direction,
        status,
        amount,
        fee,
        tax,
        netAmount: amount - fee - tax,
        currency: 'LAK',
        balanceBefore: Math.max(0, balanceBefore),
        balanceAfter: Math.max(
          0,
          direction === TransactionDirection.Credit ? balanceBefore + amount : balanceBefore - amount,
        ),
        counterpartyId: random.bool(0.5) ? random.pick(this.wallets).id : undefined,
        counterpartyName: random.bool(0.5) ? random.pick(this.wallets).ownerName : undefined,
        relatedEntityType: type === TransactionType.TicketPurchase ? 'TICKET' : undefined,
        relatedEntityId: type === TransactionType.TicketPurchase ? random.pick(this.tickets).id : undefined,
        method: random.pick([
          PaymentMethod.BankTransfer,
          PaymentMethod.MobileMoney,
          PaymentMethod.Qr,
          PaymentMethod.Cash,
          PaymentMethod.Wallet,
        ]),
        narration: `${type.replace(/_/g, ' ').toLowerCase()} for ${wallet.ownerName}`,
        failureReason:
          status === TransactionStatus.Failed
            ? random.pick([
                'Insufficient balance',
                'Gateway timeout',
                'Beneficiary account closed',
                'Daily limit exceeded',
              ])
            : undefined,
        reversedByReference: status === TransactionStatus.Reversed ? `WTX${random.digits(12)}` : undefined,
        processedAt: status === TransactionStatus.Success ? createdAt : undefined,
        tenantId: TENANT,
        createdAt,
        createdBy: 'System',
        updatedAt: createdAt,
      } satisfies WalletTransaction;
    }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  // ---------------------------------------------------------------- payments

  private banksCache?: Bank[];

  get banks(): Bank[] {
    const random = mockRandom('banks');
    this.banksCache ??= BANKS.map((bank, index) => ({
      id: `bnk-${(index + 1).toString().padStart(3, '0')}`,
      code: bank.code,
      name: bank.name,
      nameLo: bank.nameLo,
      swiftCode: bank.swift,
      logoUrl: PLACEHOLDER.avatar(bank.code),
      active: index !== BANKS.length - 1,
      supportsInstantTransfer: random.bool(0.7),
      settlementAccount: random.digits(14),
      contactPerson: `${random.pick(LAO_GIVEN_NAMES)} ${random.pick(LAO_FAMILY_NAMES)}`,
      contactPhone: laoPhone(random.digits(6)),
      transactionCount: random.int(1_200, 184_000),
      transactionVolume: random.int(400_000_000, 42_000_000_000),
      createdAt: daysAgo(800 - index * 20),
      createdBy: 'System',
      updatedAt: random.dateWithin(NOW, 0, 90),
    }));
    return this.banksCache;
  }

  private gatewaysCache?: PaymentGateway[];

  get gateways(): PaymentGateway[] {
    const random = mockRandom('gateways');
    this.gatewaysCache ??= PAYMENT_GATEWAYS.map((gateway, index) => ({
      id: `gw-${(index + 1).toString().padStart(3, '0')}`,
      code: gateway.code,
      name: gateway.name,
      provider: gateway.provider,
      logoUrl: PLACEHOLDER.avatar(gateway.name),
      status: random.weighted([
        { value: PaymentGatewayStatus.Active, weight: 74 },
        { value: PaymentGatewayStatus.Degraded, weight: 12 },
        { value: PaymentGatewayStatus.Maintenance, weight: 8 },
        { value: PaymentGatewayStatus.Inactive, weight: 6 },
      ]),
      methods: random.pickMany(
        [
          PaymentMethod.BankTransfer,
          PaymentMethod.Card,
          PaymentMethod.MobileMoney,
          PaymentMethod.Qr,
          PaymentMethod.Wallet,
        ],
        random.int(2, 4),
      ),
      currencies: ['LAK', 'THB', 'USD'].slice(0, random.int(1, 3)),
      feePercent: random.float(0.4, 2.6, 2),
      feeFlat: random.pick([0, 1_000, 2_000, 5_000]),
      settlementDays: random.int(0, 3),
      successRate: random.float(88, 99.8, 1),
      avgResponseMs: random.int(180, 2_400),
      volumeToday: random.int(20_000_000, 2_800_000_000),
      volumeMonth: random.int(900_000_000, 64_000_000_000),
      sandbox: index === PAYMENT_GATEWAYS.length - 1,
      webhookUrl: `https://api.laolottery.la/webhooks/${gateway.code.toLowerCase()}`,
      priority: index + 1,
      createdAt: daysAgo(600 - index * 30),
      createdBy: 'System',
      updatedAt: random.dateWithin(NOW, 0, 40),
    }));
    return this.gatewaysCache;
  }

  private paymentTransactionsCache?: PaymentTransaction[];

  get paymentTransactions(): PaymentTransaction[] {
    this.paymentTransactionsCache ??= this.buildPaymentTransactions();
    return this.paymentTransactionsCache;
  }

  private buildPaymentTransactions(): PaymentTransaction[] {
    const random = mockRandom('payments');
    const customers = this.users.filter((user) => user.type === UserType.Customer);

    return Array.from({ length: COUNTS.paymentTransactions }, (_, index) => {
      const gateway = random.pick(this.gateways);
      const bank = random.pick(this.banks);
      const customer = random.pick(customers);
      const amount = random.int(50_000, 68_000_000);
      const fee = Math.round(amount * (gateway.feePercent / 100)) + gateway.feeFlat;
      const status = random.weighted([
        { value: TransactionStatus.Success, weight: 76 },
        { value: TransactionStatus.Failed, weight: 10 },
        { value: TransactionStatus.Pending, weight: 7 },
        { value: TransactionStatus.Processing, weight: 4 },
        { value: TransactionStatus.Reversed, weight: 2 },
        { value: TransactionStatus.Cancelled, weight: 1 },
      ]);
      const initiatedAt = random.dateWithin(NOW, 0, 90);

      return {
        id: `pay-${(index + 1).toString().padStart(6, '0')}`,
        reference: `PAY${random.digits(12)}`,
        gatewayReference:
          status === TransactionStatus.Success ? `${gateway.code}-${random.digits(14)}` : undefined,
        gatewayId: gateway.id,
        gatewayName: gateway.name,
        method: random.pick(gateway.methods),
        status,
        direction: random.bool(0.72) ? TransactionDirection.Credit : TransactionDirection.Debit,
        amount,
        fee,
        netAmount: amount - fee,
        currency: 'LAK',
        customerId: customer.id,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        bankId: bank.id,
        bankName: bank.name,
        accountNumber: random.digits(14),
        relatedTicketId: random.bool(0.4) ? random.pick(this.tickets).id : undefined,
        narration: random.pick([
          'Wallet top-up',
          'Prize payout',
          'Agent settlement',
          'Ticket purchase',
          'Withdrawal request',
        ]),
        failureCode:
          status === TransactionStatus.Failed
            ? random.pick(['GW-408', 'GW-511', 'BANK-DECLINED', 'LIMIT-EXCEEDED'])
            : undefined,
        failureReason:
          status === TransactionStatus.Failed
            ? random.pick([
                'Gateway timed out',
                'Issuer declined the transaction',
                'Daily limit exceeded',
                'Account not found',
              ])
            : undefined,
        reconciliationStatus: random.weighted([
          { value: ReconciliationStatus.Matched, weight: 74 },
          { value: ReconciliationStatus.Unmatched, weight: 12 },
          { value: ReconciliationStatus.PartiallyMatched, weight: 8 },
          { value: ReconciliationStatus.Disputed, weight: 4 },
          { value: ReconciliationStatus.Resolved, weight: 2 },
        ]),
        retryCount: status === TransactionStatus.Failed ? random.int(0, 3) : 0,
        initiatedAt,
        completedAt: status === TransactionStatus.Success ? initiatedAt : undefined,
        tenantId: TENANT,
        createdAt: initiatedAt,
        createdBy: 'System',
        updatedAt: initiatedAt,
      } satisfies PaymentTransaction;
    }).sort((a, b) => Date.parse(b.initiatedAt) - Date.parse(a.initiatedAt));
  }

  private refundsCache?: Refund[];

  get refunds(): Refund[] {
    const random = mockRandom('refunds');
    this.refundsCache ??= Array.from({ length: COUNTS.refunds }, (_, index) => {
      const payment = random.pick(this.paymentTransactions);
      const requestedAt = random.dateWithin(NOW, 0, 70);
      const status = random.weighted([
        { value: RefundStatus.Completed, weight: 52 },
        { value: RefundStatus.Requested, weight: 18 },
        { value: RefundStatus.Approved, weight: 12 },
        { value: RefundStatus.Processing, weight: 10 },
        { value: RefundStatus.Rejected, weight: 8 },
      ]);
      return {
        id: `rfd-${(index + 1).toString().padStart(4, '0')}`,
        reference: `RFD${random.digits(10)}`,
        paymentReference: payment.reference,
        amount: payment.amount,
        currency: 'LAK',
        reason: random.pick([
          'Duplicate charge',
          'Draw cancelled',
          'Customer request',
          'Failed ticket issuance',
          'System error',
        ]),
        status,
        requestedBy: random.pick(this.users).fullName,
        requestedAt,
        approvedBy: status !== RefundStatus.Requested ? 'Souphaphone Inthavong' : undefined,
        approvedAt: status !== RefundStatus.Requested ? requestedAt : undefined,
        completedAt: status === RefundStatus.Completed ? requestedAt : undefined,
        customerName: payment.customerName,
        remarks:
          status === RefundStatus.Rejected
            ? 'Original transaction already reversed by the gateway.'
            : undefined,
        createdAt: requestedAt,
        createdBy: 'System',
        updatedAt: requestedAt,
      } satisfies Refund;
    });
    return this.refundsCache;
  }

  private settlementsCache?: Settlement[];

  get settlements(): Settlement[] {
    const random = mockRandom('settlements');
    this.settlementsCache ??= Array.from({ length: COUNTS.settlements }, (_, index) => {
      const useAgent = random.bool(0.6);
      const party = useAgent ? random.pick(this.agents) : random.pick(this.retailers);
      const partyName = useAgent ? (party as Agent).name : (party as Retailer).shopName;
      const grossSales = random.int(20_000_000, 1_800_000_000);
      const commission = Math.round(grossSales * random.float(0.04, 0.09));
      const prizePayout = Math.round(grossSales * random.float(0.35, 0.6));
      const tax = Math.round(prizePayout * 0.05);
      const adjustments = random.bool(0.3) ? random.int(-6_000_000, 6_000_000) : 0;
      const periodEnd = random.dateWithin(NOW, 1, 120);

      return {
        id: `stl-${(index + 1).toString().padStart(4, '0')}`,
        reference: `STL${random.digits(10)}`,
        partyType: useAgent ? WalletOwnerType.Agent : WalletOwnerType.Retailer,
        partyId: party.id,
        partyName,
        periodStart: iso(new Date(Date.parse(periodEnd) - 7 * 86_400_000)),
        periodEnd,
        grossSales,
        commission,
        prizePayout,
        tax,
        adjustments,
        netPayable: commission + adjustments - tax,
        currency: 'LAK',
        status: random.weighted([
          { value: SettlementStatus.Paid, weight: 48 },
          { value: SettlementStatus.Pending, weight: 20 },
          { value: SettlementStatus.Approved, weight: 16 },
          { value: SettlementStatus.Draft, weight: 8 },
          { value: SettlementStatus.Disputed, weight: 5 },
          { value: SettlementStatus.Rejected, weight: 3 },
        ]),
        bankName: random.pick(this.banks).name,
        bankAccountNumber: random.digits(14),
        approvedBy: 'Souphaphone Inthavong',
        approvedAt: random.dateWithin(NOW, 0, 60),
        paidAt: random.dateWithin(NOW, 0, 50),
        paymentReference: `PAY${random.digits(12)}`,
        remarks: random.bool(0.2) ? 'Adjusted for a POS terminal deposit refund.' : undefined,
        tenantId: TENANT,
        createdAt: periodEnd,
        createdBy: 'Settlement Engine',
        updatedAt: random.dateWithin(NOW, 0, 20),
      } satisfies Settlement;
    });
    return this.settlementsCache;
  }

  private reconciliationsCache?: ReconciliationRecord[];

  get reconciliations(): ReconciliationRecord[] {
    const random = mockRandom('reconciliations');
    this.reconciliationsCache ??= Array.from({ length: COUNTS.reconciliations }, (_, index) => {
      const gateway = random.pick(this.gateways);
      const systemCount = random.int(400, 9_800);
      const gatewayCount = systemCount + random.int(-14, 14);
      const systemAmount = random.int(80_000_000, 4_400_000_000);
      const gatewayAmount = systemAmount + random.int(-8_000_000, 8_000_000);
      const matchedCount = Math.min(systemCount, gatewayCount) - random.int(0, 12);
      const statementDate = random.dateWithin(NOW, 0, 60);

      return {
        id: `rec-${(index + 1).toString().padStart(4, '0')}`,
        batchReference: `REC${random.digits(10)}`,
        gatewayName: gateway.name,
        statementDate,
        systemCount,
        systemAmount,
        gatewayCount,
        gatewayAmount,
        matchedCount,
        unmatchedCount: Math.max(0, systemCount - matchedCount),
        varianceAmount: systemAmount - gatewayAmount,
        status:
          systemAmount === gatewayAmount
            ? ReconciliationStatus.Matched
            : random.pick([
                ReconciliationStatus.PartiallyMatched,
                ReconciliationStatus.Unmatched,
                ReconciliationStatus.Disputed,
                ReconciliationStatus.Resolved,
              ]),
        reconciledBy: random.bool(0.7) ? 'Souphaphone Inthavong' : undefined,
        reconciledAt: random.bool(0.7) ? statementDate : undefined,
        remarks: random.bool(0.25)
          ? 'Variance traced to two late-settling mobile-money transactions.'
          : undefined,
        createdAt: statementDate,
        createdBy: 'Reconciliation Engine',
        updatedAt: statementDate,
      } satisfies ReconciliationRecord;
    });
    return this.reconciliationsCache;
  }

  // ----------------------------------------------------------- notifications

  private templatesCache?: NotificationTemplate[];

  get notificationTemplates(): NotificationTemplate[] {
    const random = mockRandom('templates');
    const seeds: {
      code: string;
      name: string;
      channel: NotificationChannel;
      category: NotificationCategory;
      subject: string;
      body: string;
    }[] = [
      {
        code: 'TPL_WELCOME',
        name: 'Customer Welcome',
        channel: NotificationChannel.Email,
        category: NotificationCategory.System,
        subject: 'Welcome to the Lao National Lottery',
        body: 'Hello {{customerName}}, your account is now active.',
      },
      {
        code: 'TPL_OTP',
        name: 'Login OTP',
        channel: NotificationChannel.Sms,
        category: NotificationCategory.Security,
        subject: 'Verification code',
        body: 'Your verification code is {{code}}. It expires in {{minutes}} minutes.',
      },
      {
        code: 'TPL_DRAW_RESULT',
        name: 'Draw Result Published',
        channel: NotificationChannel.Push,
        category: NotificationCategory.Draw,
        subject: '{{lotteryName}} results are out',
        body: 'Winning numbers for {{drawCode}}: {{numbers}}.',
      },
      {
        code: 'TPL_WINNER',
        name: 'Winning Ticket',
        channel: NotificationChannel.Push,
        category: NotificationCategory.Draw,
        subject: 'Congratulations!',
        body: 'Ticket {{ticketNumber}} has won {{amount}}. Claim before {{expiry}}.',
      },
      {
        code: 'TPL_PAYOUT',
        name: 'Prize Payout Completed',
        channel: NotificationChannel.Sms,
        category: NotificationCategory.Transaction,
        subject: 'Payout completed',
        body: '{{amount}} has been credited to your wallet.',
      },
      {
        code: 'TPL_KYC_APPROVED',
        name: 'KYC Approved',
        channel: NotificationChannel.Email,
        category: NotificationCategory.Compliance,
        subject: 'Your verification is complete',
        body: 'Your documents have been approved.',
      },
      {
        code: 'TPL_KYC_REJECTED',
        name: 'KYC Rejected',
        channel: NotificationChannel.Email,
        category: NotificationCategory.Compliance,
        subject: 'Additional documents required',
        body: 'We could not verify your submission: {{reason}}.',
      },
      {
        code: 'TPL_AGENT_SETTLEMENT',
        name: 'Agent Settlement Ready',
        channel: NotificationChannel.Email,
        category: NotificationCategory.Transaction,
        subject: 'Settlement {{reference}} is ready',
        body: 'Net payable {{amount}} for {{period}}.',
      },
      {
        code: 'TPL_LOW_BALANCE',
        name: 'Low Wallet Balance',
        channel: NotificationChannel.Push,
        category: NotificationCategory.Transaction,
        subject: 'Low balance',
        body: 'Your wallet balance has fallen below {{threshold}}.',
      },
      {
        code: 'TPL_MAINTENANCE',
        name: 'Scheduled Maintenance',
        channel: NotificationChannel.InApp,
        category: NotificationCategory.System,
        subject: 'Planned maintenance',
        body: 'The portal will be unavailable from {{start}} to {{end}}.',
      },
      {
        code: 'TPL_SUSPICIOUS',
        name: 'Suspicious Activity',
        channel: NotificationChannel.Email,
        category: NotificationCategory.Security,
        subject: 'Unusual account activity',
        body: 'A sign-in from {{location}} was detected on {{device}}.',
      },
      {
        code: 'TPL_PROMO',
        name: 'Promotional Draw',
        channel: NotificationChannel.Push,
        category: NotificationCategory.Marketing,
        subject: '{{lotteryName}} jackpot is {{amount}}',
        body: 'Buy your ticket before {{cutOff}}.',
      },
      {
        code: 'TPL_APPROVAL',
        name: 'Approval Requested',
        channel: NotificationChannel.InApp,
        category: NotificationCategory.Approval,
        subject: 'Approval required',
        body: '{{requester}} has requested approval for {{subject}}.',
      },
      {
        code: 'TPL_WEBHOOK',
        name: 'Partner Webhook',
        channel: NotificationChannel.Webhook,
        category: NotificationCategory.System,
        subject: 'Event dispatch',
        body: '{"event":"{{event}}","payload":{{payload}}}',
      },
    ];

    this.templatesCache ??= seeds.map((seed, index) => ({
      id: `tpl-${(index + 1).toString().padStart(3, '0')}`,
      code: seed.code,
      name: seed.name,
      channel: seed.channel,
      category: seed.category,
      subject: seed.subject,
      body: seed.body,
      bodyLo: undefined,
      variables: [...seed.body.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1] ?? ''),
      active: random.bool(0.9),
      usageCount: random.int(40, 96_000),
      lastUsedAt: random.dateWithin(NOW, 0, 30),
      createdAt: daysAgo(500 - index * 20),
      createdBy: 'System',
      updatedAt: random.dateWithin(NOW, 0, 60),
    }));
    return this.templatesCache;
  }

  private segmentsCache?: AudienceSegment[];

  get segments(): AudienceSegment[] {
    const random = mockRandom('segments');
    const seeds = [
      { name: 'All Customers', criteria: 'type = CUSTOMER' },
      { name: 'Active Players (30 days)', criteria: 'lastTicketAt >= now-30d' },
      { name: 'High Value Players', criteria: 'monthlyStake > 5,000,000 LAK' },
      { name: 'Dormant Accounts', criteria: 'lastLoginAt <= now-90d' },
      { name: 'Unclaimed Winners', criteria: 'claimStatus = UNCLAIMED' },
      { name: 'Vientiane Capital', criteria: 'province = Vientiane Capital' },
      { name: 'Master & Distributor Agents', criteria: 'tier in (MASTER, DISTRIBUTOR)' },
      { name: 'Retailers with Low Balance', criteria: 'walletBalance < 1,000,000 LAK' },
    ];

    this.segmentsCache ??= seeds.map((seed, index) => ({
      id: `seg-${(index + 1).toString().padStart(3, '0')}`,
      code: `SEG_${index + 1}`,
      name: seed.name,
      description: `Dynamic segment resolved from: ${seed.criteria}`,
      criteria: seed.criteria,
      memberCount: random.int(120, 184_000),
      dynamic: index !== 0,
      lastRefreshedAt: random.dateWithin(NOW, 0, 3),
      createdAt: daysAgo(400 - index * 30),
      createdBy: 'System',
      updatedAt: random.dateWithin(NOW, 0, 20),
    }));
    return this.segmentsCache;
  }

  private campaignsCache?: NotificationCampaign[];

  get campaigns(): NotificationCampaign[] {
    const random = mockRandom('campaigns');
    this.campaignsCache ??= Array.from({ length: COUNTS.campaigns }, (_, index) => {
      const template = random.pick(this.notificationTemplates);
      const segment = random.pick(this.segments);
      const status = random.weighted([
        { value: CampaignStatus.Completed, weight: 44 },
        { value: CampaignStatus.Scheduled, weight: 18 },
        { value: CampaignStatus.Running, weight: 14 },
        { value: CampaignStatus.Draft, weight: 12 },
        { value: CampaignStatus.Paused, weight: 7 },
        { value: CampaignStatus.Cancelled, weight: 5 },
      ]);
      const target = random.int(500, 184_000);
      const sent = status === CampaignStatus.Completed ? target : Math.round(target * random.float(0, 0.8));
      const delivered = Math.round(sent * random.float(0.86, 0.99));

      return {
        id: `cmp-${(index + 1).toString().padStart(4, '0')}`,
        code: `CMP-${2026}-${(index + 1).toString().padStart(3, '0')}`,
        name: random.pick([
          'Boun Pi Mai Mega Jackpot',
          'Weekend Double Draw Reminder',
          'Dormant Player Reactivation',
          'Unclaimed Prize Reminder',
          'Agent Settlement Notice',
          'New 4D Game Launch',
          'Responsible Play Awareness',
          'POS Firmware Update Notice',
        ]),
        channels: random.pickMany(
          [
            NotificationChannel.Push,
            NotificationChannel.Sms,
            NotificationChannel.Email,
            NotificationChannel.InApp,
          ],
          random.int(1, 3),
        ),
        templateId: template.id,
        templateName: template.name,
        segmentId: segment.id,
        segmentName: segment.name,
        status,
        scheduledAt: random.dateWithin(NOW, -20, 60),
        startedAt: status !== CampaignStatus.Draft ? random.dateWithin(NOW, 0, 40) : undefined,
        completedAt: status === CampaignStatus.Completed ? random.dateWithin(NOW, 0, 30) : undefined,
        targetCount: target,
        sentCount: sent,
        deliveredCount: delivered,
        openedCount: Math.round(delivered * random.float(0.18, 0.62)),
        failedCount: sent - delivered,
        createdByName: random.pick(this.users).fullName,
        createdAt: random.dateWithin(NOW, 5, 200),
        createdBy: 'System',
        updatedAt: random.dateWithin(NOW, 0, 20),
      } satisfies NotificationCampaign;
    });
    return this.campaignsCache;
  }

  private notificationsCache?: NotificationMessage[];

  get notifications(): NotificationMessage[] {
    const random = mockRandom('notifications');
    this.notificationsCache ??= Array.from({ length: COUNTS.notifications }, (_, index) => {
      const category = random.pick([
        NotificationCategory.Draw,
        NotificationCategory.Transaction,
        NotificationCategory.Security,
        NotificationCategory.System,
        NotificationCategory.Approval,
        NotificationCategory.Compliance,
      ]);
      const seedsByCategory: Record<string, { title: string; body: string; icon: string; route: string }[]> =
        {
          [NotificationCategory.Draw]: [
            {
              title: 'Draw results published',
              body: 'Mekong Mega 6 draw MM6-20260724-1 has been verified and published.',
              icon: 'campaign',
              route: '/draws',
            },
            {
              title: 'Draw awaiting verification',
              body: 'Lao 3D evening draw is waiting for a second verifier.',
              icon: 'fact_check',
              route: '/draws/results',
            },
          ],
          [NotificationCategory.Transaction]: [
            {
              title: 'Large payout approved',
              body: 'A prize payout of 480,000,000 ₭ has been approved for settlement.',
              icon: 'paid',
              route: '/wallet/transactions',
            },
            {
              title: 'Failed payment batch',
              body: '14 mobile-money transactions failed in the last hour.',
              icon: 'error',
              route: '/payment',
            },
          ],
          [NotificationCategory.Security]: [
            {
              title: 'Unusual sign-in detected',
              body: 'An administrator signed in from an unrecognised device.',
              icon: 'shield',
              route: '/audit/security',
            },
            {
              title: 'Account locked',
              body: 'A user account was locked after five failed sign-in attempts.',
              icon: 'lock',
              route: '/users',
            },
          ],
          [NotificationCategory.System]: [
            {
              title: 'Scheduled maintenance',
              body: 'Reconciliation services will be offline on Sunday 02:00–04:00.',
              icon: 'build',
              route: '/settings/about',
            },
            {
              title: 'Gateway degraded',
              body: 'U-Money response times have exceeded the alert threshold.',
              icon: 'warning',
              route: '/payment/gateways',
            },
          ],
          [NotificationCategory.Approval]: [
            {
              title: 'Agent approval requested',
              body: 'Three agent applications are waiting for review.',
              icon: 'assignment_turned_in',
              route: '/agents/approvals',
            },
            {
              title: 'Refund approval requested',
              body: 'A refund of 2,400,000 ₭ needs finance approval.',
              icon: 'undo',
              route: '/payment/refunds',
            },
          ],
          [NotificationCategory.Compliance]: [
            {
              title: 'KYC backlog rising',
              body: '28 verification requests are older than 48 hours.',
              icon: 'verified_user',
              route: '/users/verification',
            },
            {
              title: 'Document expiring',
              body: 'Twelve retailer licences expire within 30 days.',
              icon: 'event_busy',
              route: '/retailers',
            },
          ],
        };
      const seed = random.pick(seedsByCategory[category] ?? seedsByCategory[NotificationCategory.System]!);
      const createdAt = random.dateWithin(NOW, 0, 14);

      return {
        id: `ntf-${(index + 1).toString().padStart(4, '0')}`,
        title: seed.title,
        body: seed.body,
        channel: NotificationChannel.InApp,
        category,
        severity: random.weighted([
          { value: Severity.Info, weight: 48 },
          { value: Severity.Medium, weight: 24 },
          { value: Severity.Low, weight: 14 },
          { value: Severity.High, weight: 10 },
          { value: Severity.Critical, weight: 4 },
        ]),
        status: NotificationStatus.Sent,
        recipientName: 'Administrator',
        read: index > 9 ? random.bool(0.75) : false,
        readAt: undefined,
        actionUrl: seed.route,
        actionLabel: 'Open',
        icon: seed.icon,
        sentAt: createdAt,
        createdAt,
        createdBy: 'System',
        updatedAt: createdAt,
      } satisfies NotificationMessage;
    }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return this.notificationsCache;
  }

  // ------------------------------------------------------------------- audit

  private auditCache?: AuditLog[];

  get auditLogs(): AuditLog[] {
    const random = mockRandom('audit');
    this.auditCache ??= Array.from({ length: COUNTS.auditLogs }, (_, index) => {
      const actor = random.pick(this.users.slice(0, 26));
      const category = random.weighted([
        { value: AuditCategory.Activity, weight: 40 },
        { value: AuditCategory.Login, weight: 22 },
        { value: AuditCategory.Transaction, weight: 18 },
        { value: AuditCategory.Api, weight: 10 },
        { value: AuditCategory.Security, weight: 7 },
        { value: AuditCategory.Error, weight: 3 },
      ]);
      const success = random.bool(category === AuditCategory.Error ? 0 : 0.94);
      const timestamp = random.dateWithin(NOW, 0, 45);
      const province = random.pick(PROVINCES);

      return {
        id: `aud-${(index + 1).toString().padStart(6, '0')}`,
        timestamp,
        category,
        action:
          category === AuditCategory.Login
            ? random.pick([AuditAction.Login, AuditAction.Logout])
            : random.pick([
                AuditAction.Create,
                AuditAction.Update,
                AuditAction.Delete,
                AuditAction.Approve,
                AuditAction.Reject,
                AuditAction.Export,
                AuditAction.Publish,
                AuditAction.Freeze,
                AuditAction.Suspend,
              ]),
        severity: success
          ? random.weighted([
              { value: Severity.Info, weight: 68 },
              { value: Severity.Low, weight: 18 },
              { value: Severity.Medium, weight: 14 },
            ])
          : random.pick([Severity.High, Severity.Critical, Severity.Medium]),
        module: random.pick([
          'Users',
          'Agents',
          'Retailers',
          'Draws',
          'Tickets',
          'Wallet',
          'Payments',
          'Settings',
          'Reports',
        ]),
        entityType: random.pick(['User', 'Agent', 'Retailer', 'Draw', 'Ticket', 'Wallet', 'Payment']),
        entityId: `ent-${random.digits(6)}`,
        entityLabel: random.pick([...LAO_GIVEN_NAMES]),
        actorId: actor.id,
        actorName: actor.fullName,
        actorRole: String(actor.primaryRole),
        actorAvatar: actor.avatarUrl,
        ipAddress: `10.${random.int(0, 60)}.${random.int(0, 255)}.${random.int(2, 250)}`,
        userAgent: `${random.pick(DEVICE_BROWSERS)} on ${random.pick(DEVICE_OS)}`,
        location: `${random.pick(province.districts)}, ${province.name}`,
        description: random.pick(AUDIT_DESCRIPTIONS),
        changes: random.bool(0.45)
          ? [
              { field: 'status', oldValue: 'PENDING', newValue: 'ACTIVE' },
              { field: 'commissionRate', oldValue: '4.5', newValue: '5.2' },
            ]
          : undefined,
        requestId: `req-${random.digits(10)}`,
        durationMs: random.int(12, 2_400),
        statusCode: success ? random.pick([200, 201, 204]) : random.pick([400, 403, 404, 409, 500, 503]),
        success,
        tenantId: TENANT,
        createdAt: timestamp,
        createdBy: actor.fullName,
        updatedAt: timestamp,
      } satisfies AuditLog;
    }).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    return this.auditCache;
  }

  // ------------------------------------------------------- platform snippets

  get announcements(): Announcement[] {
    const random = mockRandom('announcements');
    return ANNOUNCEMENT_SEEDS.map((seed, index) => ({
      id: `ann-${index + 1}`,
      title: seed.title,
      message: seed.message,
      severity: random.pick([Severity.Info, Severity.Medium, Severity.High]),
      icon: random.pick(['campaign', 'build', 'trending_up', 'task_alt']),
      link: index === 0 ? '/lottery/configuration' : undefined,
      linkLabel: index === 0 ? 'Review configuration' : undefined,
      startsAt: daysAgo(2),
      endsAt: daysAhead(12),
      dismissible: index !== 0,
      pinned: index === 0,
    }));
  }

  get systemHealth(): SystemHealth {
    const random = mockRandom('health');
    const components = [
      { id: 'api', name: 'API Gateway', icon: 'api' },
      { id: 'db', name: 'Primary Database', icon: 'database' },
      { id: 'cache', name: 'Redis Cache', icon: 'bolt' },
      { id: 'draw', name: 'Draw Engine', icon: 'stadia_controller' },
      { id: 'payment', name: 'Payment Gateways', icon: 'payments' },
      { id: 'sms', name: 'SMS Provider', icon: 'sms' },
      { id: 'storage', name: 'Document Storage', icon: 'folder' },
      { id: 'queue', name: 'Message Queue', icon: 'queue' },
    ].map((component, index) => {
      const state = index === 5 ? HealthState.Degraded : HealthState.Healthy;
      return {
        ...component,
        state,
        latencyMs: random.int(8, 480),
        uptimePercent: random.float(97.4, 99.99, 2),
        message: state === HealthState.Healthy ? 'Operating normally' : 'Elevated response times observed',
        lastCheckedAt: iso(NOW),
        history: random.series(24, 20, 100, 0),
      };
    });

    return {
      overall: components.some((item) => item.state === HealthState.Down)
        ? HealthState.Down
        : components.some((item) => item.state === HealthState.Degraded)
          ? HealthState.Degraded
          : HealthState.Healthy,
      checkedAt: iso(NOW),
      components,
      cpuPercent: random.int(18, 72),
      memoryPercent: random.int(34, 81),
      diskPercent: random.int(41, 68),
      activeSessions: random.int(120, 940),
      requestsPerMinute: random.int(800, 6_400),
      errorRatePercent: random.float(0.1, 2.4, 2),
    };
  }

  /** Login-history rows for a given user, generated on demand. */
  loginHistory(userId: string): LoginHistoryEntry[] {
    return buildLoginHistory(userId);
  }

  /** Device-history rows for a given user, generated on demand. */
  deviceHistory(userId: string): DeviceHistoryEntry[] {
    const random = mockRandom(`device-history-${userId}`);
    return Array.from({ length: 5 }, (_, index) => ({
      id: `dh-${userId}-${index}`,
      deviceId: `dev-${random.digits(10)}`,
      deviceName: random.pick(['iPhone 17 Pro', 'Galaxy S26', 'MacBook Pro', 'ThinkPad X1', 'Sunmi V2 POS']),
      deviceType: random.pick([DeviceType.Web, DeviceType.Android, DeviceType.Ios, DeviceType.Pos]),
      os: random.pick(DEVICE_OS),
      appVersion: `4.${random.int(0, 8)}.${random.int(0, 20)}`,
      firstSeenAt: random.dateWithin(NOW, 30, 500),
      lastSeenAt: random.dateWithin(NOW, 0, 20),
      trusted: random.bool(0.7),
      active: index < 2,
    }));
  }

  /** Recent activity rows for a given user, generated on demand. */
  userActivity(userId: string): UserActivityEntry[] {
    const random = mockRandom(`activity-${userId}`);
    return Array.from({ length: 12 }, (_, index) => ({
      id: `ua-${userId}-${index}`,
      timestamp: random.dateWithin(NOW, 0, 40),
      action: random.pick(['Viewed', 'Created', 'Updated', 'Approved', 'Exported', 'Deleted']),
      module: random.pick(['Users', 'Agents', 'Draws', 'Tickets', 'Wallet', 'Reports']),
      description: random.pick(AUDIT_DESCRIPTIONS),
      ipAddress: `10.${random.int(0, 60)}.${random.int(0, 255)}.${random.int(2, 250)}`,
    })).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }
}

function buildLoginHistory(userId: string): LoginHistoryEntry[] {
  const random = mockRandom(`login-history-${userId}`);
  return Array.from({ length: 14 }, (_, index) => {
    const success = random.bool(0.88);
    const province = random.pick(PROVINCES);
    return {
      id: `lh-${userId}-${index}`,
      timestamp: random.dateWithin(NOW, 0, 60),
      ipAddress: `10.${random.int(0, 60)}.${random.int(0, 255)}.${random.int(2, 250)}`,
      location: `${random.pick(province.districts)}, ${province.name}`,
      device: random.pick(['Desktop', 'Laptop', 'Mobile', 'Tablet']),
      deviceType: random.pick([DeviceType.Web, DeviceType.Android, DeviceType.Ios, DeviceType.Pos]),
      browser: random.pick(DEVICE_BROWSERS),
      os: random.pick(DEVICE_OS),
      success,
      failureReason: success
        ? undefined
        : random.pick(['Incorrect password', 'Expired session', 'OTP mismatch']),
    };
  }).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

/** The one and only dataset instance. */
export const mockDataset = new MockDataset();

export { NOW as MOCK_NOW, TENANT as MOCK_TENANT_ID };
