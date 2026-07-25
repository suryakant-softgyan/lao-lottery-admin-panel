import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { AgentStatus, AgentTier, KycStatus } from '@core/enums';
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
    const pending = this.records.filter((agent) => agent.status === AgentStatus.PendingApproval);
    return this.backend.respond(() => applyQuery(pending, query, this.queryOptions));
  }

  approve(id: string, remarks?: string): Observable<Agent> {
    return this.patch(id, {
      status: AgentStatus.Active,
      kycStatus: KycStatus.Approved,
      notes: remarks,
    } as Partial<Agent>);
  }

  reject(id: string, reason: string): Observable<Agent> {
    return this.patch(id, {
      status: AgentStatus.Inactive,
      kycStatus: KycStatus.Rejected,
      notes: reason,
    } as Partial<Agent>);
  }

  suspend(id: string, reason: string): Observable<Agent> {
    return this.patch(id, { status: AgentStatus.Suspended, suspendedReason: reason } as Partial<Agent>);
  }

  block(id: string, reason: string): Observable<Agent> {
    return this.patch(id, { status: AgentStatus.Blocked, blockedReason: reason } as Partial<Agent>);
  }

  reactivate(id: string): Observable<Agent> {
    return this.patch(id, {
      status: AgentStatus.Active,
      suspendedReason: undefined,
      blockedReason: undefined,
    } as Partial<Agent>);
  }

  /** Retailers reporting to an agent — shown on the detail page. */
  retailersOf(agentId: string): Observable<Retailer[]> {
    return this.backend.respond(() =>
      mockDataset.retailers.filter((retailer) => retailer.agentId === agentId),
    );
  }

  /** Direct children in the agent hierarchy. */
  childrenOf(agentId: string): Observable<Agent[]> {
    return this.backend.respond(() => this.records.filter((agent) => agent.parentAgentId === agentId));
  }

  /** Every commission rule across the network, for the plans screen. */
  commissionPlans(query: PageQuery): Observable<Page<CommissionPlanRow>> {
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
    const ranked = [...this.records].sort((a, b) => b.performance.salesAmount - a.performance.salesAmount);
    return this.backend.respond(() => applyQuery(ranked, query, this.queryOptions));
  }

  /** Summary tiles for the list page. */
  statistics(): Observable<StatMetric[]> {
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
}

/** Flattened agent + commission rule, used by the commission plans table. */
export interface CommissionPlanRow extends CommissionRule {
  agentId: string;
  agentName: string;
  agentCode: string;
  tier: AgentTier;
  province: string;
}
