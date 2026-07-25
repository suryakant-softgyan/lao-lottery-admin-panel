import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { PERMISSIONS } from '@core/constants/permission.constants';
import { AGENT_TIER_MAP, LOTTERY_TYPE_MAP, toOptions } from '@core/constants/status-maps.constants';
import { CommissionModel } from '@core/enums';
import type { Page, PageQuery } from '@core/models';
import type { TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { humanise } from '@core/utilities/format.util';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { AgentRepository, type CommissionPlanRow } from '../data/agent.repository';

/**
 * Commission plans across the whole network.
 *
 * Flattening agent × lottery-type rules into one table is what makes an
 * inconsistent rate visible — the shape most operators need when a settlement
 * dispute arrives.
 */
@Component({
  selector: 'll-commission-plans',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Commission Plans"
        eyebrow="Distribution Network"
        subtitle="Every commission rule in force, by agent and lottery product. Rates drive settlement automatically."
        icon="percent"
        [stats]="[{ label: 'Active rules', value: total().toLocaleString(), icon: 'rule' }]"
        [actions]="[{ id: 'back', label: 'All agents', icon: 'handshake', variant: 'secondary' }]"
        (actionSelected)="onHeaderAction($event)" />

      <ll-list-toolbar
        searchPlaceholder="Search by agent, code, product or province…"
        [quickFilters]="quickFilters"
        [refreshing]="loading()"
        (searchChange)="onSearch($event)"
        (quickChange)="onQuickFilter($event)"
        (refresh)="reload()"
        (export)="onExport($event)"
        (clear)="onClearFilters()" />

      <ll-data-table
        tableId="commission-plans"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [selectable]="false"
        emptyTitle="No commission rules"
        emptyMessage="Define a commission plan on an agent to see it listed here."
        (sortChange)="onSort($event)"
        (pageChange)="onPage($event)"
        (rowAction)="onRowAction($event)"
        (rowClick)="openAgent($event)"
        (retry)="reload()" />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class CommissionPlans extends ListPageBase<CommissionPlanRow> {
  private readonly repository = inject(AgentRepository);
  private readonly router = inject(Router);

  protected readonly entityLabel = 'Commission Plans';

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'tier', label: 'Tier', icon: 'layers', options: toOptions(AGENT_TIER_MAP) },
    { key: 'lotteryType', label: 'Product', icon: 'casino', options: toOptions(LOTTERY_TYPE_MAP) },
    {
      key: 'model',
      label: 'Model',
      icon: 'calculate',
      options: Object.values(CommissionModel).map((value) => ({ value, label: humanise(value) })),
    },
  ];

  protected readonly columns: TableColumn<CommissionPlanRow>[] = [
    {
      key: 'agentName',
      label: 'Agent',
      sortable: true,
      sticky: 'start',
      minWidth: 220,
      locked: true,
      subLabel: (row) => `${row.agentCode} · ${row.province}`,
    },
    { key: 'tier', label: 'Tier', type: 'badge', badgeMap: AGENT_TIER_MAP, minWidth: 150 },
    {
      key: 'lotteryType',
      label: 'Product',
      type: 'badge',
      sortable: true,
      badgeMap: LOTTERY_TYPE_MAP,
      minWidth: 140,
    },
    {
      key: 'model',
      label: 'Model',
      sortable: true,
      minWidth: 130,
      format: (value) => humanise(String(value)),
    },
    { key: 'rate', label: 'Rate', type: 'percent', sortable: true, minWidth: 110 },
    { key: 'flatAmount', label: 'Flat amount', type: 'currency', sortable: true, minWidth: 140 },
    { key: 'maxSales', label: 'Ceiling', type: 'currency', sortable: true, minWidth: 160 },
    { key: 'effectiveFrom', label: 'Effective from', type: 'date', sortable: true, minWidth: 150 },
    { key: 'effectiveTo', label: 'Effective to', type: 'date', minWidth: 150 },
    { key: 'active', label: 'Active', type: 'boolean', sortable: true, align: 'center', minWidth: 100 },
  ];

  protected readonly rowActions: TableAction<CommissionPlanRow>[] = [
    { id: 'agent', label: 'Open agent', icon: 'handshake', primary: true, tone: 'primary' },
    {
      id: 'settlement',
      label: 'View settlements',
      icon: 'receipt',
      permissions: [PERMISSIONS.agents.settlement],
    },
  ];

  constructor() {
    super();
    this.initialise();
  }

  protected fetch(query: PageQuery): Observable<Page<CommissionPlanRow>> {
    return this.repository.commissionPlans(query);
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/agents']);
    }
  }

  protected openAgent(row: CommissionPlanRow): void {
    void this.router.navigate(['/agents/details', row.agentId]);
  }

  protected onRowAction(event: TableActionEvent<CommissionPlanRow>): void {
    if (event.action === 'agent') {
      this.openAgent(event.row);
    } else if (event.action === 'settlement') {
      void this.router.navigate(['/wallet/settlement'], { queryParams: { party: event.row.agentId } });
    }
  }
}
