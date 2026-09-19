import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '@env/environment';
import { num } from '@core/api/live.util';

import { ReportPeriod, TicketStatus, TransactionType } from '@core/enums';
import { mockDataset } from '@core/mock/dataset';
import type { ReportRequest, ReportResult } from '@core/models';
import { MockBackendService } from '@core/services/mock-backend.service';
import { groupBy, sumBy } from '@core/utilities/object.util';

/** Report definitions offered by the report centre. */
export interface ReportDefinition {
  key: string;
  title: string;
  description: string;
  icon: string;
  tone: string;
  permission: string;
  /** Default grouping when the operator opens the report. */
  defaultGroupBy: 'day' | 'month' | 'province' | 'product' | 'agent' | 'channel';
}

const DAY_MS = 86_400_000;

/**
 * Reporting service.
 *
 * Every report is computed from the shared dataset with the same grouping the
 * warehouse query would apply, and returns one {@link ReportResult} shape —
 * labels, series and rows — so a single report view renders all of them.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly backend = inject(MockBackendService);
  private readonly http = inject(HttpClient);

  readonly definitions: ReportDefinition[] = [
    {
      key: 'sales',
      title: 'Sales',
      description: 'Ticket sales volume and value, by period, product, channel or province.',
      icon: 'point_of_sale',
      tone: 'primary',
      permission: 'reports.sales',
      defaultGroupBy: 'day',
    },
    {
      key: 'revenue',
      title: 'Revenue & Profit',
      description: 'Sales less prize payouts and commission, showing gross margin by period.',
      icon: 'savings',
      tone: 'success',
      permission: 'reports.revenue',
      defaultGroupBy: 'month',
    },
    {
      key: 'commission',
      title: 'Commission',
      description: 'Commission accrued and paid across the agent and retailer network.',
      icon: 'percent',
      tone: 'info',
      permission: 'reports.commission',
      defaultGroupBy: 'agent',
    },
    {
      key: 'tax',
      title: 'Tax',
      description: 'Prize tax withheld, ready for submission to the revenue authority.',
      icon: 'request_quote',
      tone: 'warning',
      permission: 'reports.tax',
      defaultGroupBy: 'month',
    },
    {
      key: 'winners',
      title: 'Winners',
      description: 'Winning tickets, prize value and claim status by draw and province.',
      icon: 'military_tech',
      tone: 'success',
      permission: 'reports.winners',
      defaultGroupBy: 'province',
    },
    {
      key: 'channel',
      title: 'Channel Performance',
      description: 'How retail, POS, mobile, web and kiosk channels compare on volume and value.',
      icon: 'hub',
      tone: 'info',
      permission: 'reports.sales',
      defaultGroupBy: 'channel',
    },
  ];

  definition(key: string): ReportDefinition | undefined {
    return this.definitions.find((report) => report.key === key);
  }

  /** Runs a report and returns labels, series, rows, columns and totals. */
  run(request: ReportRequest): Observable<ReportResult> {
    if (!environment.useMockData) {
      return this.liveRun(request);
    }
    return this.backend.respond(() => this.build(request), { latencyMs: 480 });
  }

  private build(request: ReportRequest): ReportResult {
    switch (request.reportType) {
      case 'revenue':
        return this.revenueReport(request);
      case 'commission':
        return this.commissionReport(request);
      case 'tax':
        return this.taxReport(request);
      case 'winners':
        return this.winnersReport(request);
      case 'channel':
        return this.channelReport(request);
      default:
        return this.salesReport(request);
    }
  }

  /** Restricts a dataset to the requested period. */
  private withinPeriod(timestamp: string, request: ReportRequest): boolean {
    const time = Date.parse(timestamp);
    if (request.from && time < Date.parse(request.from)) {
      return false;
    }
    if (request.to && time > Date.parse(request.to) + DAY_MS - 1) {
      return false;
    }

    const now = Date.now();
    switch (request.period) {
      case ReportPeriod.Today:
        return time >= new Date().setHours(0, 0, 0, 0);
      case ReportPeriod.Weekly:
        return time >= now - 7 * DAY_MS;
      case ReportPeriod.Monthly:
        return time >= now - 30 * DAY_MS;
      case ReportPeriod.Quarterly:
        return time >= now - 90 * DAY_MS;
      case ReportPeriod.Yearly:
        return time >= now - 365 * DAY_MS;
      default:
        return true;
    }
  }

  private dayKey(timestamp: string): string {
    return new Date(timestamp).toISOString().slice(0, 10);
  }

  private monthKey(timestamp: string): string {
    return new Date(timestamp).toISOString().slice(0, 7);
  }

  // ------------------------------------------------------------------ sales

  private salesReport(request: ReportRequest): ReportResult {
    const tickets = mockDataset.tickets.filter(
      (ticket) =>
        this.withinPeriod(ticket.purchasedAt, request) &&
        (!request.lotteryId || ticket.lotteryId === request.lotteryId) &&
        (!request.province || ticket.province === request.province),
    );

    const grouped = groupBy(tickets, (ticket) => {
      switch (request.groupBy) {
        case 'province':
          return ticket.province;
        case 'product':
          return ticket.lotteryName;
        case 'channel':
          return ticket.channel;
        case 'month':
          return this.monthKey(ticket.purchasedAt);
        default:
          return this.dayKey(ticket.purchasedAt);
      }
    });

    const rows = [...grouped.entries()]
      .map(([key, group]) => ({
        group: key,
        tickets: group.length,
        stake: sumBy(group, (ticket) => ticket.totalStake),
        payout: sumBy(group, (ticket) => ticket.totalPayout),
        margin: sumBy(group, (ticket) => ticket.totalStake - ticket.totalPayout),
      }))
      .sort((a, b) => a.group.localeCompare(b.group));

    return {
      reportType: 'sales',
      title: 'Sales Report',
      generatedAt: new Date().toISOString(),
      period: this.periodLabel(request),
      labels: rows.map((row) => row.group),
      series: [
        { label: 'Stake', data: rows.map((row) => row.stake) },
        { label: 'Payout', data: rows.map((row) => row.payout) },
      ],
      rows,
      columns: [
        { key: 'group', label: 'Group', type: 'text' },
        { key: 'tickets', label: 'Tickets', type: 'number' },
        { key: 'stake', label: 'Stake', type: 'currency' },
        { key: 'payout', label: 'Payout', type: 'currency' },
        { key: 'margin', label: 'Margin', type: 'currency' },
      ],
      totals: {
        tickets: sumBy(rows, (row) => row.tickets),
        stake: sumBy(rows, (row) => row.stake),
        payout: sumBy(rows, (row) => row.payout),
        margin: sumBy(rows, (row) => row.margin),
      },
    };
  }

  // ---------------------------------------------------------------- revenue

  private revenueReport(request: ReportRequest): ReportResult {
    const draws = mockDataset.draws.filter((draw) => this.withinPeriod(draw.scheduledAt, request));
    const grouped = groupBy(draws, (draw) =>
      request.groupBy === 'product' ? draw.lotteryName : this.monthKey(draw.scheduledAt),
    );

    const rows = [...grouped.entries()]
      .map(([key, group]) => {
        const sales = sumBy(group, (draw) => draw.salesAmount);
        const payout = sumBy(group, (draw) => draw.payoutAmount);
        const commission = sumBy(group, (draw) => draw.commissionPaid);
        const tax = sumBy(group, (draw) => draw.taxCollected);
        const profit = sales - payout - commission;
        return {
          group: key,
          draws: group.length,
          sales,
          payout,
          commission,
          tax,
          profit,
          margin: sales === 0 ? 0 : Math.round((profit / sales) * 1000) / 10,
        };
      })
      .sort((a, b) => a.group.localeCompare(b.group));

    return {
      reportType: 'revenue',
      title: 'Revenue & Profit Report',
      generatedAt: new Date().toISOString(),
      period: this.periodLabel(request),
      labels: rows.map((row) => row.group),
      series: [
        { label: 'Sales', data: rows.map((row) => row.sales) },
        { label: 'Payout', data: rows.map((row) => row.payout) },
        { label: 'Gross profit', data: rows.map((row) => row.profit) },
      ],
      rows,
      columns: [
        { key: 'group', label: 'Period', type: 'text' },
        { key: 'draws', label: 'Draws', type: 'number' },
        { key: 'sales', label: 'Sales', type: 'currency' },
        { key: 'payout', label: 'Payout', type: 'currency' },
        { key: 'commission', label: 'Commission', type: 'currency' },
        { key: 'tax', label: 'Tax', type: 'currency' },
        { key: 'profit', label: 'Gross profit', type: 'currency' },
        { key: 'margin', label: 'Margin', type: 'percent' },
      ],
      totals: {
        draws: sumBy(rows, (row) => row.draws),
        sales: sumBy(rows, (row) => row.sales),
        payout: sumBy(rows, (row) => row.payout),
        commission: sumBy(rows, (row) => row.commission),
        tax: sumBy(rows, (row) => row.tax),
        profit: sumBy(rows, (row) => row.profit),
      },
    };
  }

  // ------------------------------------------------------------- commission

  private commissionReport(request: ReportRequest): ReportResult {
    const agents = mockDataset.agents.filter(
      (agent) => !request.province || agent.province === request.province,
    );

    const rows = agents
      .map((agent) => ({
        group: agent.name,
        code: agent.code,
        tier: agent.tier,
        province: agent.province,
        sales: agent.performance.salesAmount,
        commission: agent.performance.commissionEarned,
        rate:
          agent.performance.salesAmount === 0
            ? 0
            : Math.round((agent.performance.commissionEarned / agent.performance.salesAmount) * 1000) / 10,
        retailers: agent.retailerCount,
      }))
      .sort((a, b) => b.commission - a.commission)
      .slice(0, 40);

    return {
      reportType: 'commission',
      title: 'Commission Report',
      generatedAt: new Date().toISOString(),
      period: this.periodLabel(request),
      labels: rows.slice(0, 15).map((row) => row.group),
      series: [{ label: 'Commission', data: rows.slice(0, 15).map((row) => row.commission) }],
      rows,
      columns: [
        { key: 'group', label: 'Agent', type: 'text' },
        { key: 'code', label: 'Code', type: 'text' },
        { key: 'tier', label: 'Tier', type: 'text' },
        { key: 'province', label: 'Province', type: 'text' },
        { key: 'retailers', label: 'Retailers', type: 'number' },
        { key: 'sales', label: 'Sales', type: 'currency' },
        { key: 'commission', label: 'Commission', type: 'currency' },
        { key: 'rate', label: 'Effective rate', type: 'percent' },
      ],
      totals: {
        sales: sumBy(rows, (row) => row.sales),
        commission: sumBy(rows, (row) => row.commission),
        retailers: sumBy(rows, (row) => row.retailers),
      },
    };
  }

  // -------------------------------------------------------------------- tax

  private taxReport(request: ReportRequest): ReportResult {
    const draws = mockDataset.draws.filter((draw) => this.withinPeriod(draw.scheduledAt, request));
    const grouped = groupBy(draws, (draw) => this.monthKey(draw.scheduledAt));

    const rows = [...grouped.entries()]
      .map(([key, group]) => ({
        group: key,
        payout: sumBy(group, (draw) => draw.payoutAmount),
        tax: sumBy(group, (draw) => draw.taxCollected),
        winners: sumBy(group, (draw) => draw.winnerCount),
        effectiveRate:
          sumBy(group, (draw) => draw.payoutAmount) === 0
            ? 0
            : Math.round(
                (sumBy(group, (draw) => draw.taxCollected) / sumBy(group, (draw) => draw.payoutAmount)) *
                  1000,
              ) / 10,
      }))
      .sort((a, b) => a.group.localeCompare(b.group));

    return {
      reportType: 'tax',
      title: 'Tax Report',
      generatedAt: new Date().toISOString(),
      period: this.periodLabel(request),
      labels: rows.map((row) => row.group),
      series: [{ label: 'Tax withheld', data: rows.map((row) => row.tax) }],
      rows,
      columns: [
        { key: 'group', label: 'Period', type: 'text' },
        { key: 'winners', label: 'Winners', type: 'number' },
        { key: 'payout', label: 'Gross payout', type: 'currency' },
        { key: 'tax', label: 'Tax withheld', type: 'currency' },
        { key: 'effectiveRate', label: 'Effective rate', type: 'percent' },
      ],
      totals: {
        winners: sumBy(rows, (row) => row.winners),
        payout: sumBy(rows, (row) => row.payout),
        tax: sumBy(rows, (row) => row.tax),
      },
    };
  }

  // ---------------------------------------------------------------- winners

  private winnersReport(request: ReportRequest): ReportResult {
    const winners = mockDataset.tickets.filter(
      (ticket) =>
        (ticket.status === TicketStatus.Winning || ticket.status === TicketStatus.Claimed) &&
        this.withinPeriod(ticket.purchasedAt, request) &&
        (!request.province || ticket.province === request.province),
    );

    const grouped = groupBy(winners, (ticket) =>
      request.groupBy === 'product' ? ticket.lotteryName : ticket.province,
    );

    const rows = [...grouped.entries()]
      .map(([key, group]) => ({
        group: key,
        winners: group.length,
        gross: sumBy(group, (ticket) => ticket.totalPayout),
        tax: sumBy(group, (ticket) => ticket.taxDeducted),
        net: sumBy(group, (ticket) => ticket.netPayout),
        claimed: group.filter((ticket) => ticket.status === TicketStatus.Claimed).length,
      }))
      .sort((a, b) => b.gross - a.gross);

    return {
      reportType: 'winners',
      title: 'Winners Report',
      generatedAt: new Date().toISOString(),
      period: this.periodLabel(request),
      labels: rows.map((row) => row.group),
      series: [
        { label: 'Gross prize', data: rows.map((row) => row.gross) },
        { label: 'Net paid', data: rows.map((row) => row.net) },
      ],
      rows,
      columns: [
        { key: 'group', label: 'Group', type: 'text' },
        { key: 'winners', label: 'Winning tickets', type: 'number' },
        { key: 'claimed', label: 'Claimed', type: 'number' },
        { key: 'gross', label: 'Gross prize', type: 'currency' },
        { key: 'tax', label: 'Tax withheld', type: 'currency' },
        { key: 'net', label: 'Net paid', type: 'currency' },
      ],
      totals: {
        winners: sumBy(rows, (row) => row.winners),
        claimed: sumBy(rows, (row) => row.claimed),
        gross: sumBy(rows, (row) => row.gross),
        tax: sumBy(rows, (row) => row.tax),
        net: sumBy(rows, (row) => row.net),
      },
    };
  }

  // ---------------------------------------------------------------- channel

  private channelReport(request: ReportRequest): ReportResult {
    const tickets = mockDataset.tickets.filter((ticket) => this.withinPeriod(ticket.purchasedAt, request));
    const grouped = groupBy(tickets, (ticket) => ticket.channel);

    const rows = [...grouped.entries()]
      .map(([key, group]) => ({
        group: key.replace(/_/g, ' '),
        tickets: group.length,
        stake: sumBy(group, (ticket) => ticket.totalStake),
        averageStake: Math.round(sumBy(group, (ticket) => ticket.totalStake) / (group.length || 1)),
        payout: sumBy(group, (ticket) => ticket.totalPayout),
      }))
      .sort((a, b) => b.stake - a.stake);

    return {
      reportType: 'channel',
      title: 'Channel Performance Report',
      generatedAt: new Date().toISOString(),
      period: this.periodLabel(request),
      labels: rows.map((row) => row.group),
      series: [{ label: 'Stake', data: rows.map((row) => row.stake) }],
      rows,
      columns: [
        { key: 'group', label: 'Channel', type: 'text' },
        { key: 'tickets', label: 'Tickets', type: 'number' },
        { key: 'stake', label: 'Stake', type: 'currency' },
        { key: 'averageStake', label: 'Average stake', type: 'currency' },
        { key: 'payout', label: 'Payout', type: 'currency' },
      ],
      totals: {
        tickets: sumBy(rows, (row) => row.tickets),
        stake: sumBy(rows, (row) => row.stake),
        payout: sumBy(rows, (row) => row.payout),
      },
    };
  }

  private periodLabel(request: ReportRequest): string {
    if (request.from || request.to) {
      return `${request.from ?? 'start'} → ${request.to ?? 'today'}`;
    }
    switch (request.period) {
      case ReportPeriod.Today:
        return 'Today';
      case ReportPeriod.Weekly:
        return 'Last 7 days';
      case ReportPeriod.Monthly:
        return 'Last 30 days';
      case ReportPeriod.Quarterly:
        return 'Last 90 days';
      case ReportPeriod.Yearly:
        return 'Last 12 months';
      default:
        return 'All time';
    }
  }

  /** Headline figures for the report centre cards. */
  headlines(): Observable<Record<string, number>> {
    if (!environment.useMockData) {
      return this.liveHeadlines();
    }
    return this.backend.respond(() => {
      const tickets = mockDataset.tickets;
      const draws = mockDataset.draws;
      return {
        sales: sumBy(tickets, (ticket) => ticket.totalStake),
        revenue: sumBy(draws, (draw) => draw.salesAmount - draw.payoutAmount),
        commission: sumBy(
          mockDataset.walletTransactions.filter((entry) => entry.type === TransactionType.Commission),
          (entry) => entry.amount,
        ),
        tax: sumBy(draws, (draw) => draw.taxCollected),
        winners: tickets.filter(
          (ticket) => ticket.status === TicketStatus.Winning || ticket.status === TicketStatus.Claimed,
        ).length,
        channel: tickets.length,
      };
    });
  }
  // =====================================================================================
  // Live API implementation — one endpoint (`/admin/reports`) feeds every report type
  // =====================================================================================

  private liveFetch(request: Pick<ReportRequest, 'period' | 'from' | 'to'>): Observable<LiveReport> {
    const params: Record<string, string> = { period: request.from ? 'CUSTOM' : request.period };
    if (request.from) {
      params['from'] = request.from.slice(0, 10);
    }
    if (request.to) {
      params['to'] = request.to.slice(0, 10);
    }
    return this.http.get<LiveReport>(`${environment.apiBaseUrl}/admin/reports`, { params });
  }

  private liveHeadlines(): Observable<Record<string, number>> {
    return this.liveFetch({ period: ReportPeriod.Monthly }).pipe(
      map((report) => ({
        sales: num(report.totals.sales),
        revenue: num(report.totals.profit),
        commission: num(report.totals.commission),
        tax: num(report.totals.tax),
        winners: num(report.totals.winners),
        channel: num(report.totals.tickets),
      })),
    );
  }

  private liveRun(request: ReportRequest): Observable<ReportResult> {
    return this.liveFetch(request).pipe(
      map((report) => {
        const definition = this.definition(request.reportType);
        const groupBy = request.groupBy ?? definition?.defaultGroupBy ?? 'day';
        const breakdown =
          groupBy === 'product'
            ? report.byLottery
            : groupBy === 'channel' || request.reportType === 'channel'
              ? report.byChannel
              : groupBy === 'province'
                ? report.byProvince
                : null;

        type Column = ReportResult['columns'][number];
        const period: Column = { key: 'group', label: breakdown ? 'Group' : 'Period', type: 'text' };
        let columns: Column[];
        let rows: Record<string, string | number>[];

        if (breakdown) {
          columns = [
            period,
            { key: 'tickets', label: 'Tickets', type: 'number' },
            { key: 'sales', label: 'Sales', type: 'currency' },
            { key: 'share', label: 'Share', type: 'percent' },
          ];
          const total = breakdown.reduce((sum, row) => sum + num(row.sales), 0) || 1;
          rows = breakdown.map((row) => ({
            group: String(row.key).replace(/_/g, ' '),
            tickets: num(row.tickets),
            sales: num(row.sales),
            share: Math.round((num(row.sales) / total) * 1000) / 10,
          }));
        } else {
          const money = (key: string, label: string): Column => ({ key, label, type: 'currency' });
          const byType: Record<string, Column[]> = {
            sales: [{ key: 'tickets', label: 'Tickets', type: 'number' }, money('sales', 'Sales')],
            revenue: [money('sales', 'Sales'), money('prizes', 'Prizes (net)'), money('commission', 'Commission'), money('profit', 'Profit')],
            commission: [money('sales', 'Sales'), money('commission', 'Commission')],
            tax: [money('prizes', 'Prizes (net)'), money('tax', 'Tax withheld')],
            winners: [{ key: 'winners', label: 'Winners', type: 'number' }, money('prizes', 'Prizes (net)'), money('tax', 'Tax withheld')],
          };
          columns = [period, ...(byType[request.reportType] ?? byType['sales'] ?? [])];
          rows = report.series.map((bucket) => ({
            group: bucket.label,
            tickets: num(bucket.tickets),
            sales: num(bucket.sales),
            winners: num(bucket.winners),
            prizes: num(bucket.prizes),
            tax: num(bucket.tax),
            commission: num(bucket.commission),
            profit: num(bucket.profit),
          }));
        }

        const numeric = columns.filter((column) => column.type === 'currency' || column.type === 'number');
        const totals: Record<string, number> = {};
        numeric.forEach((column) => (totals[column.key] = rows.reduce((sum, row) => sum + num(row[column.key]), 0)));

        return {
          reportType: request.reportType,
          title: `${definition?.title ?? 'Sales'} Report`,
          generatedAt: new Date().toISOString(),
          period: `${report.from} → ${report.to}`,
          labels: rows.map((row) => String(row['group'])),
          series: numeric
            .filter((column) => column.type === 'currency')
            .slice(0, 3)
            .map((column) => ({ label: column.label, data: rows.map((row) => num(row[column.key])) })),
          rows,
          columns,
          totals,
        };
      }),
    );
  }
}

interface LiveBucket {
  label: string;
  tickets: number;
  sales: number;
  winners: number;
  prizes: number;
  tax: number;
  commission: number;
  profit: number;
}

interface LiveReport {
  from: string;
  to: string;
  totals: LiveBucket;
  series: LiveBucket[];
  byLottery: { key: string; tickets: number; sales: number }[];
  byChannel: { key: string; tickets: number; sales: number }[];
  byProvince: { key: string; tickets: number; sales: number }[];
}
