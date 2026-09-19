import { Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';

import { num } from '@core/api/live.util';
import { PLACEHOLDER } from '@core/constants/app.constants';

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
    if (this.live) {
      return this.http.post<unknown>(`${this.baseUrl}/${id}/approval`, { approved: true, remarks }).pipe(map((row) => this.fromApi(row)));
    }
    return this.patch(id, { status: RetailerStatus.Active, notes: remarks } as Partial<Retailer>);
  }

  suspend(id: string, reason: string): Observable<Retailer> {
    if (this.live) {
      return this.liveStatus(id, RetailerStatus.Suspended, reason);
    }
    return this.patch(id, { status: RetailerStatus.Suspended, notes: reason } as Partial<Retailer>);
  }

  close(id: string, reason: string): Observable<Retailer> {
    if (this.live) {
      return this.liveStatus(id, RetailerStatus.Closed, reason);
    }
    return this.patch(id, { status: RetailerStatus.Closed, notes: reason } as Partial<Retailer>);
  }

  // ------------------------------------------------------------------ devices

  /** Paged POS terminal list across the whole network. */
  devices(query: PageQuery): Observable<Page<PosDevice>> {
    if (this.live) {
      return this.livePage("admin/pos-devices", query, (row) => this.deviceFromApi(row));
    }
    return this.backend.respond(() =>
      applyQuery(mockDataset.devices, query, {
        searchFields: ['serialNumber', 'imei', 'retailerName', 'model', 'qrCode', 'simNumber'],
        dateField: 'createdAt',
      }),
    );
  }

  deviceById(id: string): Observable<PosDevice> {
    if (this.live) {
      return this.livePage("admin/pos-devices", { page: 0, size: 200 }, (row) => this.deviceFromApi(row)).pipe(map((page) => this.requireDevice(page.content, id)));
    }
    const device = mockDataset.devices.find((item) => item.id === id);
    return device ? this.backend.respond(() => device) : this.backend.notFound<PosDevice>('Device', id);
  }

  /** Activation flips a pending terminal live and stamps the activation time. */
  activateDevice(id: string): Observable<PosDevice> {
    if (this.live) {
      return this.liveDeviceStatus(id, PosDeviceStatus.Active);
    }
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
    if (this.live) {
      return this.liveDeviceStatus(id, status);
    }
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
    if (this.live) {
      return this.http.post<unknown>(this.api(`admin/pos-devices/${id}/qr`), {}).pipe(map((row) => this.deviceFromApi(row)));
    }
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
    if (this.live) {
      return this.livePage("admin/pos-devices", { page: 0, size: 100 }, (row) => this.deviceFromApi(row), { retailerId }).pipe(map((page) => page.content));
    }
    return this.backend.respond(() =>
      mockDataset.devices.filter((device) => device.retailerId === retailerId),
    );
  }

  // ----------------------------------------------------------------- coverage

  /** Aggregates the network by province for the coverage view. */
  coverage(): Observable<ProvinceCoverage[]> {
    if (this.live) {
      return this.liveCoverage();
    }
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
    if (this.live) {
      return this.liveStatistics();
    }
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
    if (this.live) {
      return this.liveDeviceStatistics();
    }
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
  // =====================================================================================
  // Live API implementation
  // =====================================================================================

  private liveStats: Record<string, Record<string, number>> = {};

  private withStats<R>(source: () => Observable<R>): Observable<R> {
    return this.http
      .get<{ retailers?: Record<string, number | string>[] }>(this.api('admin/stats/network'), {
        headers: { 'X-Quiet': '1' },
      })
      .pipe(
        catchError(() => of({ retailers: [] as Record<string, number | string>[] })),
        tap((stats) => {
          this.liveStats = {};
          (stats.retailers ?? []).forEach(
            (row) => (this.liveStats[String(row['retailerId'])] = row as Record<string, number>),
          );
        }),
        switchMap(() => source()),
      );
  }

  override list(query: PageQuery): Observable<Page<Retailer>> {
    return this.live ? this.withStats(() => super.list(query)) : super.list(query);
  }

  override all(): Observable<Retailer[]> {
    return this.live ? this.withStats(() => super.all()) : super.all();
  }

  protected override fromApi(record: unknown): Retailer {
    const api = record as Record<string, unknown>;
    const stats = this.liveStats[String(api['id'])] ?? {};
    const [openingTime, closingTime] = String(api['openingHours'] ?? '08:00-20:00').split('-');
    return {
      id: String(api['id']),
      code: String(api['code'] ?? ''),
      shopName: String(api['shopName'] ?? ''),
      ownerName: String(api['ownerName'] ?? ''),
      shopType: api['shopType'] as Retailer['shopType'],
      status: api['status'] as Retailer['status'],
      kycStatus: api['kycStatus'] as Retailer['kycStatus'],
      agentId: String(api['agentId'] ?? ''),
      agentName: String(api['agentName'] ?? '—'),
      contact: { phone: String(api['phone'] ?? ''), email: String(api['email'] ?? '') },
      address: {
        line1: String(api['address'] ?? ''),
        village: (api['village'] as string | undefined) ?? undefined,
        district: String(api['district'] ?? ''),
        province: String(api['province'] ?? ''),
        country: 'Lao PDR',
      },
      province: String(api['province'] ?? ''),
      district: String(api['district'] ?? ''),
      latitude: num(api['latitude']),
      longitude: num(api['longitude']),
      openingTime: (openingTime ?? '08:00').trim(),
      closingTime: (closingTime ?? '20:00').trim(),
      walletId: '',
      walletBalance: num(api['walletBalance']),
      creditLimit: 0,
      commissionRate: num(api['commissionPercent']),
      deviceCount: num(api['deviceCount']),
      devices: [],
      ticketsToday: num(stats['ticketsToday']),
      salesToday: num(stats['salesToday']),
      salesMonth: num(stats['salesMonth']),
      rating: 0,
      photoUrl: PLACEHOLDER.avatar(String(api['shopName'] ?? '')),
      licenceNumber: (api['licenceNumber'] as string | undefined) ?? undefined,
      tenantId: '',
      notes: (api['statusReason'] as string | undefined) ?? undefined,
      createdAt: String(api['createdAt'] ?? ''),
      createdBy: (api['createdBy'] as string | undefined) ?? undefined,
      updatedAt: (api['updatedAt'] as string | undefined) ?? undefined,
    };
  }

  protected override toApi(payload: Partial<Retailer>): unknown {
    return {
      shopName: payload.shopName,
      ownerName: payload.ownerName,
      agentId: payload.agentId || null,
      shopType: payload.shopType,
      phone: (payload.contact?.phone ?? '').replace(/[\s-]/g, ''),
      email: payload.contact?.email || null,
      province: payload.province ?? payload.address?.province,
      district: payload.district ?? payload.address?.district,
      village: payload.address?.village,
      address: payload.address?.line1,
      latitude: payload.latitude || null,
      longitude: payload.longitude || null,
      commissionPercent: payload.commissionRate,
      openingHours: payload.openingTime && payload.closingTime ? `${payload.openingTime}-${payload.closingTime}` : null,
      licenceNumber: payload.licenceNumber,
    };
  }

  override create(payload: Partial<Retailer>): Observable<Retailer> {
    if (!this.live) {
      return super.create(payload);
    }
    return this.http
      .post<{ entity: unknown }>(this.baseUrl, this.toApi(payload))
      .pipe(map((result) => this.fromApi(result.entity)));
  }

  /** Detail view also needs the shop's terminals. */
  override getById(id: string): Observable<Retailer> {
    if (!this.live) {
      return super.getById(id);
    }
    return this.withStats(() =>
      forkJoin({ retailer: this.http.get<unknown>(`${this.baseUrl}/${id}`), devices: this.devicesOf(id) }),
    ).pipe(map(({ retailer, devices }) => ({ ...this.fromApi(retailer), devices })));
  }

  private liveStatus(id: string, status: RetailerStatus, reason?: string): Observable<Retailer> {
    return this.http
      .patch<unknown>(`${this.baseUrl}/${id}/status`, { status, reason })
      .pipe(map((row) => this.fromApi(row)));
  }

  protected override livePatch(id: string, changes: Partial<Retailer>): Observable<Retailer> {
    if (changes.status) {
      return this.liveStatus(id, changes.status, changes.notes);
    }
    return this.getById(id).pipe(switchMap((retailer) => this.update(id, { ...retailer, ...changes })));
  }

  private deviceFromApi(record: unknown): PosDevice {
    const api = record as Record<string, unknown>;
    return {
      id: String(api['id']),
      serialNumber: String(api['serialNumber'] ?? ''),
      imei: '',
      model: (api['model'] ?? 'ANDROID_TABLET') as PosDevice['model'],
      status: api['status'] as PosDevice['status'],
      retailerId: (api['retailerId'] as string | undefined) ?? undefined,
      retailerName: (api['retailerName'] as string | undefined) ?? undefined,
      agentId: (api['agentId'] as string | undefined) ?? undefined,
      qrCode: (api['qrCode'] as string | undefined) ?? undefined,
      firmwareVersion: String(api['firmwareVersion'] ?? '—'),
      appVersion: String(api['appVersion'] ?? '—'),
      activatedAt: (api['activatedAt'] as string | undefined) ?? undefined,
      lastHeartbeatAt: (api['lastSeenAt'] as string | undefined) ?? undefined,
      batteryLevel: (api['batteryLevel'] as number | undefined) ?? undefined,
      simNumber: (api['simNumber'] as string | undefined) ?? undefined,
      ticketsToday: 0,
      salesToday: 0,
      latitude: (api['latitude'] as number | undefined) ?? undefined,
      longitude: (api['longitude'] as number | undefined) ?? undefined,
      tenantId: '',
      createdAt: String(api['createdAt'] ?? ''),
    };
  }

  private requireDevice(devices: PosDevice[], id: string): PosDevice {
    const device = devices.find((item) => item.id === id);
    if (!device) {
      throw new Error(`Device ${id} was not found.`);
    }
    return device;
  }

  private liveDeviceStatus(id: string, status: PosDeviceStatus): Observable<PosDevice> {
    return this.http
      .patch<unknown>(this.api(`admin/pos-devices/${id}/status`), { status, reason: 'Changed from the admin portal' })
      .pipe(map((row) => this.deviceFromApi(row)));
  }

  private liveCoverage(): Observable<ProvinceCoverage[]> {
    return this.all().pipe(
      map((retailers) => {
        const total = retailers.length || 1;
        return [...groupBy(retailers, (retailer) => retailer.province || 'UNKNOWN').entries()]
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
      }),
    );
  }

  private liveStatistics(): Observable<StatMetric[]> {
    return forkJoin({
      retailers: this.all(),
      devices: this.liveCount('admin/pos-devices'),
      faulty: this.liveCount('admin/pos-devices', { status: PosDeviceStatus.Faulty }),
    }).pipe(
      map(({ retailers, devices, faulty }) => [
        { id: 'total', label: 'Retail outlets', value: retailers.length, icon: 'store', tone: 'primary' as const },
        { id: 'active', label: 'Active', value: retailers.filter((r) => r.status === RetailerStatus.Active).length, icon: 'check_circle', tone: 'success' as const },
        { id: 'pending', label: 'Pending approval', value: retailers.filter((r) => r.status === RetailerStatus.PendingApproval).length, icon: 'hourglass_top', tone: 'warning' as const },
        { id: 'devices', label: 'POS terminals', value: devices, icon: 'point_of_sale', tone: 'info' as const },
        { id: 'faulty', label: 'Faulty devices', value: faulty, icon: 'report', tone: 'danger' as const },
        { id: 'sales', label: 'Sales today', value: sumBy(retailers, (r) => r.salesToday), icon: 'payments', tone: 'primary' as const },
      ]),
    );
  }

  private liveDeviceStatistics(): Observable<StatMetric[]> {
    const count = (status?: PosDeviceStatus): Observable<number> =>
      this.liveCount('admin/pos-devices', status ? { status } : {});
    return forkJoin({
      total: count(),
      active: count(PosDeviceStatus.Active),
      pending: count(PosDeviceStatus.PendingActivation),
      maintenance: count(PosDeviceStatus.Maintenance),
      faulty: count(PosDeviceStatus.Faulty),
      tickets: this.all().pipe(map((retailers) => sumBy(retailers, (r) => r.ticketsToday))),
    }).pipe(
      map((totals) => [
        { id: 'total', label: 'Total terminals', value: totals.total, icon: 'point_of_sale', tone: 'primary' as const },
        { id: 'active', label: 'Active', value: totals.active, icon: 'check_circle', tone: 'success' as const },
        { id: 'pending', label: 'Awaiting activation', value: totals.pending, icon: 'hourglass_top', tone: 'warning' as const },
        { id: 'maintenance', label: 'In maintenance', value: totals.maintenance, icon: 'build', tone: 'info' as const },
        { id: 'faulty', label: 'Faulty', value: totals.faulty, icon: 'report', tone: 'danger' as const },
        { id: 'tickets', label: 'Tickets today', value: totals.tickets, icon: 'confirmation_number', tone: 'primary' as const },
      ]),
    );
  }
}
