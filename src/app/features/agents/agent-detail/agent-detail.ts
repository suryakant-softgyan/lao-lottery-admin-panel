import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';

import { PermissionService } from '@core/authentication/permission.service';
import { PERMISSIONS } from '@core/constants/permission.constants';
import {
  AGENT_STATUS_MAP,
  AGENT_TIER_MAP,
  KYC_STATUS_MAP,
  RETAILER_STATUS_MAP,
} from '@core/constants/status-maps.constants';
import { AgentStatus } from '@core/enums';
import type { Agent, Retailer, TimelineEvent } from '@core/models';
import { BreadcrumbService } from '@core/services/breadcrumb.service';
import { ConfirmService } from '@core/services/confirm.service';
import { ThemeService } from '@core/services/theme.service';
import { ToastService } from '@core/services/toast.service';
import { formatCurrency, humanise } from '@core/utilities/format.util';
import { ActivityTimeline } from '@shared/components/activity-timeline/activity-timeline';
import { Avatar } from '@shared/components/avatar/avatar';
import { ChartComponent } from '@shared/components/chart/chart';
import { InfoList, type InfoItem } from '@shared/components/info-list/info-list';
import { PageHeader, type PageHeaderAction } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { CurrencyPipe, DatePipe, PercentPipe } from '@shared/pipes/format.pipes';
import { AgentRepository } from '../data/agent.repository';

/** Agent 360: profile, commercial position, retailers, commission and history. */
@Component({
  selector: 'll-agent-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    MatTabsModule,
    PageHeader,
    Avatar,
    InfoList,
    ChartComponent,
    ActivityTimeline,
    StatusBadge,
    Skeleton,
    StatePanel,
    CurrencyPipe,
    DatePipe,
    PercentPipe,
  ],
  templateUrl: './agent-detail.html',
  styleUrl: './agent-detail.scss',
})
export class AgentDetail {
  private readonly repository = inject(AgentRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly breadcrumb = inject(BreadcrumbService);
  private readonly theme = inject(ThemeService);
  protected readonly permissions = inject(PermissionService);

  protected readonly tierMap = AGENT_TIER_MAP;
  protected readonly statusMap = AGENT_STATUS_MAP;
  protected readonly kycMap = KYC_STATUS_MAP;
  protected readonly retailerStatusMap = RETAILER_STATUS_MAP;

  protected readonly agent = signal<Agent | null>(null);
  protected readonly retailers = signal<Retailer[]>([]);
  protected readonly children = signal<Agent[]>([]);
  protected readonly timeline = signal<TimelineEvent[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly agentId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly profileItems = computed<InfoItem[]>(() => {
    const agent = this.agent();
    if (!agent) {
      return [];
    }
    return [
      { label: 'Agent code', value: agent.code, icon: 'tag', mono: true },
      { label: 'Business name', value: agent.businessName, icon: 'business' },
      { label: 'Tier', value: agent.tier, icon: 'layers', badgeMap: AGENT_TIER_MAP },
      { label: 'Status', value: agent.status, icon: 'flag', badgeMap: AGENT_STATUS_MAP },
      { label: 'KYC', value: agent.kycStatus, icon: 'verified_user', badgeMap: KYC_STATUS_MAP },
      { label: 'Phone', value: agent.contact.phone, icon: 'phone' },
      { label: 'Email', value: agent.contact.email, icon: 'mail' },
      { label: 'Territory', value: agent.territory, icon: 'map' },
      { label: 'Province', value: agent.province, icon: 'location_on' },
      { label: 'District', value: agent.district, icon: 'pin_drop' },
      { label: 'Sponsor', value: agent.parentAgentName ?? 'Head office', icon: 'account_tree' },
      { label: 'Tax ID', value: agent.taxId, icon: 'receipt_long', mono: true },
      {
        label: 'Address',
        value: [agent.address.line1, agent.address.district, agent.address.province]
          .filter(Boolean)
          .join(', '),
        icon: 'home',
        wide: true,
      },
    ];
  });

  protected readonly financialItems = computed<InfoItem[]>(() => {
    const agent = this.agent();
    if (!agent) {
      return [];
    }
    const money = (value: number): string => formatCurrency(value, this.theme.regional().currency);
    return [
      { label: 'Wallet balance', value: money(agent.walletBalance), icon: 'account_balance_wallet' },
      { label: 'Credit limit', value: money(agent.creditLimit), icon: 'credit_score' },
      { label: 'Outstanding', value: money(agent.outstandingBalance), icon: 'schedule' },
      { label: 'Bank', value: agent.bankName, icon: 'account_balance' },
      { label: 'Account name', value: agent.bankAccountName, icon: 'person' },
      { label: 'Account number', value: agent.bankAccountNumber, icon: 'pin', mono: true },
      { label: 'Contract start', value: agent.contractStartDate, icon: 'event' },
      { label: 'Contract end', value: agent.contractEndDate, icon: 'event_busy' },
    ];
  });

  protected readonly trendLabels = [
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
  ];

  protected readonly trendSeries = computed(() => {
    const agent = this.agent();
    return agent ? [{ label: 'Monthly sales index', data: agent.performance.monthlyTrend, fill: true }] : [];
  });

  protected readonly headerActions = computed<PageHeaderAction[]>(() => {
    const agent = this.agent();
    const actions: PageHeaderAction[] = [
      { id: 'back', label: 'Back', icon: 'arrow_back', variant: 'secondary' },
      { id: 'settlement', label: 'Settlements', icon: 'receipt', variant: 'secondary' },
    ];
    if (!agent) {
      return actions;
    }
    if (agent.status === AgentStatus.PendingApproval && this.permissions.has(PERMISSIONS.agents.approve)) {
      actions.push({ id: 'approve', label: 'Approve', icon: 'verified', variant: 'primary' });
    } else if (this.permissions.has(PERMISSIONS.agents.suspend)) {
      actions.push(
        agent.status === AgentStatus.Active
          ? { id: 'suspend', label: 'Suspend', icon: 'pause_circle', variant: 'primary' }
          : { id: 'reactivate', label: 'Reactivate', icon: 'play_circle', variant: 'primary' },
      );
    }
    return actions;
  });

  protected readonly currencyFormatter = (value: number): string =>
    formatCurrency(value, this.theme.regional().currency, this.theme.regional().locale, { compact: true });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.repository.getById(this.agentId).subscribe({
      next: (agent) => {
        this.agent.set(agent);
        this.breadcrumb.setDynamicLabel(agent.name);
        this.loading.set(false);

        this.repository.retailersOf(agent.id).subscribe((rows) => this.retailers.set(rows));
        this.repository.childrenOf(agent.id).subscribe((rows) => this.children.set(rows));
        this.repository.timeline(agent).subscribe((events) => this.timeline.set(events));
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('This agent could not be found.');
      },
    });
  }

  protected humanise(value: string): string {
    return humanise(value);
  }

  protected onHeaderAction(action: string): void {
    const agent = this.agent();
    if (!agent) {
      return;
    }

    switch (action) {
      case 'back':
        void this.router.navigate(['/agents']);
        break;
      case 'settlement':
        void this.router.navigate(['/wallet/settlement'], { queryParams: { party: agent.id } });
        break;
      case 'approve':
        this.confirm.confirmApproval('agent', agent.name).subscribe((result) => {
          if (result.confirmed) {
            this.repository.approve(agent.id, result.reason).subscribe((updated) => {
              this.agent.set(updated);
              this.toast.success('Agent approved', updated.name);
            });
          }
        });
        break;
      case 'reactivate':
        this.repository.reactivate(agent.id).subscribe((updated) => {
          this.agent.set(updated);
          this.toast.success('Agent reactivated', updated.name);
        });
        break;
      case 'suspend':
        this.confirm
          .open({
            title: 'Suspend this agent?',
            message: `${agent.name} and every retailer beneath them stop selling immediately.`,
            detail: `${agent.retailerCount} retailer(s) and ${agent.deviceCount} device(s) are affected.`,
            confirmLabel: 'Suspend',
            tone: 'warning',
            icon: 'pause_circle',
            requireReason: true,
            reasonLabel: 'Reason (recorded in the audit trail)',
          })
          .subscribe((result) => {
            if (result.confirmed && result.reason) {
              this.repository.suspend(agent.id, result.reason).subscribe((updated) => {
                this.agent.set(updated);
                this.toast.success('Agent suspended', updated.name);
              });
            }
          });
        break;
      default:
        break;
    }
  }
}
