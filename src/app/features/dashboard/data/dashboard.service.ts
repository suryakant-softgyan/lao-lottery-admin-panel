import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { environment } from '@env/environment';
import { num } from '@core/api/live.util';
import { PLACEHOLDER } from '@core/constants/app.constants';
import { HealthState, Severity } from '@core/enums';

import {
  AgentStatus,
  DrawStatus,
  RetailerStatus,
  TicketStatus,
  TransactionStatus,
  TransactionType,
  TrendDirection,
  UserStatus,
  WalletOwnerType,
} from '@core/enums';
import { mockDataset } from '@core/mock/dataset';
import type { Announcement, Draw, StatMetric, SystemHealth, WinnerSummary } from '@core/models';
import { TranslationService } from '@core/services/translation.service';
import type { Ticket, WalletTransaction } from '@core/models';
import { MockBackendService } from '@core/services/mock-backend.service';
import { mockRandom } from '@core/utilities/random.util';
import { sumBy } from '@core/utilities/object.util';

export interface ChartSeriesData {
  labels: string[];
  series: { label: string; data: number[]; colour?: string; fill?: boolean; type?: 'bar' | 'line' }[];
}

export interface DashboardSnapshot {
  metrics: StatMetric[];
  salesTrend: ChartSeriesData;
  productMix: ChartSeriesData;
  channelSplit: ChartSeriesData;
  revenueVsPayout: ChartSeriesData;
  provinceSales: ChartSeriesData;
  recentWinners: WinnerSummary[];
  recentTickets: Ticket[];
  latestTransactions: WalletTransaction[];
  upcomingDraws: Draw[];
  announcements: Announcement[];
  health: SystemHealth;
}

const DAY_MS = 86_400_000;

/**
 * Dashboard aggregation.
 *
 * Derives every tile, chart and list from the shared mock dataset with the same
 * arithmetic the reporting service would run server-side. Swapping to the real
 * API means replacing the body of {@link load} with a single
 * `GET /dashboard/summary` — the {@link DashboardSnapshot} contract is what the
 * component renders against, and it does not change.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly backend = inject(MockBackendService);
  private readonly http = inject(HttpClient);
  private readonly translation = inject(TranslationService);

  load(): Observable<DashboardSnapshot> {
    if (!environment.useMockData) {
      return this.liveLoad();
    }
    return this.backend.respond(() => this.build(), { latencyMs: 420 });
  }

  /** Lightweight poll used by the system-health widget. */
  health(): Observable<SystemHealth> {
    if (!environment.useMockData) {
      return this.liveHealth();
    }
    return this.backend.respond(() => mockDataset.systemHealth, { latencyMs: 260 });
  }

  private build(): DashboardSnapshot {
    const random = mockRandom('dashboard');
    const now = new Date();
    const startOfToday = new Date(now).setHours(0, 0, 0, 0);

    const tickets = mockDataset.tickets;
    const draws = mockDataset.draws;
    const wallets = mockDataset.wallets;
    const transactions = mockDataset.walletTransactions;
    const payments = mockDataset.paymentTransactions;

    const todaysTickets = tickets.filter((ticket) => Date.parse(ticket.purchasedAt) >= startOfToday);
    const soldToday = todaysTickets.filter((ticket) => ticket.status !== TicketStatus.Cancelled);
    const cancelledToday = todaysTickets.filter((ticket) => ticket.status === TicketStatus.Cancelled);

    const salesToday = sumBy(soldToday, (ticket) => ticket.totalStake);

    const commissionToday = sumBy(
      transactions.filter(
        (transaction) =>
          transaction.type === TransactionType.Commission &&
          Date.parse(transaction.createdAt) >= startOfToday,
      ),
      (transaction) => transaction.amount,
    );

    /*
     * A winner is determined when a draw is published, not when the ticket was
     * bought — a ticket purchased today for tonight's draw cannot have won yet.
     * So "today's winners" counts winning tickets whose draw published today.
     */
    const drawsPublishedToday = new Set(
      draws
        .filter((draw) => draw.publishedAt && Date.parse(draw.publishedAt) >= startOfToday)
        .map((draw) => draw.id),
    );

    const ticketsFromTodaysDraws = tickets.filter((ticket) => drawsPublishedToday.has(ticket.drawId));

    const winnersToday = ticketsFromTodaysDraws.filter(
      (ticket) => ticket.status === TicketStatus.Winning || ticket.status === TicketStatus.Claimed,
    );

    const payoutFromTodaysDraws = sumBy(ticketsFromTodaysDraws, (ticket) => ticket.totalPayout);

    // Revenue booked today: stake taken in, less prizes released by today's draws.
    const revenueToday = salesToday - payoutFromTodaysDraws;

    const metrics: StatMetric[] = [
      {
        id: 'sales-today',
        label: "Today's Sales",
        value: salesToday,
        icon: 'point_of_sale',
        tone: 'primary',
        delta: random.float(-4, 18, 1),
        deltaLabel: 'vs yesterday',
        trend: TrendDirection.Up,
        sparkline: random.series(14, 40, 100, 0.04),
        route: '/reports/sales',
        hint: 'Gross stake value of every ticket sold since midnight.',
      },
      {
        id: 'revenue-today',
        label: "Today's Revenue",
        value: revenueToday,
        icon: 'savings',
        tone: 'success',
        delta: random.float(-3, 14, 1),
        deltaLabel: 'vs yesterday',
        sparkline: random.series(14, 30, 90, 0.03),
        route: '/reports/revenue',
        hint: 'Sales less prize payouts, before commission and tax.',
      },
      {
        id: 'pending-draws',
        label: 'Pending Draws',
        value: draws.filter(
          (draw) =>
            draw.status === DrawStatus.PendingVerification ||
            draw.status === DrawStatus.Drawing ||
            draw.status === DrawStatus.SalesClosed,
        ).length,
        icon: 'pending_actions',
        tone: 'warning',
        delta: random.float(-20, 12, 1),
        deltaLabel: 'awaiting action',
        route: '/draws',
        hint: 'Draws closed for sales but not yet published.',
      },
      {
        id: 'winners-today',
        label: "Today's Winners",
        value: winnersToday.length,
        icon: 'emoji_events',
        tone: 'success',
        delta: random.float(-8, 26, 1),
        deltaLabel: 'vs yesterday',
        sparkline: random.series(14, 20, 80, 0.02),
        route: '/tickets/winning',
      },
      {
        id: 'tickets-sold',
        label: 'Tickets Sold',
        value: soldToday.length,
        icon: 'confirmation_number',
        tone: 'info',
        delta: random.float(-5, 16, 1),
        deltaLabel: 'vs yesterday',
        sparkline: random.series(14, 35, 95, 0.03),
        route: '/tickets',
      },
      {
        id: 'cancelled-tickets',
        label: 'Cancelled Tickets',
        value: cancelledToday.length,
        icon: 'cancel',
        tone: 'danger',
        delta: random.float(-14, 9, 1),
        deltaLabel: 'vs yesterday',
        route: '/tickets/cancelled',
        hint: 'Cancellations inside the allowed window. A rising trend warrants review.',
      },
      {
        id: 'active-users',
        label: 'Active Users',
        value: mockDataset.users.filter((user) => user.status === UserStatus.Active).length,
        icon: 'group',
        tone: 'primary',
        delta: random.float(0, 7, 1),
        deltaLabel: 'this month',
        route: '/users',
      },
      {
        id: 'active-agents',
        label: 'Active Agents',
        value: mockDataset.agents.filter((agent) => agent.status === AgentStatus.Active).length,
        icon: 'handshake',
        tone: 'info',
        delta: random.float(-2, 9, 1),
        deltaLabel: 'this month',
        route: '/agents',
      },
      {
        id: 'retailers',
        label: 'Retailers',
        value: mockDataset.retailers.filter((retailer) => retailer.status === RetailerStatus.Active).length,
        icon: 'storefront',
        tone: 'neutral',
        delta: random.float(-1, 11, 1),
        deltaLabel: 'this month',
        route: '/retailers',
      },
      {
        id: 'pending-payments',
        label: 'Pending Payments',
        value: payments.filter(
          (payment) =>
            payment.status === TransactionStatus.Pending || payment.status === TransactionStatus.Processing,
        ).length,
        icon: 'hourglass_top',
        tone: 'warning',
        delta: random.float(-18, 6, 1),
        deltaLabel: 'in queue',
        route: '/payment',
      },
      {
        id: 'failed-transactions',
        label: 'Failed Transactions',
        value: payments.filter((payment) => payment.status === TransactionStatus.Failed).length,
        icon: 'error',
        tone: 'danger',
        delta: random.float(-22, 8, 1),
        deltaLabel: 'last 24 hours',
        route: '/payment',
        hint: 'Gateway rejections and timeouts requiring investigation.',
      },
      {
        id: 'wallet-balance',
        label: 'Wallet Balance',
        value: sumBy(
          wallets.filter((wallet) => wallet.ownerType !== WalletOwnerType.System),
          (wallet) => wallet.balance,
        ),
        icon: 'account_balance_wallet',
        tone: 'primary',
        delta: random.float(-2, 9, 1),
        deltaLabel: 'held across the network',
        route: '/wallet',
      },
      {
        id: 'commission',
        label: 'Commission',
        value: commissionToday,
        icon: 'percent',
        tone: 'info',
        delta: random.float(-4, 13, 1),
        deltaLabel: 'accrued today',
        route: '/reports/commission',
      },
    ];

    return {
      metrics,
      salesTrend: this.buildSalesTrend(tickets, now),
      productMix: this.buildProductMix(tickets),
      channelSplit: this.buildChannelSplit(tickets),
      revenueVsPayout: this.buildRevenueVsPayout(draws, now),
      provinceSales: this.buildProvinceSales(tickets),
      recentWinners: this.buildRecentWinners(tickets),
      recentTickets: [...tickets]
        .sort((a, b) => Date.parse(b.purchasedAt) - Date.parse(a.purchasedAt))
        .slice(0, 8),
      latestTransactions: transactions.slice(0, 8),
      upcomingDraws: draws
        .filter((draw) => Date.parse(draw.scheduledAt) > now.getTime())
        .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))
        .slice(0, 4),
      announcements: mockDataset.announcements,
      health: mockDataset.systemHealth,
    };
  }

  /** 14-day sales/payout trend, bucketed by calendar day. */
  private buildSalesTrend(tickets: readonly Ticket[], now: Date): ChartSeriesData {
    const days = 14;
    const labels: string[] = [];
    const sales = new Array<number>(days).fill(0);
    const payouts = new Array<number>(days).fill(0);
    const startOfToday = new Date(now).setHours(0, 0, 0, 0);

    for (let index = days - 1; index >= 0; index--) {
      const date = new Date(startOfToday - index * DAY_MS);
      labels.push(date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
    }

    for (const ticket of tickets) {
      const bucket = Math.floor(
        (startOfToday - new Date(Date.parse(ticket.purchasedAt)).setHours(0, 0, 0, 0)) / DAY_MS,
      );
      const index = days - 1 - bucket;
      if (index >= 0 && index < days) {
        sales[index] = (sales[index] ?? 0) + ticket.totalStake;
        payouts[index] = (payouts[index] ?? 0) + ticket.totalPayout;
      }
    }

    return {
      labels,
      series: [
        { label: 'Sales', data: sales, fill: true },
        { label: 'Payouts', data: payouts, fill: true },
      ],
    };
  }

  private buildProductMix(tickets: readonly Ticket[]): ChartSeriesData {
    const totals = new Map<string, number>();
    for (const ticket of tickets) {
      totals.set(ticket.lotteryName, (totals.get(ticket.lotteryName) ?? 0) + ticket.totalStake);
    }
    const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return {
      labels: entries.map(([name]) => name),
      series: [{ label: 'Sales by product', data: entries.map(([, value]) => value) }],
    };
  }

  private buildChannelSplit(tickets: readonly Ticket[]): ChartSeriesData {
    const totals = new Map<string, number>();
    for (const ticket of tickets) {
      totals.set(ticket.channel, (totals.get(ticket.channel) ?? 0) + 1);
    }
    const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    return {
      labels: entries.map(([channel]) =>
        channel.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()),
      ),
      series: [{ label: 'Tickets by channel', data: entries.map(([, value]) => value) }],
    };
  }

  /** Monthly revenue against payout for the last six months. */
  private buildRevenueVsPayout(draws: readonly Draw[], now: Date): ChartSeriesData {
    const months = 6;
    const labels: string[] = [];
    const revenue = new Array<number>(months).fill(0);
    const payout = new Array<number>(months).fill(0);
    const commission = new Array<number>(months).fill(0);

    for (let index = months - 1; index >= 0; index--) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      labels.push(date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }));
    }

    for (const draw of draws) {
      const drawDate = new Date(draw.scheduledAt);
      const monthDiff =
        (now.getFullYear() - drawDate.getFullYear()) * 12 + (now.getMonth() - drawDate.getMonth());
      const index = months - 1 - monthDiff;
      if (index >= 0 && index < months) {
        revenue[index] = (revenue[index] ?? 0) + draw.salesAmount;
        payout[index] = (payout[index] ?? 0) + draw.payoutAmount;
        commission[index] = (commission[index] ?? 0) + draw.commissionPaid;
      }
    }

    return {
      labels,
      series: [
        { label: 'Sales', data: revenue, type: 'bar' },
        { label: 'Payouts', data: payout, type: 'bar' },
        { label: 'Commission', data: commission, type: 'line' },
      ],
    };
  }

  private buildProvinceSales(tickets: readonly Ticket[]): ChartSeriesData {
    const totals = new Map<string, number>();
    for (const ticket of tickets) {
      totals.set(ticket.province, (totals.get(ticket.province) ?? 0) + ticket.totalStake);
    }
    const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return {
      labels: entries.map(([province]) => province),
      series: [{ label: 'Sales by province', data: entries.map(([, value]) => value) }],
    };
  }

  private buildRecentWinners(tickets: readonly Ticket[]): WinnerSummary[] {
    return tickets
      .filter((ticket) => ticket.status === TicketStatus.Winning || ticket.status === TicketStatus.Claimed)
      .sort((a, b) => b.totalPayout - a.totalPayout)
      .slice(0, 6)
      .map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        customerName: ticket.customerName,
        customerAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(ticket.customerName)}`,
        lotteryName: ticket.lotteryName,
        drawCode: ticket.drawCode,
        tier: ticket.lines.find((line) => line.won)?.matchedTier ?? ticket.lines[0]?.matchedTier ?? 'FIRST',
        prizeAmount: ticket.totalPayout,
        province: ticket.province,
        wonAt: ticket.purchasedAt,
        claimStatus: ticket.claimStatus,
      })) as WinnerSummary[];
  }

  /** Counters used by the sidebar badges, refreshed alongside the dashboard. */
  counters(): Observable<Record<string, number>> {
    if (!environment.useMockData) {
      return this.liveCounters();
    }
    return this.load().pipe(
      map((snapshot) => {
        const byId = new Map(snapshot.metrics.map((metric) => [metric.id, metric.value]));
        return {
          pendingDraws: byId.get('pending-draws') ?? 0,
          failedPayments: byId.get('failed-transactions') ?? 0,
        };
      }),
    );
  }
  // =====================================================================================
  // Live API implementation
  // =====================================================================================

  private api(path: string): string {
    return `${environment.apiBaseUrl}/${path}`;
  }

  /** Sidebar badges: one light call, polled by the shell. */
  private liveCounters(): Observable<Record<string, number>> {
    return this.http
      .get<Record<string, number>>(this.api('admin/dashboard/pending'), { headers: { 'X-Quiet': '1' } })
      .pipe(
        map((pending) => ({
          pendingDraws: num(pending['drawsAwaitingVerification']) + num(pending['liveDraws']),
          liveDraw: num(pending['liveDraws']),
          pendingAgentApprovals: num(pending['agentApprovals']) + num(pending['retailerApprovals']),
          pendingKyc: num(pending['kycReviews']),
          failedPayments: num(pending['failedPaymentsToday']),
          pendingApprovals: num(pending['approvals']),
        })),
        catchError(() => of({})),
      );
  }

  private liveHealth(): Observable<SystemHealth> {
    const icons: Record<string, string> = { api: 'api', db: 'database', redis: 'memory', diskSpace: 'hard_drive', ping: 'network_ping' };
    const names: Record<string, string> = { api: 'API gateway', db: 'PostgreSQL', redis: 'Redis', diskSpace: 'Disk space', ping: 'Heartbeat' };
    const started = performance.now();
    return this.http
      .get<{ name: string; state: HealthState }[]>(this.api('admin/dashboard/health'), { headers: { 'X-Quiet': '1' } })
      .pipe(
        catchError(() => of([{ name: 'api', state: HealthState.Down }])),
        map((items) => {
          const latency = Math.round(performance.now() - started);
          const now = new Date().toISOString();
          const components = items
            .filter((item) => item.name !== 'ssl')
            .map((item) => ({
              id: item.name,
              name: names[item.name] ?? item.name,
              state: item.state,
              latencyMs: item.name === 'api' ? latency : 0,
              uptimePercent: item.state === HealthState.Healthy ? 100 : 0,
              message: item.state === HealthState.Healthy ? 'Operating normally' : 'Needs attention',
              icon: icons[item.name] ?? 'monitor_heart',
              lastCheckedAt: now,
              history: [],
            }));
          const overall = components.some((c) => c.state === HealthState.Down)
            ? HealthState.Down
            : components.some((c) => c.state !== HealthState.Healthy)
              ? HealthState.Degraded
              : HealthState.Healthy;
          return {
            overall,
            checkedAt: now,
            components,
            cpuPercent: 0,
            memoryPercent: 0,
            diskPercent: 0,
            activeSessions: 0,
            requestsPerMinute: 0,
            errorRatePercent: 0,
          };
        }),
      );
  }

  private liveLoad(): Observable<DashboardSnapshot> {
    type Row = Record<string, unknown>;
    return forkJoin({
      overview: this.http.get<Row>(this.api('admin/dashboard')),
      draws: this.http
        .get<{ content: Draw[] }>(this.api('admin/draws'), {
          params: { status: 'SCHEDULED,SALES_OPEN,SALES_CLOSED,DRAWING', sort: 'scheduledAt', direction: 'asc', size: '6' },
          headers: { 'X-Quiet': '1' },
        })
        .pipe(
          map((page) => page.content),
          catchError(() => of([] as Draw[])),
        ),
      announcements: this.http
        .get<Row[]>(this.api('public/content'), {
          // Returns announcements written for this language plus language-neutral ones.
          params: { type: 'ANNOUNCEMENT', audience: 'ADMIN', language: this.translation.current() },
          headers: { 'X-Quiet': '1' },
        })
        .pipe(catchError(() => of([] as Row[]))),
      health: this.liveHealth(),
    }).pipe(
      map(({ overview, draws, announcements, health }) => {
        const trend = (overview['salesTrend'] as Row[]) ?? [];
        const labels = trend.map((bucket) => String(bucket['label']).slice(5));
        const breakdown = (key: string, label: string, field: 'sales' | 'tickets'): ChartSeriesData => {
          const rows = (overview[key] as Row[]) ?? [];
          return {
            labels: rows.map((row) => String(row['key']).replace(/_/g, ' ')),
            series: [{ label, data: rows.map((row) => num(row[field])) }],
          };
        };
        return {
          metrics: ((overview['metrics'] as Row[]) ?? []).map((metric) => ({
            id: String(metric['id']).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
            label: String(metric['label']),
            value: num(metric['value']),
            unit: (metric['unit'] as string | undefined) ?? undefined,
            icon: String(metric['icon']),
            tone: metric['tone'] as StatMetric['tone'],
            delta: metric['delta'] === null || metric['delta'] === undefined ? undefined : num(metric['delta']),
            deltaLabel: metric['delta'] === null || metric['delta'] === undefined ? undefined : 'vs yesterday',
            trend: (metric['trend'] as TrendDirection | undefined) ?? TrendDirection.Flat,
            route: (metric['route'] as string | undefined) ?? undefined,
          })),
          salesTrend: {
            labels,
            series: [
              { label: 'Sales', data: trend.map((bucket) => num(bucket['sales'])), fill: true },
              { label: 'Payouts', data: trend.map((bucket) => num(bucket['prizes']) + num(bucket['tax'])), fill: true },
            ],
          },
          productMix: breakdown('salesByLottery', 'Sales by product', 'sales'),
          channelSplit: breakdown('salesByChannel', 'Tickets by channel', 'tickets'),
          revenueVsPayout: {
            labels,
            series: [
              { label: 'Sales', data: trend.map((bucket) => num(bucket['sales'])), type: 'bar' as const },
              { label: 'Payouts', data: trend.map((bucket) => num(bucket['prizes']) + num(bucket['tax'])), type: 'bar' as const },
              { label: 'Commission', data: trend.map((bucket) => num(bucket['commission'])), type: 'line' as const },
            ],
          },
          provinceSales: breakdown('salesByProvince', 'Sales by province', 'sales'),
          recentWinners: ((overview['recentWinners'] as Row[]) ?? []).map((winner) => ({
            id: String(winner['id']),
            ticketNumber: String(winner['ticketNumber']),
            customerName: String(winner['customerName'] ?? 'Walk-in customer'),
            customerAvatar: PLACEHOLDER.avatar(String(winner['customerName'] ?? 'Winner')),
            lotteryName: String(winner['lotteryName']),
            drawCode: String(winner['drawCode']),
            tier: 'FIRST',
            prizeAmount: num(winner['prizeAmount']),
            province: String(winner['province'] ?? ''),
            wonAt: String(winner['wonAt']),
            claimStatus: winner['claimStatus'],
          })) as WinnerSummary[],
          recentTickets: ((overview['recentTickets'] as Row[]) ?? []).map((ticket) => ({
            ...ticket,
            customerName: ticket['customerName'] ?? 'Walk-in customer',
            lines: [],
            drawCode: '',
          })) as unknown as Ticket[],
          latestTransactions: ((overview['latestTransactions'] as WalletTransaction[]) ?? []),
          upcomingDraws: draws.map((draw) => ({ ...draw, winningNumbers: draw.winningNumbers ?? [] })),
          announcements: announcements.map((item) => ({
            id: String(item['id']),
            title: String(item['title']),
            message: String(item['body'] ?? ''),
            severity: item['pinned'] ? Severity.Medium : Severity.Info,
            icon: 'campaign',
            link: (item['linkUrl'] as string | undefined) ?? undefined,
            linkLabel: item['linkUrl'] ? 'Open' : undefined,
            startsAt: String(item['startAt'] ?? item['createdAt']),
            endsAt: String(item['endAt'] ?? ''),
            dismissible: true,
            pinned: Boolean(item['pinned']),
          })),
          health,
        };
      }),
    );
  }
}
