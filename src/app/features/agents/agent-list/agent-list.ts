import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { PERMISSIONS } from '@core/constants/permission.constants';
import {
  AGENT_STATUS_MAP,
  AGENT_TIER_MAP,
  KYC_STATUS_MAP,
  toOptions,
} from '@core/constants/status-maps.constants';
import { AgentStatus } from '@core/enums';
import type { Agent, Page, PageQuery, StatMetric } from '@core/models';
import type { BulkActionEvent, TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { ConfirmService } from '@core/services/confirm.service';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatCard } from '@shared/components/stat-card/stat-card';
import { AgentRepository } from '../data/agent.repository';

/** Agent network list: master, distributor and retail agents in one view. */
@Component({
  selector: 'll-agent-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable, StatCard],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Agent Management"
        eyebrow="Distribution Network"
        subtitle="Master agents, distributors and retail agents across all provinces, with commission and settlement position."
        icon="handshake"
        [stats]="[
          { label: 'Agents', value: total().toLocaleString(), icon: 'handshake' },
          { label: 'Selected', value: selected().length.toString(), icon: 'check_circle' },
        ]"
        [actions]="[
          { id: 'approvals', label: 'Approval queue', icon: 'assignment_turned_in', variant: 'secondary' },
          { id: 'commission', label: 'Commission plans', icon: 'percent', variant: 'secondary' },
          { id: 'performance', label: 'Performance', icon: 'trending_up', variant: 'primary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      @if (summary().length) {
        <section class="ll-grid ll-grid--auto ll-stagger" aria-label="Agent statistics">
          @for (metric of summary(); track metric.id) {
            <ll-stat-card
              [metric]="metric"
              [currency]="metric.id === 'sales' || metric.id === 'commission'" />
          }
        </section>
      }

      <ll-list-toolbar
        searchPlaceholder="Search by agent name, code, business, phone or province…"
        [quickFilters]="quickFilters"
        [showDateRange]="true"
        [refreshing]="loading()"
        (searchChange)="onSearch($event)"
        (quickChange)="onQuickFilter($event)"
        (rangeChange)="onDateRange($event)"
        (refresh)="refreshAll()"
        (export)="onExport($event)"
        (clear)="onClearFilters()" />

      <ll-data-table
        tableId="agents"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [bulkActions]="bulkActions"
        emptyTitle="No agents yet"
        emptyMessage="Onboard the first master agent to start building the distribution network."
        (sortChange)="onSort($event)"
        (pageChange)="onPage($event)"
        (rowAction)="onRowAction($event)"
        (bulkAction)="onBulkAction($event)"
        (rowClick)="openDetail($event)"
        (selectionChange)="onSelectionChange($event)"
        (retry)="reload()" />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class AgentList extends ListPageBase<Agent> {
  private readonly repository = inject(AgentRepository);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  protected readonly entityLabel = 'Agents';
  protected readonly summary = signal<StatMetric[]>([]);

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'status', label: 'Status', icon: 'flag', options: toOptions(AGENT_STATUS_MAP) },
    { key: 'tier', label: 'Tier', icon: 'layers', options: toOptions(AGENT_TIER_MAP) },
    { key: 'kycStatus', label: 'KYC', icon: 'verified_user', options: toOptions(KYC_STATUS_MAP) },
  ];

  protected readonly columns: TableColumn<Agent>[] = [
    {
      key: 'name',
      label: 'Agent',
      type: 'avatar',
      sortable: true,
      sticky: 'start',
      minWidth: 240,
      locked: true,
      avatarUrl: (row) => row.avatarUrl,
      subLabel: (row) => `${row.code} · ${row.businessName}`,
    },
    { key: 'tier', label: 'Tier', type: 'badge', sortable: true, badgeMap: AGENT_TIER_MAP, minWidth: 150 },
    { key: 'province', label: 'Province', sortable: true, minWidth: 160 },
    { key: 'parentAgentName', label: 'Reports to', minWidth: 170 },
    { key: 'retailerCount', label: 'Retailers', type: 'number', sortable: true, minWidth: 110 },
    {
      key: 'performance.salesAmount',
      label: 'Sales',
      type: 'currency',
      sortable: true,
      minWidth: 150,
      value: (row) => row.performance.salesAmount,
    },
    {
      key: 'performance.commissionEarned',
      label: 'Commission',
      type: 'currency',
      sortable: true,
      minWidth: 150,
      value: (row) => row.performance.commissionEarned,
    },
    {
      key: 'performance.achievementPercent',
      label: 'Target',
      type: 'progress',
      sortable: true,
      minWidth: 160,
      value: (row) => row.performance.achievementPercent,
      format: (value) => `${Number(value).toFixed(0)}%`,
    },
    { key: 'walletBalance', label: 'Wallet', type: 'currency', sortable: true, minWidth: 150 },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: AGENT_STATUS_MAP,
      minWidth: 150,
    },
    { key: 'kycStatus', label: 'KYC', type: 'badge', badgeMap: KYC_STATUS_MAP, minWidth: 140 },
  ];

  protected readonly rowActions: TableAction<Agent>[] = [
    { id: 'view', label: 'View details', icon: 'visibility', primary: true, tone: 'primary' },
    {
      id: 'approve',
      label: 'Approve agent',
      icon: 'verified',
      tone: 'success',
      permissions: [PERMISSIONS.agents.approve],
      visible: (row) => row.status === AgentStatus.PendingApproval,
    },
    {
      id: 'settlement',
      label: 'View settlements',
      icon: 'receipt',
      permissions: [PERMISSIONS.agents.settlement],
    },
    {
      id: 'suspend',
      label: 'Suspend agent',
      icon: 'pause_circle',
      tone: 'warning',
      permissions: [PERMISSIONS.agents.suspend],
      visible: (row) => row.status === AgentStatus.Active,
      divider: true,
    },
    {
      id: 'reactivate',
      label: 'Reactivate agent',
      icon: 'play_circle',
      tone: 'success',
      permissions: [PERMISSIONS.agents.suspend],
      visible: (row) => row.status === AgentStatus.Suspended || row.status === AgentStatus.Blocked,
    },
    {
      id: 'block',
      label: 'Block agent',
      icon: 'block',
      tone: 'danger',
      permissions: [PERMISSIONS.agents.block],
      visible: (row) => row.status !== AgentStatus.Blocked,
    },
  ];

  protected readonly bulkActions = [
    {
      id: 'approve',
      label: 'Approve',
      icon: 'verified',
      tone: 'success' as const,
      permissions: [PERMISSIONS.agents.approve],
      confirm: {
        title: 'Approve selected agents?',
        message: '{count} agent(s) will be activated and able to trade immediately.',
        confirmLabel: 'Approve',
        tone: 'primary' as const,
      },
    },
    {
      id: 'suspend',
      label: 'Suspend',
      icon: 'pause_circle',
      tone: 'warning' as const,
      permissions: [PERMISSIONS.agents.suspend],
      confirm: {
        title: 'Suspend selected agents?',
        message: '{count} agent(s) and their retailers will stop selling immediately.',
        confirmLabel: 'Suspend',
        tone: 'warning' as const,
      },
    },
  ];

  constructor() {
    super();
    this.initialise();
    this.loadSummary();
  }

  protected fetch(query: PageQuery): Observable<Page<Agent>> {
    return this.repository.list(query);
  }

  private loadSummary(): void {
    this.repository.statistics().subscribe((metrics) => this.summary.set(metrics));
  }

  protected refreshAll(): void {
    this.reload();
    this.loadSummary();
  }

  protected openDetail(row: Agent): void {
    void this.router.navigate(['/agents/details', row.id]);
  }

  protected onHeaderAction(action: string): void {
    switch (action) {
      case 'approvals':
        void this.router.navigate(['/agents/approvals']);
        break;
      case 'commission':
        void this.router.navigate(['/agents/commission']);
        break;
      case 'performance':
        void this.router.navigate(['/agents/performance']);
        break;
      default:
        break;
    }
  }

  protected onRowAction(event: TableActionEvent<Agent>): void {
    const { action, row } = event;

    switch (action) {
      case 'view':
        this.openDetail(row);
        break;
      case 'settlement':
        void this.router.navigate(['/wallet/settlement'], { queryParams: { party: row.id } });
        break;
      case 'approve':
        this.confirm.confirmApproval('agent', row.name).subscribe((result) => {
          if (result.confirmed) {
            this.repository.approve(row.id, result.reason).subscribe(() => {
              this.toast.success('Agent approved', row.name);
              this.refreshAll();
            });
          }
        });
        break;
      case 'reactivate':
        this.repository.reactivate(row.id).subscribe(() => {
          this.toast.success('Agent reactivated', row.name);
          this.refreshAll();
        });
        break;
      case 'suspend':
        this.askReason('Suspend agent', row, (reason) =>
          this.repository.suspend(row.id, reason).subscribe(() => {
            this.toast.success('Agent suspended', row.name);
            this.refreshAll();
          }),
        );
        break;
      case 'block':
        this.askReason('Block agent', row, (reason) =>
          this.repository.block(row.id, reason).subscribe(() => {
            this.toast.success('Agent blocked', row.name);
            this.refreshAll();
          }),
        );
        break;
      default:
        break;
    }
  }

  protected onBulkAction(event: BulkActionEvent<Agent>): void {
    const ids = event.rows.map((row) => row.id);
    const status = event.action === 'approve' ? AgentStatus.Active : AgentStatus.Suspended;

    this.repository.bulkPatch(ids, { status }).subscribe(() => {
      this.toast.success(`${ids.length} agent(s) updated`);
      this.refreshAll();
    });
  }

  /** Suspension and blocking always capture a reason for the audit trail. */
  private askReason(title: string, row: Agent, run: (reason: string) => void): void {
    this.confirm
      .open({
        title: `${title}?`,
        message: `${row.name} and every retailer beneath them will stop selling immediately.`,
        detail: `${row.retailerCount} retailer(s) and ${row.deviceCount} device(s) are affected.`,
        confirmLabel: title,
        tone: 'danger',
        icon: 'block',
        requireReason: true,
        reasonLabel: 'Reason (recorded in the audit trail)',
      })
      .subscribe((result) => {
        if (result.confirmed && result.reason) {
          run(result.reason);
        }
      });
  }
}
