import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { PosDeviceStatus, RetailerStatus } from '@core/enums';
import { mockDataset } from '@core/mock/dataset';
import type { Page, PageQuery, PosDevice, Retailer, StatMetric } from '@core/models';
import { BaseRepository } from '@core/services/base-repository';
import { applyQuery } from '@core/utilities/query.util';
import { groupBy, sumBy } from '@core/utilities/object.util';

/** Province-level rollup used by the coverage map. */
export interface ProvinceCoverage {
  province: string;
  retailers: number;
  active: number;
  devices: number;
  salesToday: number;
  ticketsToday: number;
  /** Share of the national retailer count, 0–100. */
  share: number;
}

/** Retail network repository: shops, POS terminals and geographic coverage. */
@Injectable({ providedIn: 'root' })
export class RetailerRepository extends BaseRepository<Retailer> {
  protected readonly resourcePath = 'retailers';

  protected override queryOptions = {
    searchFields: ['shopName', 'code', 'ownerName', 'contact.phone', 'province', 'district', 'agentName'],
    dateField: 'createdAt',
  };

  protected seed(): Retailer[] {
    return mockDataset.retailers;
  }

  approve(id: string, remarks?: string): Observable<Retailer> {
    return this.patch(id, { status: RetailerStatus.Active, notes: remarks } as Partial<Retailer>);
  }

  suspend(id: string, reason: string): Observable<Retailer> {
    return this.patch(id, { status: RetailerStatus.Suspended, notes: reason } as Partial<Retailer>);
  }

  close(id: string, reason: string): Observable<Retailer> {
    return this.patch(id, { status: RetailerStatus.Closed, notes: reason } as Partial<Retailer>);
  }

  // ------------------------------------------------------------------ devices

  /** Paged POS terminal list across the whole network. */
  devices(query: PageQuery): Observable<Page<PosDevice>> {
    return this.backend.respond(() =>
      applyQuery(mockDataset.devices, query, {
        searchFields: ['serialNumber', 'imei', 'retailerName', 'model', 'qrCode', 'simNumber'],
        dateField: 'createdAt',
      }),
    );
  }

  deviceById(id: string): Observable<PosDevice> {
    const device = mockDataset.devices.find((item) => item.id === id);
    return device ? this.backend.respond(() => device) : this.backend.notFound<PosDevice>('Device', id);
  }

  /** Activation flips a pending terminal live and stamps the activation time. */
  activateDevice(id: string): Observable<PosDevice> {
    const index = mockDataset.devices.findIndex((device) => device.id === id);
    if (index === -1) {
      return this.backend.notFound<PosDevice>('Device', id);
    }
    return this.backend.respond(() => {
      const updated: PosDevice = {
        ...(mockDataset.devices[index] as PosDevice),
        status: PosDeviceStatus.Active,
        activatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockDataset.devices[index] = updated;
      return updated;
    });
  }

  setDeviceStatus(id: string, status: PosDeviceStatus): Observable<PosDevice> {
    const index = mockDataset.devices.findIndex((device) => device.id === id);
    if (index === -1) {
      return this.backend.notFound<PosDevice>('Device', id);
    }
    return this.backend.respond(() => {
      const updated: PosDevice = {
        ...(mockDataset.devices[index] as PosDevice),
        status,
        updatedAt: new Date().toISOString(),
      };
      mockDataset.devices[index] = updated;
      return updated;
    });
  }

  /** Assigns a fresh QR payload to a terminal. */
  assignQr(id: string): Observable<PosDevice> {
    const index = mockDataset.devices.findIndex((device) => device.id === id);
    if (index === -1) {
      return this.backend.notFound<PosDevice>('Device', id);
    }
    return this.backend.respond(() => {
      const updated: PosDevice = {
        ...(mockDataset.devices[index] as PosDevice),
        qrCode: `LLQR${Math.floor(100000000000 + Math.random() * 899999999999)}`,
        updatedAt: new Date().toISOString(),
      };
      mockDataset.devices[index] = updated;
      return updated;
    });
  }

  devicesOf(retailerId: string): Observable<PosDevice[]> {
    return this.backend.respond(() =>
      mockDataset.devices.filter((device) => device.retailerId === retailerId),
    );
  }

  // ----------------------------------------------------------------- coverage

  /** Aggregates the network by province for the coverage view. */
  coverage(): Observable<ProvinceCoverage[]> {
    return this.backend.respond(() => {
      const retailers = this.records;
      const grouped = groupBy(retailers, (retailer) => retailer.province);
      const total = retailers.length || 1;

      return [...grouped.entries()]
        .map(([province, rows]) => ({
          province,
          retailers: rows.length,
          active: rows.filter((row) => row.status === RetailerStatus.Active).length,
          devices: sumBy(rows, (row) => row.deviceCount),
          salesToday: sumBy(rows, (row) => row.salesToday),
          ticketsToday: sumBy(rows, (row) => row.ticketsToday),
          share: Math.round((rows.length / total) * 1000) / 10,
        }))
        .sort((a, b) => b.retailers - a.retailers);
    });
  }

  statistics(): Observable<StatMetric[]> {
    return this.backend.respond(() => {
      const retailers = this.records;
      const devices = mockDataset.devices;

      return [
        {
          id: 'total',
          label: 'Retail outlets',
          value: retailers.length,
          icon: 'storefront',
          tone: 'primary',
        },
        {
          id: 'active',
          label: 'Active',
          value: retailers.filter((row) => row.status === RetailerStatus.Active).length,
          icon: 'check_circle',
          tone: 'success',
        },
        {
          id: 'pending',
          label: 'Pending approval',
          value: retailers.filter((row) => row.status === RetailerStatus.PendingApproval).length,
          icon: 'pending',
          tone: 'warning',
        },
        { id: 'devices', label: 'POS terminals', value: devices.length, icon: 'point_of_sale', tone: 'info' },
        {
          id: 'faulty',
          label: 'Faulty devices',
          value: devices.filter((device) => device.status === PosDeviceStatus.Faulty).length,
          icon: 'error',
          tone: 'danger',
        },
        {
          id: 'sales',
          label: 'Sales today',
          value: sumBy(retailers, (row) => row.salesToday),
          icon: 'payments',
          tone: 'primary',
        },
      ];
    });
  }

  /** Device statistics for the POS screen tiles. */
  deviceStatistics(): Observable<StatMetric[]> {
    return this.backend.respond(() => {
      const devices = mockDataset.devices;
      const count = (status: PosDeviceStatus): number =>
        devices.filter((device) => device.status === status).length;

      return [
        {
          id: 'total',
          label: 'Total terminals',
          value: devices.length,
          icon: 'point_of_sale',
          tone: 'primary',
        },
        {
          id: 'active',
          label: 'Active',
          value: count(PosDeviceStatus.Active),
          icon: 'check_circle',
          tone: 'success',
        },
        {
          id: 'pending',
          label: 'Awaiting activation',
          value: count(PosDeviceStatus.PendingActivation),
          icon: 'pending',
          tone: 'warning',
        },
        {
          id: 'maintenance',
          label: 'In maintenance',
          value: count(PosDeviceStatus.Maintenance),
          icon: 'build',
          tone: 'info',
        },
        {
          id: 'faulty',
          label: 'Faulty',
          value: count(PosDeviceStatus.Faulty),
          icon: 'error',
          tone: 'danger',
        },
        {
          id: 'tickets',
          label: 'Tickets today',
          value: sumBy(devices, (device) => device.ticketsToday),
          icon: 'confirmation_number',
          tone: 'neutral',
        },
      ];
    });
  }
}
