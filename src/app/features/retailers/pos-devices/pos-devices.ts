import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';

import { PERMISSIONS } from '@core/constants/permission.constants';
import { POS_DEVICE_STATUS_MAP, toOptions } from '@core/constants/status-maps.constants';
import { PosDeviceModel, PosDeviceStatus } from '@core/enums';
import type { Page, PageQuery, PosDevice, StatMetric } from '@core/models';
import type { BulkActionEvent, TableAction, TableActionEvent, TableColumn } from '@core/models/table.model';
import { humanise } from '@core/utilities/format.util';
import { ListPageBase } from '@shared/base/list-page.base';
import { DataTable } from '@shared/components/data-table/data-table';
import { ListToolbar, type QuickFilter } from '@shared/components/list-toolbar/list-toolbar';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatCard } from '@shared/components/stat-card/stat-card';
import { RetailerRepository } from '../data/retailer.repository';

/**
 * POS terminal fleet.
 *
 * Activation, QR assignment and health monitoring for every terminal in the
 * field. Battery level and last heartbeat are the two columns support looks at
 * first when an outlet reports it cannot sell.
 */
@Component({
  selector: 'll-pos-devices',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, ListToolbar, DataTable, StatCard],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="POS Devices"
        eyebrow="Distribution Network"
        subtitle="Terminal fleet health, activation status and QR assignment across the retail network."
        icon="point_of_sale"
        [stats]="[
          { label: 'Terminals', value: total().toLocaleString(), icon: 'point_of_sale' },
          { label: 'Selected', value: selected().length.toString(), icon: 'check_circle' },
        ]"
        [actions]="[{ id: 'back', label: 'Retail shops', icon: 'storefront', variant: 'secondary' }]"
        (actionSelected)="onHeaderAction($event)" />

      @if (summary().length) {
        <section class="ll-grid ll-grid--auto ll-stagger" aria-label="Device statistics">
          @for (metric of summary(); track metric.id) {
            <ll-stat-card [metric]="metric" />
          }
        </section>
      }

      <ll-list-toolbar
        searchPlaceholder="Search by serial, IMEI, retailer, model or SIM…"
        [quickFilters]="quickFilters"
        [refreshing]="loading()"
        (searchChange)="onSearch($event)"
        (quickChange)="onQuickFilter($event)"
        (refresh)="refreshAll()"
        (export)="onExport($event)"
        (clear)="onClearFilters()" />

      <ll-data-table
        tableId="pos-devices"
        [columns]="columns"
        [page]="page()"
        [loading]="loading()"
        [error]="errorMessage()"
        [sort]="query().sort ?? { active: '', direction: '' }"
        [filtered]="isFiltered()"
        [rowActions]="rowActions"
        [bulkActions]="bulkActions"
        emptyTitle="No terminals registered"
        emptyMessage="Register a POS terminal and assign it to a retail outlet."
        (sortChange)="onSort($event)"
        (pageChange)="onPage($event)"
        (rowAction)="onRowAction($event)"
        (bulkAction)="onBulkAction($event)"
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
export class PosDevices extends ListPageBase<PosDevice> {
  private readonly repository = inject(RetailerRepository);
  private readonly router = inject(Router);

  protected readonly entityLabel = 'POS Devices';
  protected readonly summary = signal<StatMetric[]>([]);

  protected readonly quickFilters: QuickFilter[] = [
    { key: 'status', label: 'Status', icon: 'flag', options: toOptions(POS_DEVICE_STATUS_MAP) },
    {
      key: 'model',
      label: 'Model',
      icon: 'devices',
      options: Object.values(PosDeviceModel).map((value) => ({ value, label: humanise(value) })),
    },
  ];

  protected readonly columns: TableColumn<PosDevice>[] = [
    {
      key: 'serialNumber',
      label: 'Serial',
      sortable: true,
      sticky: 'start',
      minWidth: 180,
      locked: true,
      subLabel: (row) => `IMEI ${row.imei}`,
    },
    {
      key: 'model',
      label: 'Model',
      sortable: true,
      minWidth: 160,
      format: (value) => humanise(String(value)),
    },
    { key: 'retailerName', label: 'Retailer', sortable: true, minWidth: 200 },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      sortable: true,
      badgeMap: POS_DEVICE_STATUS_MAP,
      minWidth: 170,
    },
    { key: 'qrCode', label: 'QR code', minWidth: 160 },
    {
      key: 'batteryLevel',
      label: 'Battery',
      type: 'progress',
      sortable: true,
      minWidth: 140,
      format: (value) => `${value ?? 0}%`,
    },
    { key: 'lastHeartbeatAt', label: 'Last seen', type: 'relative', sortable: true, minWidth: 140 },
    { key: 'ticketsToday', label: 'Tickets today', type: 'number', sortable: true, minWidth: 130 },
    { key: 'salesToday', label: 'Sales today', type: 'currency', sortable: true, minWidth: 150 },
    { key: 'firmwareVersion', label: 'Firmware', minWidth: 110 },
    { key: 'appVersion', label: 'App', minWidth: 100 },
    { key: 'network', label: 'Network', minWidth: 120 },
  ];

  protected readonly rowActions: TableAction<PosDevice>[] = [
    {
      id: 'activate',
      label: 'Activate device',
      icon: 'power_settings_new',
      tone: 'success',
      primary: true,
      permissions: [PERMISSIONS.retailers.activateDevice],
      visible: (row) => row.status === PosDeviceStatus.PendingActivation,
    },
    {
      id: 'qr',
      label: 'Assign new QR code',
      icon: 'qr_code_2',
      permissions: [PERMISSIONS.retailers.activateDevice],
    },
    {
      id: 'maintenance',
      label: 'Mark for maintenance',
      icon: 'build',
      tone: 'info',
      permissions: [PERMISSIONS.retailers.devices],
      visible: (row) => row.status !== PosDeviceStatus.Maintenance,
    },
    {
      id: 'block',
      label: 'Block device',
      icon: 'block',
      tone: 'danger',
      permissions: [PERMISSIONS.retailers.devices],
      visible: (row) => row.status !== PosDeviceStatus.Blocked,
      divider: true,
      confirm: {
        title: 'Block this terminal?',
        message: 'The device will be unable to sell or validate tickets until it is unblocked.',
        confirmLabel: 'Block device',
        tone: 'danger',
      },
    },
    {
      id: 'retailer',
      label: 'Open retailer',
      icon: 'storefront',
      permissions: [PERMISSIONS.retailers.view],
    },
  ];

  protected readonly bulkActions = [
    {
      id: 'activate',
      label: 'Activate',
      icon: 'power_settings_new',
      tone: 'success' as const,
      permissions: [PERMISSIONS.retailers.activateDevice],
      confirm: {
        title: 'Activate selected terminals?',
        message: '{count} terminal(s) will be able to sell immediately.',
        confirmLabel: 'Activate',
        tone: 'primary' as const,
      },
    },
    {
      id: 'maintenance',
      label: 'Mark maintenance',
      icon: 'build',
      tone: 'info' as const,
      permissions: [PERMISSIONS.retailers.devices],
    },
  ];

  constructor() {
    super();
    this.initialise();
    this.loadSummary();
  }

  protected fetch(query: PageQuery): Observable<Page<PosDevice>> {
    return this.repository.devices(query);
  }

  private loadSummary(): void {
    this.repository.deviceStatistics().subscribe((metrics) => this.summary.set(metrics));
  }

  protected refreshAll(): void {
    this.reload();
    this.loadSummary();
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/retailers']);
    }
  }

  protected onRowAction(event: TableActionEvent<PosDevice>): void {
    const { action, row } = event;

    switch (action) {
      case 'activate':
        this.repository.activateDevice(row.id).subscribe(() => {
          this.toast.success('Terminal activated', row.serialNumber);
          this.refreshAll();
        });
        break;
      case 'qr':
        this.repository.assignQr(row.id).subscribe((device) => {
          this.toast.success('New QR code assigned', device.qrCode);
          this.reload();
        });
        break;
      case 'maintenance':
        this.repository.setDeviceStatus(row.id, PosDeviceStatus.Maintenance).subscribe(() => {
          this.toast.info('Marked for maintenance', row.serialNumber);
          this.refreshAll();
        });
        break;
      case 'block':
        this.repository.setDeviceStatus(row.id, PosDeviceStatus.Blocked).subscribe(() => {
          this.toast.success('Terminal blocked', row.serialNumber);
          this.refreshAll();
        });
        break;
      case 'retailer':
        if (row.retailerId) {
          void this.router.navigate(['/retailers/details', row.retailerId]);
        }
        break;
      default:
        break;
    }
  }

  protected onBulkAction(event: BulkActionEvent<PosDevice>): void {
    const status = event.action === 'activate' ? PosDeviceStatus.Active : PosDeviceStatus.Maintenance;

    // Each terminal is updated individually so per-device rules still apply.
    let completed = 0;
    for (const row of event.rows) {
      this.repository.setDeviceStatus(row.id, status).subscribe(() => {
        completed++;
        if (completed === event.rows.length) {
          this.toast.success(`${completed} terminal(s) updated`);
          this.refreshAll();
        }
      });
    }
  }
}
