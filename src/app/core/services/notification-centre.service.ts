import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { FEATURE_FLAGS } from '../constants/feature-flags.constants';
import { NotificationCategory, NotificationChannel, NotificationStatus, Severity } from '../enums';
import { mockDataset } from '../mock/dataset';
import type { NotificationMessage } from '../models/system.model';
import type { Page, PageQuery } from '../models/common.model';
import { applyQuery } from '../utilities/query.util';
import { FeatureFlagService } from './feature-flag.service';
import { LoggerService } from './logger.service';
import { MockBackendService } from './mock-backend.service';
import { ToastService } from './toast.service';

/**
 * In-app notification centre.
 *
 * Holds the notification list in a signal and exposes an unread counter for the
 * header badge. Real-time delivery is **WebSocket-ready**: {@link connect}
 * already owns the connection lifecycle, and in mock mode it simulates the
 * server pushing a new notification every so often so the live behaviour can be
 * seen without a backend.
 */
@Injectable({ providedIn: 'root' })
export class NotificationCentreService {
  private readonly backend = inject(MockBackendService);
  private readonly toast = inject(ToastService);
  private readonly logger = inject(LoggerService);
  private readonly featureFlags = inject(FeatureFlagService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly items = signal<NotificationMessage[]>(mockDataset.notifications);
  private socket: WebSocket | null = null;
  private simulator: ReturnType<typeof setInterval> | null = null;
  private sequence = 0;

  readonly all = this.items.asReadonly();

  readonly unreadCount = computed(() => this.items().filter((item) => !item.read).length);

  /** Newest first — feeds the header dropdown. */
  readonly recent = computed(() =>
    [...this.items()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
  );

  readonly criticalCount = computed(
    () => this.items().filter((item) => !item.read && item.severity === Severity.Critical).length,
  );

  /** Paged list for the notification centre screen. */
  list(query: PageQuery): Observable<Page<NotificationMessage>> {
    return this.backend.respond(() =>
      applyQuery(this.items(), query, {
        searchFields: ['title', 'body', 'category'],
        dateField: 'createdAt',
      }),
    );
  }

  markRead(id: string): void {
    this.items.update((current) =>
      current.map((item) =>
        item.id === id && !item.read ? { ...item, read: true, readAt: new Date().toISOString() } : item,
      ),
    );
  }

  markAllRead(): void {
    const now = new Date().toISOString();
    this.items.update((current) =>
      current.map((item) => (item.read ? item : { ...item, read: true, readAt: now })),
    );
  }

  remove(id: string): void {
    this.items.update((current) => current.filter((item) => item.id !== id));
  }

  clearAll(): void {
    this.items.set([]);
  }

  /** Pushes a locally generated notification (used by long-running actions). */
  push(notification: Partial<NotificationMessage> & { title: string; body: string }): void {
    const now = new Date().toISOString();
    const message: NotificationMessage = {
      id: `ntf-live-${++this.sequence}`,
      channel: NotificationChannel.InApp,
      category: NotificationCategory.System,
      severity: Severity.Info,
      status: NotificationStatus.Sent,
      read: false,
      icon: 'notifications',
      createdAt: now,
      sentAt: now,
      updatedAt: now,
      ...notification,
    };
    this.items.update((current) => [message, ...current]);
  }

  /**
   * Opens the realtime channel.
   *
   * With `useMockData` on, a timer stands in for the socket so the UI can be
   * exercised end to end. Swapping to the real gateway means deleting the
   * simulator branch — the message handling below is already the production
   * path.
   */
  connect(): void {
    if (!this.featureFlags.isEnabled(FEATURE_FLAGS.realtimeNotifications)) {
      return;
    }

    if (environment.useMockData) {
      this.startSimulator();
      return;
    }

    try {
      this.socket = new WebSocket(`${environment.wsBaseUrl}/notifications`);
      this.socket.onmessage = (event: MessageEvent<string>): void => {
        const payload = JSON.parse(event.data) as NotificationMessage;
        this.handleIncoming(payload);
      };
      this.socket.onerror = (event): void => this.logger.warn('Notification socket error', event);
      this.destroyRef.onDestroy(() => this.disconnect());
    } catch (error) {
      this.logger.warn('Unable to open the notification socket', error);
    }
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
    if (this.simulator) {
      clearInterval(this.simulator);
      this.simulator = null;
    }
  }

  /** Shared handling for both the socket and the simulator. */
  private handleIncoming(message: NotificationMessage): void {
    this.items.update((current) => [message, ...current]);

    // High-severity events also raise a toast so they are not missed.
    if (message.severity === Severity.Critical || message.severity === Severity.High) {
      this.toast.show(message.title, {
        message: message.body,
        tone: message.severity === Severity.Critical ? 'danger' : 'warning',
        icon: message.icon,
      });
    }
  }

  private startSimulator(): void {
    if (this.simulator) {
      return;
    }

    const samples: {
      title: string;
      body: string;
      icon: string;
      severity: Severity;
      category: NotificationCategory;
      route: string;
    }[] = [
      {
        title: 'Draw sales closed',
        body: 'Ticket sales for the evening 3D draw have closed and totals are being reconciled.',
        icon: 'lock',
        severity: Severity.Info,
        category: NotificationCategory.Draw,
        route: '/draws',
      },
      {
        title: 'Gateway response times rising',
        body: 'U-Money average latency has exceeded 2,000 ms over the last five minutes.',
        icon: 'warning',
        severity: Severity.High,
        category: NotificationCategory.System,
        route: '/payment/gateways',
      },
      {
        title: 'New agent application',
        body: 'A distributor application from Savannakhet is awaiting review.',
        icon: 'assignment_turned_in',
        severity: Severity.Medium,
        category: NotificationCategory.Approval,
        route: '/agents/approvals',
      },
      {
        title: 'Large prize claim submitted',
        body: 'A claim of 1,200,000,000 ₭ has been submitted and needs finance approval.',
        icon: 'emoji_events',
        severity: Severity.Medium,
        category: NotificationCategory.Transaction,
        route: '/tickets/winning',
      },
    ];

    let index = 0;
    this.simulator = setInterval(() => {
      const sample = samples[index % samples.length]!;
      index++;
      const now = new Date().toISOString();
      this.handleIncoming({
        id: `ntf-live-${++this.sequence}`,
        title: sample.title,
        body: sample.body,
        channel: NotificationChannel.InApp,
        category: sample.category,
        severity: sample.severity,
        status: NotificationStatus.Sent,
        read: false,
        icon: sample.icon,
        actionUrl: sample.route,
        actionLabel: 'Open',
        createdAt: now,
        sentAt: now,
        updatedAt: now,
      });
    }, 75_000);

    this.destroyRef.onDestroy(() => this.disconnect());
  }
}
