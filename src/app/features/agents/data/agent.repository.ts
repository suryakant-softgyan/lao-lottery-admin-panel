import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';

import { auditToTimeline, num, type ApiAuditEntry } from '@core/api/live.util';
import { PLACEHOLDER } from '@core/constants/app.constants';

import { AgentStatus, AgentTier, CommissionModel, KycStatus } from '@core/enums';
import { mockDataset } from '@core/mock/dataset';
import type {
  Agent,
  CommissionRule,
  Page,
  PageQuery,
  Retailer,
  StatMetric,
  TimelineEvent,
} from '@core/models';
import { BaseRepository } from '@core/services/base-repository';
import { applyQuery } from '@core/utilities/query.util';
import { sumBy } from '@core/utilities/object.util';

/** Agent network repository: hierarchy, approvals, commission and settlement. */
@Injectable({ providedIn: 'root' })
export class AgentRepository extends BaseRepository<Agent> {
  protected readonly resourcePath = 'agents';

  protected override queryOptions = {
    searchFields: ['name', 'code', 'businessName', 'contact.phone', 'contact.email', 'province', 'territory'],
    dateField: 'createdAt',
  };

  protected seed(): Agent[] {
    return mockDataset.agents;
  }

  /** Agents awaiting a KYC/onboarding decision. */
  approvalQueue(query: PageQuery): Observable<Page<Agent>> {
    if (this.live) {
      return this.withStats(() => this.livePage(this.livePath, query, (row) => this.fromApi(row), { status: "PENDING_APPROVAL" }));
    }
    const pending = this.records.filter((agent) => agent.status === AgentStatus.PendingApproval);
    return this.backend.respond(() => applyQuery(pending, query, this.queryOptions));
  }

  approve(id: string, remarks?: string): Observable<Agent> {
    if (this.live) {
      return this.liveDecision(id, true, remarks);
    }
    return this.patch(id, {
      status: AgentStatus.Active,
      kycStatus: KycStatus.Approved,
      notes: remarks,
    } as Partial<Agent>);
  }

  reject(id: string, reason: string): Observable<Agent> {
    if (this.live) {
      return this.liveDecision(id, false, reason);
    }
    return this.patch(id, {
      status: AgentStatus.Inactive,
      kycStatus: KycStatus.Rejected,
      notes: reason,
    } as Partial<Agent>);
  }

  suspend(id: string, reason: string): Observable<Agent> {
    if (this.live) {
      return this.liveStatus(id, AgentStatus.Suspended, reason);
    }
    return this.patch(id, { status: AgentStatus.Suspended, suspendedReason: reason } as Partial<Agent>);
  }

  block(id: string, reason: string): Observable<Agent> {
    if (this.live) {
      return this.liveStatus(id, AgentStatus.Blocked, reason);
    }
    return this.patch(id, { status: AgentStatus.Blocked, blockedReason: reason } as Partial<Agent>);
  }

  reactivate(id: string): Observable<Agent> {
    if (this.live) {
      return this.liveStatus(id, AgentStatus.Active, "Reactivated from the admin portal");
    }
    return this.patch(id, {
      status: AgentStatus.Active,
      suspendedReason: undefined,
      blockedReason: undefined,
    } as Partial<Agent>);
  }

  /** Retailers reporting to an agent — shown on the detail page. */
  retailersOf(agentId: string): Observable<Retailer[]> {
    if (this.live) {
      return this.liveRetailersOf(agentId);
    }
    return this.backend.respond(() =>
      mockDataset.retailers.filter((retailer) => retailer.agentId === agentId),
    );
  }

  /** Direct children in the agent hierarchy. */
  childrenOf(agentId: string): Observable<Agent[]> {
    if (this.live) {
      return this.livePage(this.livePath, { page: 0, size: 200 }, (row) => this.fromApi(row), { parentAgentId: agentId }).pipe(map((page) => page.content));
    }
    return this.backend.respond(() => this.records.filter((agent) => agent.parentAgentId === agentId));
  }

  /** Every commission rule across the network, for the plans screen. */
  commissionPlans(query: PageQuery): Observable<Page<CommissionPlanRow>> {
    if (this.live) {
      return this.liveCommissionPlans(query);
    }
    const rows: CommissionPlanRow[] = this.records.flatMap((agent) =>
      agent.commissionRules.map((rule) => ({
        ...rule,
        // Composite key: a rule id is only unique within its agent.
        id: `${agent.id}:${rule.id}`,
        agentId: agent.id,
        agentName: agent.name,
        agentCode: agent.code,
        tier: agent.tier,
        province: agent.province,
      })),
    );
    return this.backend.respond(() =>
      applyQuery(rows, query, {
        searchFields: ['agentName', 'agentCode', 'lotteryType', 'province'],
        dateField: 'effectiveFrom',
      }),
    );
  }

  updateCommissionRule(agentId: string, rule: CommissionRule): Observable<Agent> {
    if (this.live) {
      return this.liveUpdateCommission(agentId, rule);
    }
    const agent = this.records.find((item) => item.id === agentId);
    if (!agent) {
      return this.backend.notFound<Agent>('Agent', agentId);
    }
    return this.patch(agentId, {
      commissionRules: agent.commissionRules.map((existing) => (existing.id === rule.id ? rule : existing)),
    } as Partial<Agent>);
  }

  /** League table used by the performance screen. */
  leaderboard(query: PageQuery): Observable<Page<Agent>> {
    if (this.live) {
      return this.liveLeaderboard(query);
    }
    const ranked = [...this.records].sort((a, b) => b.performance.salesAmount - a.performance.salesAmount);
    return this.backend.respond(() => applyQuery(ranked, query, this.queryOptions));
  }

  /** Summary tiles for the list page. */
  statistics(): Observable<StatMetric[]> {
    if (this.live) {
      return this.liveStatistics();
    }
    return this.backend.respond(() => {
      const agents = this.records;
      const active = agents.filter((agent) => agent.status === AgentStatus.Active);
      const byTier = (tier: AgentTier): number => agents.filter((agent) => agent.tier === tier).length;

      return [
        {
          id: 'total',
          label: 'Total agents',
          value: agents.length,
          icon: 'handshake',
          tone: 'primary',
        },
        {
          id: 'active',
          label: 'Active',
          value: active.length,
          icon: 'check_circle',
          tone: 'success',
        },
        {
          id: 'pending',
          label: 'Pending approval',
          value: agents.filter((agent) => agent.status === AgentStatus.PendingApproval).length,
          icon: 'pending',
          tone: 'warning',
        },
        {
          id: 'master',
          label: 'Master agents',
          value: byTier(AgentTier.Master),
          icon: 'workspace_premium',
          tone: 'info',
        },
        {
          id: 'sales',
          label: 'Network sales',
          value: sumBy(agents, (agent) => agent.performance.salesAmount),
          icon: 'payments',
          tone: 'primary',
        },
        {
          id: 'commission',
          label: 'Commission earned',
          value: sumBy(agents, (agent) => agent.performance.commissionEarned),
          icon: 'percent',
          tone: 'success',
        },
      ];
    });
  }

  /** Timeline for the agent detail page. */
  timeline(agent: Agent): Observable<TimelineEvent[]> {
    if (this.live) {
      return this.liveTimeline(agent);
    }
    return this.backend.respond(() => {
      const events: TimelineEvent[] = [
        {
          id: 'created',
          title: 'Agent onboarded',
          description: `${agent.name} joined as a ${agent.tier.toLowerCase()} agent for ${agent.territory}.`,
          actor: agent.createdBy ?? 'System',
          timestamp: agent.createdAt,
          icon: 'person_add',
          tone: 'success',
        },
        {
          id: 'contract',
          title: 'Contract activated',
          description: `Contract effective from ${agent.contractStartDate}.`,
          actor: 'Legal & Compliance',
          timestamp: agent.contractStartDate,
          icon: 'gavel',
          tone: 'primary',
          meta: { Territory: agent.territory },
        },
        {
          id: 'kyc',
          title: `KYC ${agent.kycStatus.toLowerCase()}`,
          description: `${agent.documents.length} document(s) on file.`,
          actor: 'Compliance Desk',
          timestamp: agent.updatedAt ?? agent.createdAt,
          icon: 'verified_user',
          tone: agent.kycStatus === KycStatus.Approved ? 'success' : 'warning',
        },
      ];

      if (agent.suspendedReason) {
        events.push({
          id: 'suspended',
          title: 'Account suspended',
          description: agent.suspendedReason,
          actor: 'Risk & Compliance',
          timestamp: agent.updatedAt ?? agent.createdAt,
          icon: 'pause_circle',
          tone: 'warning',
        });
      }
      if (agent.blockedReason) {
        events.push({
          id: 'blocked',
          title: 'Account blocked',
          description: agent.blockedReason,
          actor: 'Risk & Compliance',
          timestamp: agent.updatedAt ?? agent.createdAt,
          icon: 'block',
          tone: 'danger',
        });
      }

      return events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    });
  }
  // =====================================================================================
  // Live API implementation
  // =====================================================================================

  private liveStats: Record<string, Record<string, number>> = {};

  private withStats<R>(source: () => Observable<R>): Observable<R> {
    return this.http
      .get<{ agents?: Record<string, number | string>[] }>(this.api('admin/stats/network'), {
        headers: { 'X-Quiet': '1' },
      })
      .pipe(
        catchError(() => of({ agents: [] as Record<string, number | string>[] })),
        tap((stats) => {
          this.liveStats = {};
          (stats.agents ?? []).forEach((row) => (this.liveStats[String(row['agentId'])] = row as Record<string, number>));
        }),
        switchMap(() => source()),
      );
  }

  override list(query: PageQuery): Observable<Page<Agent>> {
    return this.live ? this.withStats(() => super.list(query)) : super.list(query);
  }

  override all(): Observable<Agent[]> {
    return this.live ? this.withStats(() => super.all()) : super.all();
  }

  protected override fromApi(record: unknown): Agent {
    const api = record as Record<string, unknown>;
    const stats = this.liveStats[String(api['id'])] ?? {};
    const name = String(api['name'] ?? '');
    const rate = num(api['commissionPercent']);
    const sales = num(stats['salesAmount']);
    return {
      id: String(api['id']),
      code: String(api['code'] ?? ''),
      name,
      businessName: String(api['businessName'] ?? name),
      tier: api['tier'] as Agent['tier'],
      parentAgentId: (api['parentAgentId'] as string | undefined) ?? undefined,
      parentAgentName: this.records.find((agent) => agent.id === api['parentAgentId'])?.name,
      status: api['status'] as Agent['status'],
      kycStatus: api['kycStatus'] as Agent['kycStatus'],
      userId: String(api['userId'] ?? ''),
      contact: { phone: String(api['phone'] ?? ''), email: String(api['email'] ?? '') },
      address: {
        line1: String(api['address'] ?? ''),
        district: String(api['district'] ?? ''),
        province: String(api['province'] ?? ''),
        country: 'Lao PDR',
      },
      province: String(api['province'] ?? ''),
      district: String(api['district'] ?? ''),
      territory: String(api['province'] ?? ''),
      walletId: '',
      walletBalance: num(api['walletBalance']),
      creditLimit: 0,
      outstandingBalance: 0,
      commissionRules: [
        {
          id: 'default',
          lotteryType: 'ALL',
          model: CommissionModel.Percentage,
          rate,
          flatAmount: 0,
          effectiveFrom: String(api['contractStart'] ?? api['createdAt'] ?? ''),
          active: true,
        },
      ],
      performance: {
        ticketsSold: num(stats['ticketsSold']),
        salesAmount: sales,
        commissionEarned: num(stats['commissionEarned']),
        activeRetailers: num(api['retailerCount']),
        winningTickets: num(stats['winningTickets']),
        payoutAmount: num(stats['payoutAmount']),
        targetAmount: 0,
        achievementPercent: 0,
        rank: 0,
        monthlyTrend: [],
      },
      documents: [],
      contractStartDate: String(api['contractStart'] ?? ''),
      contractEndDate: (api['contractEnd'] as string | undefined) ?? undefined,
      taxId: (api['taxId'] as string | undefined) ?? undefined,
      bankAccountNumber: (api['bankAccountNumber'] as string | undefined) ?? undefined,
      bankName: (api['bankName'] as string | undefined) ?? undefined,
      retailerCount: num(api['retailerCount']),
      deviceCount: 0,
      suspendedReason: api['status'] === AgentStatus.Suspended ? (api['statusReason'] as string) : undefined,
      blockedReason: api['status'] === AgentStatus.Blocked ? (api['statusReason'] as string) : undefined,
      avatarUrl: PLACEHOLDER.avatar(name),
      tenantId: '',
      notes: (api['statusReason'] as string | undefined) ?? undefined,
      createdAt: String(api['createdAt'] ?? ''),
      createdBy: (api['createdBy'] as string | undefined) ?? undefined,
      updatedAt: (api['updatedAt'] as string | undefined) ?? undefined,
    };
  }

  protected override toApi(payload: Partial<Agent>): unknown {
    return {
      name: payload.name,
      businessName: payload.businessName,
      tier: payload.tier,
      parentAgentId: payload.parentAgentId || null,
      phone: (payload.contact?.phone ?? '').replace(/[\s-]/g, ''),
      email: payload.contact?.email || null,
      province: payload.province ?? payload.address?.province,
      district: payload.district ?? payload.address?.district,
      address: payload.address?.line1,
      commissionPercent: payload.commissionRules?.[0]?.rate,
      bankName: payload.bankName,
      bankAccountNumber: payload.bankAccountNumber,
      taxId: payload.taxId,
      contractStart: payload.contractStartDate ? payload.contractStartDate.slice(0, 10) : null,
      contractEnd: payload.contractEndDate ? payload.contractEndDate.slice(0, 10) : null,
    };
  }

  /** Creating an agent answers with `{ entity, username, temporaryPassword }`. */
  override create(payload: Partial<Agent>): Observable<Agent> {
    if (!this.live) {
      return super.create(payload);
    }
    return this.http
      .post<{ entity: unknown }>(this.baseUrl, this.toApi(payload))
      .pipe(map((result) => this.fromApi(result.entity)));
  }

  private liveDecision(id: string, approved: boolean, remarks?: string): Observable<Agent> {
    return this.http
      .post<unknown>(`${this.baseUrl}/${id}/approval`, { approved, remarks })
      .pipe(map((row) => this.fromApi(row)));
  }

  private liveStatus(id: string, status: AgentStatus, reason?: string): Observable<Agent> {
    return this.http
      .patch<unknown>(`${this.baseUrl}/${id}/status`, { status, reason })
      .pipe(map((row) => this.fromApi(row)));
  }

  protected override livePatch(id: string, changes: Partial<Agent>): Observable<Agent> {
    if (changes.status) {
      return this.liveStatus(id, changes.status, changes.suspendedReason ?? changes.blockedReason ?? changes.notes);
    }
    return this.getById(id).pipe(switchMap((agent) => this.update(id, { ...agent, ...changes })));
  }

  private liveRetailersOf(agentId: string): Observable<Retailer[]> {
    return this.http
      .get<Page<Record<string, unknown>>>(this.api('admin/retailers'), { params: { agentId, page: '0', size: '200' } })
      .pipe(
        map((page) =>
          page.content.map(
            (row) =>
              ({
                ...row,
                contact: { phone: row['phone'], email: row['email'] ?? '' },
                address: { line1: row['address'] ?? '', district: row['district'] ?? '', province: row['province'] ?? '', country: 'Lao PDR' },
                commissionRate: num(row['commissionPercent']),
                devices: [],
                ticketsToday: 0,
                salesToday: 0,
                salesMonth: 0,
                rating: 0,
                photoUrl: PLACEHOLDER.avatar(String(row['shopName'] ?? '')),
              }) as unknown as Retailer,
          ),
        ),
      );
  }

  private liveCommissionPlans(query: PageQuery): Observable<Page<CommissionPlanRow>> {
    return this.all().pipe(
      map((agents) =>
        applyQuery(
          agents.flatMap((agent) =>
            agent.commissionRules.map((rule) => ({
              ...rule,
              id: `${agent.id}:${rule.id}`,
              agentId: agent.id,
              agentName: agent.name,
              agentCode: agent.code,
              tier: agent.tier,
              province: agent.province,
            })),
          ),
          query,
          { searchFields: ['agentName', 'agentCode', 'lotteryType', 'province'], dateField: 'effectiveFrom' },
        ),
      ),
    );
  }

  /** The API keeps one override rate per agent (falls back to the game's agent commission). */
  private liveUpdateCommission(agentId: string, rule: CommissionRule): Observable<Agent> {
    return this.getById(agentId).pipe(
      switchMap((agent) => this.update(agentId, { ...agent, commissionRules: [{ ...rule, id: 'default' }] })),
    );
  }

  private liveLeaderboard(query: PageQuery): Observable<Page<Agent>> {
    return this.all().pipe(
      map((agents) => {
        const ranked = [...agents]
          .sort((a, b) => b.performance.salesAmount - a.performance.salesAmount)
          .map((agent, index) => ({ ...agent, performance: { ...agent.performance, rank: index + 1 } }));
        return applyQuery(ranked, query, this.queryOptions);
      }),
    );
  }

  private liveStatistics(): Observable<StatMetric[]> {
    return this.all().pipe(
      map((agents) => [
        { id: 'total', label: 'Total agents', value: agents.length, icon: 'support_agent', tone: 'primary' as const },
        { id: 'active', label: 'Active', value: agents.filter((a) => a.status === AgentStatus.Active).length, icon: 'check_circle', tone: 'success' as const },
        { id: 'pending', label: 'Pending approval', value: agents.filter((a) => a.status === AgentStatus.PendingApproval).length, icon: 'hourglass_top', tone: 'warning' as const },
        { id: 'master', label: 'Master agents', value: agents.filter((a) => a.tier === AgentTier.Master).length, icon: 'workspace_premium', tone: 'info' as const },
        { id: 'sales', label: 'Network sales', value: sumBy(agents, (a) => a.performance.salesAmount), icon: 'payments', tone: 'primary' as const },
        { id: 'commission', label: 'Commission earned', value: sumBy(agents, (a) => a.performance.commissionEarned), icon: 'percent', tone: 'success' as const },
      ]),
    );
  }

  private liveTimeline(agent: Agent): Observable<TimelineEvent[]> {
    return this.http
      .get<ApiAuditEntry[]>(this.api('admin/audit/timeline'), {
        params: { entityType: 'Agent', entityId: agent.id, limit: '100' },
        headers: { 'X-Quiet': '1' },
      })
      .pipe(
        catchError(() => of([] as ApiAuditEntry[])),
        map((entries) => entries.map(auditToTimeline)),
      );
  }
}


/** Flattened agent + commission rule, used by the commission plans table. */
export interface CommissionPlanRow extends CommissionRule {
  agentId: string;
  agentName: string;
  agentCode: string;
  tier: AgentTier;
  province: string;
}
