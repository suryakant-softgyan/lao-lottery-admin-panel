import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from '@core/authentication/auth.service';
import { PermissionService } from '@core/authentication/permission.service';
import { PERMISSIONS } from '@core/constants/permission.constants';
import {
  CLAIM_STATUS_MAP,
  LOTTERY_TYPE_MAP,
  TICKET_CHANNEL_MAP,
  TICKET_STATUS_MAP,
} from '@core/constants/status-maps.constants';
import { TicketStatus } from '@core/enums';
import type { Ticket, TimelineEvent } from '@core/models';
import { BreadcrumbService } from '@core/services/breadcrumb.service';
import { ConfirmService } from '@core/services/confirm.service';
import { LayoutService } from '@core/services/layout.service';
import { ToastService } from '@core/services/toast.service';
import { humanise } from '@core/utilities/format.util';
import { ActivityTimeline } from '@shared/components/activity-timeline/activity-timeline';
import { InfoList, type InfoItem } from '@shared/components/info-list/info-list';
import { PageHeader, type PageHeaderAction } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { CurrencyPipe, DatePipe } from '@shared/pipes/format.pipes';
import { TicketRepository } from '../data/ticket.repository';

/** Ticket record with a printable stub, bet lines and full lifecycle history. */
@Component({
  selector: 'll-ticket-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    PageHeader,
    InfoList,
    ActivityTimeline,
    StatusBadge,
    Skeleton,
    StatePanel,
    CurrencyPipe,
    DatePipe,
  ],
  templateUrl: './ticket-detail.html',
  styleUrl: './ticket-detail.scss',
})
export class TicketDetail {
  private readonly repository = inject(TicketRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly breadcrumb = inject(BreadcrumbService);
  private readonly layout = inject(LayoutService);
  private readonly auth = inject(AuthService);
  protected readonly permissions = inject(PermissionService);

  protected readonly statusMap = TICKET_STATUS_MAP;
  protected readonly claimMap = CLAIM_STATUS_MAP;
  protected readonly channelMap = TICKET_CHANNEL_MAP;
  protected readonly typeMap = LOTTERY_TYPE_MAP;

  protected readonly ticket = signal<Ticket | null>(null);
  protected readonly timeline = signal<TimelineEvent[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly ticketId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly purchaseItems = computed<InfoItem[]>(() => {
    const ticket = this.ticket();
    if (!ticket) {
      return [];
    }
    return [
      { label: 'Ticket number', value: ticket.ticketNumber, icon: 'confirmation_number', mono: true },
      { label: 'Serial', value: ticket.serialNumber, icon: 'tag', mono: true },
      { label: 'Barcode', value: ticket.barcode, icon: 'barcode', mono: true },
      { label: 'Lottery', value: ticket.lotteryName, icon: 'casino' },
      {
        label: 'Draw',
        value: ticket.drawCode,
        icon: 'stadia_controller',
        route: ['/draws/details', ticket.drawId],
        mono: true,
      },
      { label: 'Channel', value: ticket.channel, icon: 'hub', badgeMap: TICKET_CHANNEL_MAP },
      { label: 'Status', value: ticket.status, icon: 'flag', badgeMap: TICKET_STATUS_MAP },
      { label: 'Claim status', value: ticket.claimStatus, icon: 'redeem', badgeMap: CLAIM_STATUS_MAP },
      { label: 'Purchased', value: ticket.purchasedAt.slice(0, 16).replace('T', ' '), icon: 'schedule' },
      { label: 'Claim expires', value: ticket.expiresAt.slice(0, 10), icon: 'event_busy' },
    ];
  });

  protected readonly partyItems = computed<InfoItem[]>(() => {
    const ticket = this.ticket();
    if (!ticket) {
      return [];
    }
    return [
      { label: 'Customer', value: ticket.customerName, icon: 'person' },
      { label: 'Phone', value: ticket.customerPhone, icon: 'phone' },
      {
        label: 'Retailer',
        value: ticket.retailerName,
        icon: 'storefront',
        route: ticket.retailerId ? ['/retailers/details', ticket.retailerId] : undefined,
      },
      {
        label: 'Agent',
        value: ticket.agentName,
        icon: 'handshake',
        route: ticket.agentId ? ['/agents/details', ticket.agentId] : undefined,
      },
      { label: 'Province', value: ticket.province, icon: 'location_on' },
      { label: 'Device', value: ticket.deviceId, icon: 'point_of_sale', mono: true },
      { label: 'Validated by', value: ticket.validatedBy, icon: 'verified' },
      { label: 'Paid to', value: ticket.claimedBy, icon: 'paid' },
    ];
  });

  protected readonly headerActions = computed<PageHeaderAction[]>(() => {
    const ticket = this.ticket();
    const actions: PageHeaderAction[] = [
      { id: 'back', label: 'Back', icon: 'arrow_back', variant: 'secondary' },
      { id: 'print', label: 'Print', icon: 'print', variant: 'secondary' },
    ];
    if (ticket?.status === TicketStatus.Winning && this.permissions.has(PERMISSIONS.tickets.payout)) {
      actions.push({ id: 'payout', label: 'Pay prize', icon: 'paid', variant: 'primary' });
    }
    return actions;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.repository.getById(this.ticketId).subscribe({
      next: (ticket) => {
        this.ticket.set(ticket);
        this.breadcrumb.setDynamicLabel(ticket.ticketNumber);
        this.loading.set(false);
        this.repository.timeline(ticket).subscribe((events) => this.timeline.set(events));
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('This ticket could not be found.');
      },
    });
  }

  protected humanise(value: string): string {
    return humanise(value);
  }

  protected onHeaderAction(action: string): void {
    const ticket = this.ticket();

    switch (action) {
      case 'back':
        void this.router.navigate(['/tickets']);
        break;
      case 'print':
        this.layout.print();
        break;
      case 'payout':
        if (!ticket) {
          return;
        }
        this.confirm
          .ask({
            title: 'Pay this prize?',
            message: `${ticket.customerName} will be paid ${ticket.netPayout.toLocaleString()} ₭.`,
            detail: `Gross ${ticket.totalPayout.toLocaleString()} ₭ less ${ticket.taxDeducted.toLocaleString()} ₭ tax.`,
            confirmLabel: 'Confirm payout',
            tone: 'success',
            icon: 'paid',
          })
          .subscribe((confirmed) => {
            if (confirmed) {
              this.repository
                .payout(ticket.id, this.auth.user()?.fullName ?? 'Counter')
                .subscribe((updated) => {
                  this.ticket.set(updated);
                  this.toast.success('Prize paid', updated.ticketNumber);
                });
            }
          });
        break;
      default:
        break;
    }
  }
}
