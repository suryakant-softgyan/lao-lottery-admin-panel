import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { AGENT_STATUS_MAP, AGENT_TIER_MAP, toOptions } from '@core/constants/status-maps.constants';
import type { Agent, Page, PageQuery } from '@core/models';
import type { TableColumn } from '@core/models/table.model';
import { ThemeService } from '@core/services/theme.service';
import { formatCompact, formatCurrency } from '@core/utilities/format.util';
import { ListPageBase } from '@shared/base/list-page.base';
import { ChartComponent } from '@shared/components/chart/chart';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { Avatar } from '@shared/components/avatar/avatar';
import { CurrencyPipe, PercentPipe } from '@shared/pipes/format.pipes';
import { AgentRepository } from '../data/agent.repository';

/** Agent league table with a podium and comparative sales chart. */
@Component({
  selector: 'll-agent-performance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable, ChartComponent, Avatar, CurrencyPipe, PercentPipe],
  templateUrl: './agent-performance.html',
  styleUrl: './agent-performance.scss',
})
export class AgentPerformance extends ListPageBase<Agent> {
  private readonly repository = inject(AgentRepository);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);

  protected readonly entityLabel = 'Agent Performance';

  protected readonly topAgents = signal<Agent[]>([]);

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'tier', label: 'Tier', icon: 'layers', options: toOptions(AGENT_TIER_MAP) },
    { key: 'status', label: 'Status', icon: 'flag', options: toOptions(AGENT_STATUS_MAP) },
  ];

  protected readonly columns: TableColumn<Agent>[] = [
    {
      key: 'performance.rank',
      label: 'Rank',
      type: 'number',
      sortable: true,
      align: 'center',
      minWidth: 80,
      locked: true,
      value: (row) => row.performance.rank,
      format: (value) => `#${value}`,
    },
    {
      key: 'name',
      label: 'Agent',
      type: 'avatar',
      sortable: true,
      sticky: 'start',
      minWidth: 230,
      avatarUrl: (row) => row.avatarUrl,
      subLabel: (row) => `${row.code} · ${row.province}`,
    },
    { key: 'tier', label: 'Tier', type: 'badge', badgeMap: AGENT_TIER_MAP, minWidth: 150 },
    {
      key: 'performance.ticketsSold',
      label: 'Tickets',
      type: 'number',
      sortable: true,
      minWidth: 120,
      value: (row) => row.performance.ticketsSold,
    },
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
      key: 'performance.payoutAmount',
      label: 'Payouts',
      type: 'currency',
      sortable: true,
      minWidth: 150,
      value: (row) => row.performance.payoutAmount,
    },
    {
      key: 'performance.targetAmount',
      label: 'Target',
      type: 'currency',
      sortable: true,
      minWidth: 150,
      value: (row) => row.performance.targetAmount,
    },
    {
      key: 'performance.achievementPercent',
      label: 'Achievement',
      type: 'progress',
      sortable: true,
      minWidth: 170,
      value: (row) => row.performance.achievementPercent,
      format: (value) => `${Number(value).toFixed(0)}%`,
    },
    {
      key: 'performance.activeRetailers',
      label: 'Retailers',
      type: 'number',
      sortable: true,
      minWidth: 110,
      value: (row) => row.performance.activeRetailers,
    },
  ];

  /** Comparative chart of the top ten agents. */
  protected readonly chartLabels = computed(() =>
    this.rows()
      .slice(0, 10)
      .map((agent) => agent.name.split(' ')[0] ?? agent.name),
  );

  protected readonly chartSeries = computed(() => {
    const top = this.rows().slice(0, 10);
    return [
      { label: 'Sales', data: top.map((agent) => agent.performance.salesAmount) },
      { label: 'Commission', data: top.map((agent) => agent.performance.commissionEarned) },
    ];
  });

  protected readonly podium = computed(() => this.topAgents().slice(0, 3));

  protected readonly currencyFormatter = (value: number): string =>
    formatCurrency(value, this.theme.regional().currency, this.theme.regional().locale, {
      compact: true,
      symbol: this.theme.regional().currencySymbol,
      position: this.theme.regional().currencyPosition,
    });

  constructor() {
    super();
    this.patchQuery({ sort: { active: 'performance.salesAmount', direction: 'desc' as never } });
    this.initialise();
    this.loadPodium();
  }

  protected fetch(query: PageQuery): Observable<Page<Agent>> {
    return this.repository.leaderboard(query);
  }

  private loadPodium(): void {
    this.repository.all().subscribe((agents) => {
      this.topAgents.set(
        [...agents].sort((a, b) => b.performance.salesAmount - a.performance.salesAmount).slice(0, 3),
      );
    });
  }

  protected compactValue(value: number): string {
    return formatCompact(value, this.theme.regional().locale);
  }

  protected openDetail(row: Agent): void {
    void this.router.navigate(['/agents/details', row.id]);
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/agents']);
    }
  }
}
