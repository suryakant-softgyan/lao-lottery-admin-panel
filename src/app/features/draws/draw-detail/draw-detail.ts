import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';

import { AuthService } from '@core/authentication/auth.service';
import { PermissionService } from '@core/authentication/permission.service';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { DRAW_MODE_MAP, DRAW_STATUS_MAP, LOTTERY_TYPE_MAP } from '@core/constants/status-maps.constants';
import { DrawStatus } from '@core/enums';
import type { Draw, TimelineEvent } from '@core/models';
import { BreadcrumbService } from '@core/services/breadcrumb.service';
import { ConfirmService } from '@core/services/confirm.service';
import { ThemeService } from '@core/services/theme.service';
import { ToastService } from '@core/services/toast.service';
import { formatCurrency, humanise } from '@core/utilities/format.util';
import { ActivityTimeline } from '@shared/components/activity-timeline/activity-timeline';
import { ChartComponent } from '@shared/components/chart/chart';
import { Countdown } from '@shared/components/countdown/countdown';
import { InfoList, type InfoItem } from '@shared/components/info-list/info-list';
import { PageHeader, type PageHeaderAction } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { CurrencyPipe } from '@shared/pipes/format.pipes';
import { DrawRepository } from '../data/draw.repository';

/** Draw detail: result, financials, verification record and lifecycle history. */
@Component({
  selector: 'll-draw-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    MatTabsModule,
    PageHeader,
    Countdown,
    InfoList,
    ChartComponent,
    ActivityTimeline,
    StatusBadge,
    Skeleton,
    StatePanel,
    CurrencyPipe,
  ],
  templateUrl: './draw-detail.html',
  styleUrl: './draw-detail.scss',
})
export class DrawDetail {
  private readonly repository = inject(DrawRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly breadcrumb = inject(BreadcrumbService);
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  protected readonly permissions = inject(PermissionService);

  protected readonly statusMap = DRAW_STATUS_MAP;
  protected readonly modeMap = DRAW_MODE_MAP;
  protected readonly typeMap = LOTTERY_TYPE_MAP;
  protected readonly DrawStatus = DrawStatus;

  protected readonly draw = signal<Draw | null>(null);
  protected readonly timeline = signal<TimelineEvent[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly drawId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly summaryItems = computed<InfoItem[]>(() => {
    const draw = this.draw();
    if (!draw) {
      return [];
    }
    return [
      { label: 'Draw code', value: draw.code, icon: 'tag', mono: true },
      { label: 'Draw number', value: `#${draw.drawNumber}`, icon: 'numbers' },
      { label: 'Product', value: draw.lotteryType, icon: 'casino', badgeMap: LOTTERY_TYPE_MAP },
      { label: 'Status', value: draw.status, icon: 'flag', badgeMap: DRAW_STATUS_MAP },
      { label: 'Mode', value: draw.mode, icon: 'smart_toy', badgeMap: DRAW_MODE_MAP },
      { label: 'Sales open', value: draw.salesOpenAt.slice(0, 16).replace('T', ' '), icon: 'lock_open' },
      { label: 'Sales close', value: draw.salesCloseAt.slice(0, 16).replace('T', ' '), icon: 'lock' },
      { label: 'Scheduled', value: draw.scheduledAt.slice(0, 16).replace('T', ' '), icon: 'event' },
      { label: 'Drawn at', value: draw.drawnAt?.slice(0, 16).replace('T', ' '), icon: 'casino' },
      { label: 'Published at', value: draw.publishedAt?.slice(0, 16).replace('T', ' '), icon: 'campaign' },
    ];
  });

  protected readonly financialItems = computed<InfoItem[]>(() => {
    const draw = this.draw();
    if (!draw) {
      return [];
    }
    const money = (value: number): string => formatCurrency(value, this.theme.regional().currency);
    return [
      { label: 'Tickets sold', value: draw.ticketsSold.toLocaleString(), icon: 'confirmation_number' },
      { label: 'Sales value', value: money(draw.salesAmount), icon: 'payments' },
      { label: 'Winners', value: draw.winnerCount.toLocaleString(), icon: 'emoji_events' },
      { label: 'Prize payout', value: money(draw.payoutAmount), icon: 'redeem' },
      { label: 'Commission paid', value: money(draw.commissionPaid), icon: 'percent' },
      { label: 'Tax collected', value: money(draw.taxCollected), icon: 'request_quote' },
      { label: 'Gross profit', value: money(draw.grossProfit), icon: 'savings' },
      { label: 'Jackpot', value: money(draw.jackpotAmount), icon: 'stars' },
      { label: 'Rollover', value: money(draw.rolloverAmount), icon: 'repeat' },
    ];
  });

  protected readonly verificationItems = computed<InfoItem[]>(() => {
    const draw = this.draw();
    if (!draw) {
      return [];
    }
    return [
      { label: 'Verified by', value: draw.verification.verifiedBy, icon: 'how_to_reg' },
      {
        label: 'Verified at',
        value: draw.verification.verifiedAt?.slice(0, 16).replace('T', ' '),
        icon: 'schedule',
      },
      { label: 'Approved by', value: draw.verification.approvedBy, icon: 'verified_user' },
      {
        label: 'Approved at',
        value: draw.verification.approvedAt?.slice(0, 16).replace('T', ' '),
        icon: 'schedule',
      },
      { label: 'Checksum', value: draw.verification.checksum, icon: 'fingerprint', mono: true, wide: true },
      {
        label: 'Witnesses',
        value: draw.verification.witnessNames.join(', '),
        icon: 'groups',
        wide: true,
      },
      { label: 'Remarks', value: draw.verification.remarks, icon: 'notes', wide: true },
    ];
  });

  protected readonly payoutLabels = computed(() =>
    (this.draw()?.winningNumbers ?? []).map((tier) => tier.tierName),
  );

  protected readonly payoutSeries = computed(() => [
    {
      label: 'Total payout',
      data: (this.draw()?.winningNumbers ?? []).map((tier) => tier.totalPayout),
    },
  ]);

  protected readonly headerActions = computed<PageHeaderAction[]>(() => {
    const draw = this.draw();
    const actions: PageHeaderAction[] = [
      { id: 'back', label: 'Back', icon: 'arrow_back', variant: 'secondary' },
      { id: 'tickets', label: 'Tickets', icon: 'confirmation_number', variant: 'secondary' },
    ];
    if (!draw) {
      return actions;
    }
    if (draw.status === DrawStatus.PendingVerification && this.permissions.has(PERMISSIONS.draws.publish)) {
      actions.push({ id: 'publish', label: 'Publish', icon: 'campaign', variant: 'primary' });
    } else if (draw.status === DrawStatus.Published && this.permissions.has(PERMISSIONS.draws.rollback)) {
      actions.push({ id: 'rollback', label: 'Roll back', icon: 'undo', variant: 'primary' });
    }
    return actions;
  });

  protected readonly currencyFormatter = (value: number): string =>
    formatCurrency(value, this.theme.regional().currency, this.theme.regional().locale, { compact: true });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.repository.getById(this.drawId).subscribe({
      next: (draw) => {
        this.draw.set(draw);
        this.breadcrumb.setDynamicLabel(draw.code);
        this.loading.set(false);
        this.repository.timeline(draw).subscribe((events) => this.timeline.set(events));
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('This draw could not be found.');
      },
    });
  }

  protected humanise(value: string): string {
    return humanise(value);
  }

  protected onHeaderAction(action: string): void {
    const draw = this.draw();
    if (!draw) {
      return;
    }

    switch (action) {
      case 'back':
        void this.router.navigate(['/draws']);
        break;
      case 'tickets':
        void this.router.navigate(['/tickets'], { queryParams: { drawId: draw.id } });
        break;
      case 'publish':
        this.confirm
          .ask({
            title: 'Publish this result?',
            message: `Results for ${draw.code} become visible to customers and prize payouts are released.`,
            confirmLabel: 'Publish result',
            tone: 'primary',
            icon: 'campaign',
          })
          .subscribe((confirmed) => {
            if (confirmed) {
              this.repository
                .publish(draw.id, this.auth.user()?.fullName ?? 'Operator')
                .subscribe((updated) => {
                  this.draw.set(updated);
                  this.toast.success('Result published', updated.code);
                });
            }
          });
        break;
      case 'rollback':
        this.confirm
          .open({
            title: 'Roll back this published draw?',
            message:
              'Published results will be withdrawn and any payouts already released must be recovered manually.',
            confirmLabel: 'Roll back draw',
            tone: 'danger',
            icon: 'undo',
            requireTypedConfirmation: 'ROLLBACK',
            requireReason: true,
            reasonLabel: 'Reason for rollback',
          })
          .subscribe((result) => {
            if (result.confirmed && result.reason) {
              this.repository.rollback(draw.id, result.reason).subscribe((updated) => {
                this.draw.set(updated);
                this.toast.warning('Draw rolled back', updated.code);
              });
            }
          });
        break;
      default:
        break;
    }
  }
}
