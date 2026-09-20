import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '@core/authentication/auth.service';
import { STORAGE_KEYS } from '@core/constants/app.constants';
import { FEATURE_FLAGS } from '@core/constants/feature-flags.constants';
import {
  CLAIM_STATUS_MAP,
  DRAW_STATUS_MAP,
  HEALTH_STATE_MAP,
  TICKET_STATUS_MAP,
  TRANSACTION_STATUS_MAP,
} from '@core/constants/status-maps.constants';
import { HealthState, Severity } from '@core/enums';
import type { DashboardLayoutState, DashboardWidgetState, StatMetric } from '@core/models';
import { FeatureFlagService } from '@core/services/feature-flag.service';
import { StorageService } from '@core/services/storage.service';
import { ThemeService } from '@core/services/theme.service';
import { TranslationService } from '@core/services/translation.service';
import { ToastService } from '@core/services/toast.service';
import { formatCompact, formatCurrency } from '@core/utilities/format.util';
import { ChartComponent } from '@shared/components/chart/chart';
import { Countdown } from '@shared/components/countdown/countdown';
import { PageHeader } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatCard } from '@shared/components/stat-card/stat-card';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { Avatar } from '@shared/components/avatar/avatar';
import { CurrencyPipe, DatePipe, RelativePipe } from '@shared/pipes/format.pipes';
import { DashboardService, type DashboardSnapshot } from './data/dashboard.service';

/** Widget registry — the order and visibility an operator can customise. */
const WIDGETS: { id: string; title: string; span: number }[] = [
  { id: 'sales-trend', title: 'Sales & payout trend', span: 8 },
  { id: 'product-mix', title: 'Sales by product', span: 4 },
  { id: 'revenue', title: 'Revenue, payout & commission', span: 7 },
  { id: 'channels', title: 'Sales channels', span: 5 },
  { id: 'winners', title: 'Recent winners', span: 5 },
  { id: 'tickets', title: 'Recent tickets', span: 7 },
  { id: 'transactions', title: 'Latest transactions', span: 7 },
  { id: 'provinces', title: 'Sales by province', span: 5 },
  { id: 'health', title: 'System health', span: 12 },
];

/**
 * Operations dashboard.
 *
 * Fourteen KPI tiles, five chart panels, live activity lists, an upcoming-draw
 * countdown, announcements and system health. Widgets can be reordered by drag
 * and drop, resized, hidden and pinned; the arrangement is persisted per user.
 */
@Component({
  selector: 'll-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    CdkDrag,
    CdkDropList,
    MatButtonModule,
    MatDividerModule,
    MatMenuModule,
    MatTooltipModule,
    PageHeader,
    StatCard,
    ChartComponent,
    Countdown,
    Skeleton,
    StatePanel,
    StatusBadge,
    Avatar,
    CurrencyPipe,
    DatePipe,
    RelativePipe,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly dashboardService = inject(DashboardService);
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);
  private readonly theme = inject(ThemeService);
  private readonly featureFlags = inject(FeatureFlagService);
  private readonly router = inject(Router);
  private readonly translation = inject(TranslationService);
  protected readonly auth = inject(AuthService);

  protected readonly ticketStatusMap = TICKET_STATUS_MAP;
  protected readonly transactionStatusMap = TRANSACTION_STATUS_MAP;
  protected readonly drawStatusMap = DRAW_STATUS_MAP;
  protected readonly claimStatusMap = CLAIM_STATUS_MAP;
  protected readonly healthStateMap = HEALTH_STATE_MAP;
  protected readonly HealthState = HealthState;

  protected readonly snapshot = signal<DashboardSnapshot | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly customising = signal(false);
  protected readonly dismissedAnnouncements = signal<ReadonlySet<string>>(new Set());

  protected readonly canCustomise = this.featureFlags.isEnabled(FEATURE_FLAGS.dashboardCustomisation);

  /** Persisted widget arrangement. */
  protected readonly widgets = signal<DashboardWidgetState[]>(this.restoreLayout());

  protected readonly branding = computed(() => this.theme.branding());

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const name = this.auth.user()?.fullName.split(' ')[0] ?? 'there';
    if (hour < 12) {
      return `Good morning, ${name}`;
    }
    return hour < 18 ? `Good afternoon, ${name}` : `Good evening, ${name}`;
  });

  protected readonly metrics = computed(() => this.snapshot()?.metrics ?? []);

  /** Currency-valued tiles are formatted differently from count tiles. */
  protected readonly currencyMetricIds = new Set([
    'sales-today',
    'revenue-today',
    'wallet-balance',
    'commission',
  ]);

  protected readonly visibleWidgets = computed(() =>
    this.widgets()
      .filter((widget) => widget.visible)
      .sort((a, b) => {
        // Pinned widgets always float to the top of the grid.
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }
        return a.order - b.order;
      }),
  );

  protected readonly hiddenWidgets = computed(() => this.widgets().filter((widget) => !widget.visible));

  protected readonly activeAnnouncements = computed(() =>
    (this.snapshot()?.announcements ?? []).filter(
      (announcement) => !this.dismissedAnnouncements().has(announcement.id),
    ),
  );

  /** Scrolling ticker text built from the live announcements. */
  protected readonly tickerItems = computed(() =>
    (this.snapshot()?.announcements ?? []).map((announcement) => announcement.title),
  );

  protected readonly nextDraw = computed(() => this.snapshot()?.upcomingDraws[0] ?? null);

  protected readonly headerStats = computed(() => {
    const data = this.snapshot();
    if (!data) {
      return [];
    }
    const find = (id: string): number => data.metrics.find((metric) => metric.id === id)?.value ?? 0;
    return [
      {
        label: "Today's sales",
        value: formatCurrency(find('sales-today'), 'LAK', 'en-GB', { compact: true }),
        icon: 'payments',
      },
      { label: 'Tickets sold', value: formatCompact(find('tickets-sold')), icon: 'confirmation_number' },
      { label: 'Winners today', value: formatCompact(find('winners-today')), icon: 'emoji_events' },
      { label: 'Pending draws', value: String(find('pending-draws')), icon: 'pending_actions' },
    ];
  });

  /** Formatter shared by every chart so axes and tooltips read consistently. */
  protected readonly currencyFormatter = (value: number): string =>
    formatCurrency(value, this.theme.regional().currency, this.theme.regional().locale, {
      compact: true,
      symbol: this.theme.regional().currencySymbol,
      position: this.theme.regional().currencyPosition,
    });

  protected readonly countFormatter = (value: number): string =>
    formatCompact(value, this.theme.regional().locale);

  constructor() {
    // Announcements are written per language, so a language switch reloads them.
    effect(() => {
      this.translation.current();
      untracked(() => this.load());
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.dashboardService.load().subscribe({
      next: (snapshot) => {
        this.snapshot.set(snapshot);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('The dashboard could not be loaded. Please try again.');
      },
    });
  }

  protected widgetTitle(id: string): string {
    return WIDGETS.find((widget) => widget.id === id)?.title ?? id;
  }

  protected onHeaderAction(action: string): void {
    switch (action) {
      case 'refresh':
        this.load();
        break;
      case 'customise':
        this.customising.update((value) => !value);
        break;
      case 'reports':
        void this.router.navigate(['/reports']);
        break;
      default:
        break;
    }
  }

  protected onMetricSelect(metric: StatMetric): void {
    if (metric.route) {
      void this.router.navigateByUrl(metric.route);
    }
  }

  protected dismissAnnouncement(id: string): void {
    this.dismissedAnnouncements.update((current) => new Set(current).add(id));
  }

  protected severityTone(severity: Severity): string {
    switch (severity) {
      case Severity.Critical:
      case Severity.High:
        return 'danger';
      case Severity.Medium:
        return 'warning';
      case Severity.Low:
        return 'neutral';
      default:
        return 'info';
    }
  }

  // -------------------------------------------------------------- customising

  protected onWidgetDrop(event: CdkDragDrop<DashboardWidgetState[]>): void {
    const ordered = [...this.visibleWidgets()];
    moveItemInArray(ordered, event.previousIndex, event.currentIndex);

    this.widgets.update((current) => {
      const orderById = new Map(ordered.map((widget, index) => [widget.id, index]));
      return current.map((widget) => ({
        ...widget,
        order: orderById.get(widget.id) ?? widget.order,
      }));
    });
    this.persistLayout();
  }

  protected toggleWidget(id: string): void {
    this.widgets.update((current) =>
      current.map((widget) => (widget.id === id ? { ...widget, visible: !widget.visible } : widget)),
    );
    this.persistLayout();
  }

  protected togglePin(id: string): void {
    this.widgets.update((current) =>
      current.map((widget) => (widget.id === id ? { ...widget, pinned: !widget.pinned } : widget)),
    );
    this.persistLayout();
  }

  /** Cycles a widget between one-third, half and full width. */
  protected resizeWidget(id: string): void {
    const steps = [4, 6, 8, 12];
    this.widgets.update((current) =>
      current.map((widget) => {
        if (widget.id !== id) {
          return widget;
        }
        const index = steps.indexOf(widget.span);
        return { ...widget, span: steps[(index + 1) % steps.length] ?? 6 };
      }),
    );
    this.persistLayout();
  }

  protected resetLayout(): void {
    this.widgets.set(this.defaultLayout());
    this.persistLayout();
    this.toast.success('Dashboard layout reset');
  }

  protected isPinned(id: string): boolean {
    return this.widgets().find((widget) => widget.id === id)?.pinned ?? false;
  }

  private defaultLayout(): DashboardWidgetState[] {
    return WIDGETS.map((widget, index) => ({
      id: widget.id,
      order: index,
      visible: true,
      pinned: false,
      span: widget.span,
    }));
  }

  private restoreLayout(): DashboardWidgetState[] {
    const stored = this.storage.get<DashboardLayoutState | null>(STORAGE_KEYS.dashboardLayout, null);
    if (!stored?.widgets?.length) {
      return this.defaultLayout();
    }
    // Merge so newly shipped widgets appear for existing users.
    const known = new Map(stored.widgets.map((widget) => [widget.id, widget]));
    return this.defaultLayout().map((widget) => known.get(widget.id) ?? widget);
  }

  private persistLayout(): void {
    this.storage.set(STORAGE_KEYS.dashboardLayout, {
      widgets: this.widgets(),
      updatedAt: Date.now(),
    } satisfies DashboardLayoutState);
  }
}
