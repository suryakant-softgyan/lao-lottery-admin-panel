import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, switchMap, timer } from 'rxjs';

import { environment } from '@env/environment';
import { DashboardService } from '@features/dashboard/data/dashboard.service';
import { RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { AuthService } from '@core/authentication/auth.service';
import { SessionService } from '@core/authentication/session.service';
import { FeatureFlagService } from '@core/services/feature-flag.service';
import { RemoteConfigService } from '@core/services/remote-config.service';
import { LayoutService } from '@core/services/layout.service';
import { LoadingService } from '@core/services/loading.service';
import { NavigationService } from '@core/services/navigation.service';
import { NotificationCentreService } from '@core/services/notification-centre.service';
import { ThemeService } from '@core/services/theme.service';
import { mockDataset } from '@core/mock/dataset';
import { AgentStatus, DrawStatus, KycStatus, RetailerStatus, TransactionStatus } from '@core/enums';
import { CommandPalette } from '../command-palette/command-palette';
import { Footer } from '../footer/footer';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';
import { ToastHost } from '../toast-host/toast-host';

/**
 * Authenticated application shell.
 *
 * Composes the sidebar, header, routed content, footer, toast host and command
 * palette; starts the idle/session watchdog and the realtime notification
 * channel; owns the global keyboard shortcuts; and feeds the live sidebar badge
 * counters.
 */
@Component({
  selector: 'll-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    MatButtonModule,
    MatProgressBarModule,
    Sidebar,
    Header,
    Footer,
    ToastHost,
    CommandPalette,
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  protected readonly layout = inject(LayoutService);
  protected readonly loading = inject(LoadingService);
  protected readonly session = inject(SessionService);
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  private readonly navigation = inject(NavigationService);
  private readonly dashboard = inject(DashboardService);
  private readonly featureFlags = inject(FeatureFlagService);
  private readonly remoteConfig = inject(RemoteConfigService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(NotificationCentreService);

  /** Content offset so the fixed sidebar never overlaps the page. */
  protected readonly contentOffset = computed(() =>
    this.layout.showSidebar() ? this.layout.sidebarWidth() : 0,
  );

  protected readonly showFooter = computed(() => this.theme.settings().layout.showFooter);

  constructor() {
    this.session.start();
    this.notifications.connect();

    // Keep the sidebar badges in step with the live notification count.
    effect(() => {
      this.navigation.setBadge('unreadNotifications', this.notifications.unreadCount());
    });

    this.publishBadgeCounts();
    if (!environment.useMockData) {
      this.featureFlags.load().subscribe();
      this.remoteConfig.start();
    }
  }

  /**
   * Seeds the operational counters shown as sidebar badges. In production these
   * come from a lightweight `/dashboard/counters` poll.
   */
  private publishBadgeCounts(): void {
    if (!environment.useMockData) {
      // Live: a light poll keeps the operational badges current while the shell is open.
      timer(0, 60_000)
        .pipe(
          filter(() => this.auth.isAuthenticated()),
          switchMap(() => this.dashboard.counters()),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((counters) => this.navigation.setBadges(counters));
      return;
    }
    this.navigation.setBadges({
      pendingDraws: mockDataset.draws.filter(
        (draw) => draw.status === DrawStatus.PendingVerification || draw.status === DrawStatus.Drawing,
      ).length,
      liveDraw: mockDataset.draws.filter((draw) => draw.status === DrawStatus.Drawing).length,
      pendingAgentApprovals:
        mockDataset.agents.filter((agent) => agent.status === AgentStatus.PendingApproval).length +
        mockDataset.retailers.filter((retailer) => retailer.status === RetailerStatus.PendingApproval).length,
      pendingKyc: mockDataset.users.filter(
        (user) => user.kycStatus === KycStatus.Pending || user.kycStatus === KycStatus.UnderReview,
      ).length,
      failedPayments: mockDataset.paymentTransactions.filter(
        (payment) => payment.status === TransactionStatus.Failed,
      ).length,
    });
  }

  /** Global keyboard shortcuts. */
  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    const meta = event.ctrlKey || event.metaKey;

    if (meta && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.layout.toggleCommandPalette();
      return;
    }
    if (meta && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      this.layout.toggleSidebar();
      return;
    }
    if (meta && event.shiftKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      this.theme.toggleDarkMode();
      return;
    }
    if (meta && event.shiftKey && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      void this.layout.toggleFullscreen();
      return;
    }
    if (meta && event.key === '/') {
      event.preventDefault();
      document.querySelector<HTMLInputElement>('.header__search input')?.focus();
      return;
    }
    // "?" opens the shortcut reference, unless the operator is typing.
    if (event.key === '?' && !this.isTyping(event)) {
      event.preventDefault();
      this.layout.openCommandPalette();
    }
  }

  private isTyping(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return false;
    }
    return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
  }
}
