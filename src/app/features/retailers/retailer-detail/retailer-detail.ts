import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';

import { PermissionService } from '@core/authentication/permission.service';
import { PERMISSIONS } from '@core/constants/permission.constants';
import {
  KYC_STATUS_MAP,
  POS_DEVICE_STATUS_MAP,
  RETAILER_STATUS_MAP,
} from '@core/constants/status-maps.constants';
import { RetailerStatus } from '@core/enums';
import type { PosDevice, Retailer } from '@core/models';
import { BreadcrumbService } from '@core/services/breadcrumb.service';
import { ConfirmService } from '@core/services/confirm.service';
import { ToastService } from '@core/services/toast.service';
import { humanise } from '@core/utilities/format.util';
import { Avatar } from '@shared/components/avatar/avatar';
import { InfoList, type InfoItem } from '@shared/components/info-list/info-list';
import { PageHeader, type PageHeaderAction } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { CurrencyPipe, DatePipe, RelativePipe } from '@shared/pipes/format.pipes';
import { RetailerRepository } from '../data/retailer.repository';

/** Retail outlet detail: profile, terminals, trading position and location. */
@Component({
  selector: 'll-retailer-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatTabsModule,
    PageHeader,
    Avatar,
    InfoList,
    StatusBadge,
    Skeleton,
    StatePanel,
    CurrencyPipe,
    DatePipe,
    RelativePipe,
  ],
  templateUrl: './retailer-detail.html',
  styleUrl: './retailer-detail.scss',
})
export class RetailerDetail {
  private readonly repository = inject(RetailerRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly breadcrumb = inject(BreadcrumbService);
  protected readonly permissions = inject(PermissionService);

  protected readonly statusMap = RETAILER_STATUS_MAP;
  protected readonly kycMap = KYC_STATUS_MAP;
  protected readonly deviceStatusMap = POS_DEVICE_STATUS_MAP;

  protected readonly retailer = signal<Retailer | null>(null);
  protected readonly devices = signal<PosDevice[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly retailerId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly profileItems = computed<InfoItem[]>(() => {
    const shop = this.retailer();
    if (!shop) {
      return [];
    }
    return [
      { label: 'Outlet code', value: shop.code, icon: 'tag', mono: true },
      { label: 'Owner', value: shop.ownerName, icon: 'person' },
      { label: 'Shop type', value: humanise(shop.shopType), icon: 'store' },
      { label: 'Status', value: shop.status, icon: 'flag', badgeMap: RETAILER_STATUS_MAP },
      { label: 'KYC', value: shop.kycStatus, icon: 'verified_user', badgeMap: KYC_STATUS_MAP },
      { label: 'Phone', value: shop.contact.phone, icon: 'phone' },
      { label: 'Email', value: shop.contact.email, icon: 'mail' },
      {
        label: 'Agent',
        value: shop.agentName,
        icon: 'handshake',
        route: ['/agents/details', shop.agentId],
      },
      { label: 'Opening hours', value: `${shop.openingTime} – ${shop.closingTime}`, icon: 'schedule' },
      { label: 'Licence', value: shop.licenceNumber, icon: 'workspace_premium', mono: true },
      { label: 'Licence expiry', value: shop.licenceExpiry, icon: 'event_busy' },
      {
        label: 'Address',
        value: [shop.address.line1, shop.district, shop.province].filter(Boolean).join(', '),
        icon: 'home',
        wide: true,
      },
      {
        label: 'Coordinates',
        value: `${shop.latitude}, ${shop.longitude}`,
        icon: 'my_location',
        mono: true,
        wide: true,
      },
    ];
  });

  protected readonly tradingItems = computed<InfoItem[]>(() => {
    const shop = this.retailer();
    if (!shop) {
      return [];
    }
    return [
      { label: 'Commission rate', value: `${shop.commissionRate}%`, icon: 'percent' },
      { label: 'Credit limit', value: shop.creditLimit.toLocaleString(), icon: 'credit_score' },
      { label: 'Wallet balance', value: shop.walletBalance.toLocaleString(), icon: 'account_balance_wallet' },
      { label: 'Terminals', value: shop.deviceCount, icon: 'point_of_sale' },
      { label: 'Tickets today', value: shop.ticketsToday.toLocaleString(), icon: 'confirmation_number' },
      { label: 'Sales today', value: shop.salesToday.toLocaleString(), icon: 'payments' },
      { label: 'Sales this month', value: shop.salesMonth.toLocaleString(), icon: 'calendar_month' },
      { label: 'Rating', value: `${shop.rating} ★`, icon: 'star' },
    ];
  });

  protected readonly headerActions = computed<PageHeaderAction[]>(() => {
    const shop = this.retailer();
    const actions: PageHeaderAction[] = [
      { id: 'back', label: 'Back', icon: 'arrow_back', variant: 'secondary' },
      { id: 'devices', label: 'Terminals', icon: 'point_of_sale', variant: 'secondary' },
    ];
    if (!shop) {
      return actions;
    }
    if (
      shop.status === RetailerStatus.PendingApproval &&
      this.permissions.has(PERMISSIONS.retailers.approve)
    ) {
      actions.push({ id: 'approve', label: 'Approve', icon: 'verified', variant: 'primary' });
    } else if (shop.status === RetailerStatus.Active && this.permissions.has(PERMISSIONS.retailers.update)) {
      actions.push({ id: 'suspend', label: 'Suspend', icon: 'pause_circle', variant: 'primary' });
    }
    return actions;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.repository.getById(this.retailerId).subscribe({
      next: (retailer) => {
        this.retailer.set(retailer);
        this.breadcrumb.setDynamicLabel(retailer.shopName);
        this.loading.set(false);
        this.repository.devicesOf(retailer.id).subscribe((rows) => this.devices.set(rows));
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('This retail outlet could not be found.');
      },
    });
  }

  protected humanise(value: string): string {
    return humanise(value);
  }

  protected onHeaderAction(action: string): void {
    const shop = this.retailer();
    if (!shop) {
      return;
    }

    switch (action) {
      case 'back':
        void this.router.navigate(['/retailers']);
        break;
      case 'devices':
        void this.router.navigate(['/retailers/devices'], { queryParams: { retailerId: shop.id } });
        break;
      case 'approve':
        this.confirm.confirmApproval('retail outlet', shop.shopName).subscribe((result) => {
          if (result.confirmed) {
            this.repository.approve(shop.id, result.reason).subscribe((updated) => {
              this.retailer.set(updated);
              this.toast.success('Outlet approved', updated.shopName);
            });
          }
        });
        break;
      case 'suspend':
        this.confirm
          .open({
            title: 'Suspend this outlet?',
            message: `${shop.shopName} will stop selling immediately across all ${shop.deviceCount} terminal(s).`,
            confirmLabel: 'Suspend',
            tone: 'warning',
            icon: 'pause_circle',
            requireReason: true,
            reasonLabel: 'Reason (recorded in the audit trail)',
          })
          .subscribe((result) => {
            if (result.confirmed && result.reason) {
              this.repository.suspend(shop.id, result.reason).subscribe((updated) => {
                this.retailer.set(updated);
                this.toast.success('Outlet suspended', updated.shopName);
              });
            }
          });
        break;
      default:
        break;
    }
  }
}
