import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { PERMISSIONS } from '@core/constants/permission.constants';
import { AGENT_TIER_MAP, KYC_STATUS_MAP, toOptions } from '@core/constants/status-maps.constants';
import { AgentStatus } from '@core/enums';
import type { Agent, Page, PageQuery } from '@core/models';
import type { BulkActionEvent, TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { ConfirmService } from '@core/services/confirm.service';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { AgentRepository } from '../data/agent.repository';

/** Onboarding worklist for agents awaiting approval. */
@Component({
  selector: 'll-agent-approvals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Agent Approvals"
        eyebrow="Distribution Network"
        subtitle="Applications awaiting onboarding approval. Review the KYC pack, then approve or reject with a reason."
        icon="assignment_turned_in"
        [stats]="[{ label: 'Awaiting decision', value: total().toString(), icon: 'pending_actions' }]"
        [actions]="[{ id: 'back', label: 'All agents', icon: 'handshake', variant: 'secondary' }]"
        (actionSelected)="onHeaderAction($event)" />

      <ll-list-toolbar
        searchPlaceholder="Search applications…"
        [quickFilters]="quickFilters"
        [showDateRange]="true"
        [refreshing]="loading()"
        (searchChange)="onSearch($event)"
        (quickChange)="onQuickFilter($event)"
        (rangeChange)="onDateRange($event)"
        (refresh)="reload()"
        (export)="onExport($event)"
        (clear)="onClearFilters()" />

      <ll-data-table
        tableId="agent-approvals"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [bulkActions]="bulkActions"
        emptyTitle="Queue is clear"
        emptyMessage="Every agent application has been processed."
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
export class AgentApprovals extends ListPageBase<Agent> {
  private readonly repository = inject(AgentRepository);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  protected readonly entityLabel = 'Agent Approvals';

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'tier', label: 'Tier', icon: 'layers', options: toOptions(AGENT_TIER_MAP) },
    { key: 'kycStatus', label: 'KYC', icon: 'verified_user', options: toOptions(KYC_STATUS_MAP) },
  ];

  protected readonly columns: TableColumn<Agent>[] = [
    {
      key: 'name',
      label: 'Applicant',
      type: 'avatar',
      sortable: true,
      sticky: 'start',
      minWidth: 240,
      locked: true,
      avatarUrl: (row) => row.avatarUrl,
      subLabel: (row) => `${row.code} · ${row.businessName}`,
    },
    { key: 'tier', label: 'Tier', type: 'badge', badgeMap: AGENT_TIER_MAP, minWidth: 150 },
    { key: 'contact.phone', label: 'Phone', minWidth: 150 },
    { key: 'contact.email', label: 'Email', minWidth: 210 },
    { key: 'province', label: 'Province', sortable: true, minWidth: 160 },
    { key: 'parentAgentName', label: 'Sponsor', minWidth: 170 },
    {
      key: 'documents.length',
      label: 'Documents',
      type: 'number',
      value: (row) => row.documents.length,
      minWidth: 110,
    },
    { key: 'kycStatus', label: 'KYC', type: 'badge', badgeMap: KYC_STATUS_MAP, minWidth: 140 },
    { key: 'createdAt', label: 'Applied', type: 'relative', sortable: true, minWidth: 140 },
  ];

  protected readonly rowActions: TableAction<Agent>[] = [
    { id: 'view', label: 'Review application', icon: 'folder_open', primary: true, tone: 'primary' },
    {
      id: 'approve',
      label: 'Approve',
      icon: 'verified',
      tone: 'success',
      permissions: [PERMISSIONS.agents.approve],
    },
    {
      id: 'reject',
      label: 'Reject',
      icon: 'block',
      tone: 'danger',
      permissions: [PERMISSIONS.agents.approve],
    },
  ];

  protected readonly bulkActions = [
    {
      id: 'approve',
      label: 'Approve selected',
      icon: 'verified',
      tone: 'success' as const,
      permissions: [PERMISSIONS.agents.approve],
      confirm: {
        title: 'Approve selected applications?',
        message: '{count} agent(s) will be activated and able to trade immediately.',
        confirmLabel: 'Approve',
        tone: 'primary' as const,
      },
    },
  ];

  constructor() {
    super();
    this.initialise();
  }

  protected fetch(query: PageQuery): Observable<Page<Agent>> {
    return this.repository.approvalQueue(query);
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/agents']);
    }
  }

  protected openDetail(row: Agent): void {
    void this.router.navigate(['/agents/details', row.id]);
  }

  protected onRowAction(event: TableActionEvent<Agent>): void {
    const { action, row } = event;

    if (action === 'view') {
      this.openDetail(row);
      return;
    }

    if (action === 'approve') {
      this.confirm.confirmApproval('agent', row.name).subscribe((result) => {
        if (result.confirmed) {
          this.repository.approve(row.id, result.reason).subscribe(() => {
            this.toast.success('Agent approved', row.name);
            this.reload();
          });
        }
      });
      return;
    }

    if (action === 'reject') {
      this.confirm.confirmRejection('agent', row.name).subscribe((result) => {
        if (result.confirmed && result.reason) {
          this.repository.reject(row.id, result.reason).subscribe(() => {
            this.toast.success('Application rejected', row.name);
            this.reload();
          });
        }
      });
    }
  }

  protected onBulkAction(event: BulkActionEvent<Agent>): void {
    if (event.action !== 'approve') {
      return;
    }
    const ids = event.rows.map((row) => row.id);
    this.repository.bulkPatch(ids, { status: AgentStatus.Active }).subscribe(() => {
      this.toast.success(`${ids.length} agent(s) approved`);
      this.reload();
    });
  }
}
