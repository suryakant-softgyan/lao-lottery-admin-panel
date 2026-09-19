import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { NOTIFICATION_CHANNEL_MAP, SEVERITY_MAP } from '@core/constants/status-maps.constants';
import { NotificationCategory, Severity } from '@core/enums';
import type { NotificationMessage } from '@core/models';
import { NotificationCentreService } from '@core/services/notification-centre.service';
import { ToastService } from '@core/services/toast.service';
import { humanise } from '@core/utilities/format.util';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { RelativePipe } from '@shared/pipes/format.pipes';

/**
 * In-app notification inbox.
 *
 * A feed rather than a table: notifications are read chronologically and acted
 * on individually, and the unread state needs to be obvious at a glance.
 */
@Component({
  selector: 'll-notification-centre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatTooltipModule, PageHeader, StatusBadge, StatePanel, RelativePipe],
  templateUrl: './notification-centre.html',
  styleUrl: './notification-centre.scss',
})
export class NotificationCentre {
  private readonly centre = inject(NotificationCentreService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly severityMap = SEVERITY_MAP;
  protected readonly channelMap = NOTIFICATION_CHANNEL_MAP;

  protected readonly categoryFilter = signal<string>('');
  protected readonly unreadOnly = signal(false);

  protected readonly categories = [
    { value: '', label: 'All categories', icon: 'inbox' },
    ...Object.values(NotificationCategory).map((value) => ({
      value,
      label: humanise(value),
      icon: this.categoryIcon(value),
    })),
  ];

  protected readonly all = this.centre.recent;
  protected readonly unreadCount = this.centre.unreadCount;
  protected readonly criticalCount = this.centre.criticalCount;

  protected readonly filtered = computed(() => {
    const category = this.categoryFilter();
    const unreadOnly = this.unreadOnly();
    return this.all().filter((item) => {
      if (category && item.category !== category) {
        return false;
      }
      return !unreadOnly || !item.read;
    });
  });

  /** Groups the feed into Today / Yesterday / Earlier. */
  protected readonly groups = computed(() => {
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const startOfYesterday = startOfToday - 86_400_000;

    const buckets: { label: string; items: NotificationMessage[] }[] = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'Earlier', items: [] },
    ];

    for (const item of this.filtered()) {
      const time = Date.parse(item.createdAt);
      if (time >= startOfToday) {
        buckets[0]!.items.push(item);
      } else if (time >= startOfYesterday) {
        buckets[1]!.items.push(item);
      } else {
        buckets[2]!.items.push(item);
      }
    }

    return buckets.filter((bucket) => bucket.items.length > 0);
  });

  protected categoryIcon(category: string): string {
    switch (category) {
      case NotificationCategory.Draw:
        return 'stadia_controller';
      case NotificationCategory.Transaction:
        return 'payments';
      case NotificationCategory.Security:
        return 'shield';
      case NotificationCategory.Approval:
        return 'assignment_turned_in';
      case NotificationCategory.Compliance:
        return 'verified_user';
      case NotificationCategory.Marketing:
        return 'campaign';
      default:
        return 'settings';
    }
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

  protected countFor(category: string): number {
    return category ? this.all().filter((item) => item.category === category).length : this.all().length;
  }

  protected open(item: NotificationMessage): void {
    this.centre.markRead(item.id);
    if (item.actionUrl) {
      void this.router.navigateByUrl(item.actionUrl);
    }
  }

  protected dismiss(item: NotificationMessage, event: Event): void {
    event.stopPropagation();
    this.centre.remove(item.id);
  }

  protected markAllRead(): void {
    this.centre.markAllRead();
    this.toast.success('All notifications marked as read');
  }

  protected clearAll(): void {
    this.centre.clearAll();
    this.toast.info('Notification centre cleared');
  }

  protected onHeaderAction(action: string): void {
    switch (action) {
      case 'read-all':
        this.markAllRead();
        break;
      case 'clear':
        this.clearAll();
        break;
      case 'templates':
        void this.router.navigate(['/notifications/templates']);
        break;
      default:
        break;
    }
  }
}
