import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { PERMISSIONS } from '@core/constants/permission.constants';
import { KYC_STATUS_MAP, RETAILER_STATUS_MAP, toOptions } from '@core/constants/status-maps.constants';
import { RetailerStatus, ShopType } from '@core/enums';
import type { Page, PageQuery, Retailer, StatMetric } from '@core/models';
import type { BulkActionEvent, TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { ConfirmService } from '@core/services/confirm.service';
import { humanise } from '@core/utilities/format.util';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatCard } from '@shared/components/stat-card/stat-card';
import { RetailerRepository } from '../data/retailer.repository';

/** Retail outlet list across every province. */
@Component({
  selector: 'll-retailer-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable, StatCard],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Retail Shops"
        eyebrow="Distribution Network"
        subtitle="Point-of-sale outlets, their terminals and daily trading position across all 18 provinces."
        icon="storefront"
        [stats]="[
          { label: 'Outlets', value: total().toLocaleString(), icon: 'storefront' },
          { label: 'Selected', value: selected().length.toString(), icon: 'check_circle' },
        ]"
        [actions]="[
          { id: 'devices', label: 'POS devices', icon: 'point_of_sale', variant: 'secondary' },
          { id: 'map', label: 'Coverage map', icon: 'map', variant: 'primary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      @if (summary().length) {
        <section class="ll-grid ll-grid--auto ll-stagger" aria-label="Retailer statistics">
          @for (metric of summary(); track metric.id) {
            <ll-stat-card [metric]="metric" [currency]="metric.id === 'sales'" />
          }
        </section>
      }

      <ll-list-toolbar
        searchPlaceholder="Search by shop, code, owner, phone, agent or district…"
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
        tableId="retailers"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [bulkActions]="bulkActions"
        emptyTitle="No retail outlets"
        emptyMessage="Register the first shop to begin selling through the retail channel."
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
export class RetailerList extends ListPageBase<Retailer> {
  private readonly repository = inject(RetailerRepository);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  protected readonly entityLabel = 'Retailers';
  protected readonly summary = signal<StatMetric[]>([]);

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'status', label: 'Status', icon: 'flag', options: toOptions(RETAILER_STATUS_MAP) },
    {
      key: 'shopType',
      label: 'Shop type',
      icon: 'store',
      options: Object.values(ShopType).map((value) => ({ value, label: humanise(value) })),
    },
    { key: 'kycStatus', label: 'KYC', icon: 'verified_user', options: toOptions(KYC_STATUS_MAP) },
  ];

  protected readonly columns: TableColumn<Retailer>[] = [
    {
      key: 'shopName',
      label: 'Shop',
      type: 'avatar',
      sortable: true,
      sticky: 'start',
      minWidth: 240,
      locked: true,
      avatarUrl: (row) => row.photoUrl,
      subLabel: (row) => `${row.code} · ${row.ownerName}`,
    },
    {
      key: 'shopType',
      label: 'Type',
      sortable: true,
      minWidth: 140,
      format: (value) => humanise(String(value)),
    },
    { key: 'agentName', label: 'Agent', sortable: true, minWidth: 180 },
    { key: 'province', label: 'Province', sortable: true, minWidth: 150 },
    { key: 'district', label: 'District', minWidth: 140 },
    { key: 'deviceCount', label: 'Devices', type: 'number', sortable: true, minWidth: 110 },
    { key: 'ticketsToday', label: 'Tickets today', type: 'number', sortable: true, minWidth: 130 },
    { key: 'salesToday', label: 'Sales today', type: 'currency', sortable: true, minWidth: 150 },
    { key: 'salesMonth', label: 'Sales (month)', type: 'currency', sortable: true, minWidth: 160 },
    { key: 'commissionRate', label: 'Commission', type: 'percent', sortable: true, minWidth: 130 },
    {
      key: 'rating',
      label: 'Rating',
      type: 'number',
      sortable: true,
      minWidth: 100,
      format: (value) => `${Number(value).toFixed(1)} ★`,
    },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: RETAILER_STATUS_MAP,
      minWidth: 150,
    },
  ];

  protected readonly rowActions: TableAction<Retailer>[] = [
    { id: 'view', label: 'View details', icon: 'visibility', primary: true, tone: 'primary' },
    {
      id: 'devices',
      label: 'View devices',
      icon: 'point_of_sale',
      permissions: [PERMISSIONS.retailers.devices],
    },
    {
      id: 'approve',
      label: 'Approve outlet',
      icon: 'verified',
      tone: 'success',
      permissions: [PERMISSIONS.retailers.approve],
      visible: (row) => row.status === RetailerStatus.PendingApproval,
    },
    {
      id: 'suspend',
      label: 'Suspend outlet',
      icon: 'pause_circle',
      tone: 'warning',
      permissions: [PERMISSIONS.retailers.update],
      visible: (row) => row.status === RetailerStatus.Active,
      divider: true,
    },
    {
      id: 'close',
      label: 'Close outlet',
      icon: 'store_mall_directory',
      tone: 'danger',
      permissions: [PERMISSIONS.retailers.delete],
      visible: (row) => row.status !== RetailerStatus.Closed,
    },
  ];

  protected readonly bulkActions = [
    {
      id: 'approve',
      label: 'Approve',
      icon: 'verified',
      tone: 'success' as const,
      permissions: [PERMISSIONS.retailers.approve],
      confirm: {
        title: 'Approve selected outlets?',
        message: '{count} outlet(s) will be activated and able to sell immediately.',
        confirmLabel: 'Approve',
        tone: 'primary' as const,
      },
    },
    {
      id: 'suspend',
      label: 'Suspend',
      icon: 'pause_circle',
      tone: 'warning' as const,
      permissions: [PERMISSIONS.retailers.update],
      confirm: {
        title: 'Suspend selected outlets?',
        message: '{count} outlet(s) will stop selling immediately.',
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

  protected fetch(query: PageQuery): Observable<Page<Retailer>> {
    return this.repository.list(query);
  }

  private loadSummary(): void {
    this.repository.statistics().subscribe((metrics) => this.summary.set(metrics));
  }

  protected refreshAll(): void {
    this.reload();
    this.loadSummary();
  }

  protected openDetail(row: Retailer): void {
    void this.router.navigate(['/retailers/details', row.id]);
  }

  protected onHeaderAction(action: string): void {
    if (action === 'devices') {
      void this.router.navigate(['/retailers/devices']);
    } else if (action === 'map') {
      void this.router.navigate(['/retailers/map']);
    }
  }

  protected onRowAction(event: TableActionEvent<Retailer>): void {
    const { action, row } = event;

    switch (action) {
      case 'view':
        this.openDetail(row);
        break;
      case 'devices':
        void this.router.navigate(['/retailers/devices'], { queryParams: { retailerId: row.id } });
        break;
      case 'approve':
        this.confirm.confirmApproval('retail outlet', row.shopName).subscribe((result) => {
          if (result.confirmed) {
            this.repository.approve(row.id, result.reason).subscribe(() => {
              this.toast.success('Outlet approved', row.shopName);
              this.refreshAll();
            });
          }
        });
        break;
      case 'suspend':
        this.askReason('Suspend outlet', row, (reason) =>
          this.repository.suspend(row.id, reason).subscribe(() => {
            this.toast.success('Outlet suspended', row.shopName);
            this.refreshAll();
          }),
        );
        break;
      case 'close':
        this.askReason('Close outlet', row, (reason) =>
          this.repository.close(row.id, reason).subscribe(() => {
            this.toast.success('Outlet closed', row.shopName);
            this.refreshAll();
          }),
        );
        break;
      default:
        break;
    }
  }

  protected onBulkAction(event: BulkActionEvent<Retailer>): void {
    const ids = event.rows.map((row) => row.id);
    const status = event.action === 'approve' ? RetailerStatus.Active : RetailerStatus.Suspended;

    this.repository.bulkPatch(ids, { status }).subscribe(() => {
      this.toast.success(`${ids.length} outlet(s) updated`);
      this.refreshAll();
    });
  }

  private askReason(title: string, row: Retailer, run: (reason: string) => void): void {
    this.confirm
      .open({
        title: `${title}?`,
        message: `${row.shopName} will stop selling immediately across all ${row.deviceCount} terminal(s).`,
        confirmLabel: title,
        tone: 'warning',
        icon: 'pause_circle',
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
