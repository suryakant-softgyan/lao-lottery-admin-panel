import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PermissionService } from '@core/authentication/permission.service';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { GATEWAY_STATUS_MAP, PAYMENT_METHOD_MAP } from '@core/constants/status-maps.constants';
import { PaymentGatewayStatus } from '@core/enums';
import type { PaymentGateway, StatMetric } from '@core/models';
import { ConfirmService } from '@core/services/confirm.service';
import { ToastService } from '@core/services/toast.service';
import { humanise } from '@core/utilities/format.util';
import { PageHeader } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatCard } from '@shared/components/stat-card/stat-card';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { CurrencyPipe, PercentPipe } from '@shared/pipes/format.pipes';
import { PaymentRepository } from '../data/payment.repository';

/**
 * Gateway health board.
 *
 * Success rate and response time are the two numbers that decide whether a
 * gateway should stay in rotation, so they lead each card and drive the
 * health bar.
 */
@Component({
  selector: 'll-payment-gateways',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    PageHeader,
    StatCard,
    StatusBadge,
    Skeleton,
    StatePanel,
    CurrencyPipe,
    PercentPipe,
  ],
  templateUrl: './payment-gateways.html',
  styleUrl: './payment-gateways.scss',
})
export class PaymentGateways {
  private readonly repository = inject(PaymentRepository);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly permissions = inject(PermissionService);

  protected readonly PERMISSIONS = PERMISSIONS;
  protected readonly statusMap = GATEWAY_STATUS_MAP;
  protected readonly methodMap = PAYMENT_METHOD_MAP;
  protected readonly PaymentGatewayStatus = PaymentGatewayStatus;

  protected readonly gateways = signal<PaymentGateway[]>([]);
  protected readonly summary = signal<StatMetric[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.repository.allGateways().subscribe({
      next: (gateways) => {
        this.gateways.set([...gateways].sort((a, b) => a.priority - b.priority));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Gateways could not be loaded.');
      },
    });

    this.repository.gatewayStatistics().subscribe((metrics) => this.summary.set(metrics));
  }

  protected humanise(value: string): string {
    return humanise(value);
  }

  /** Tone for the health bar: green above 97%, amber above 92%, else red. */
  protected healthTone(gateway: PaymentGateway): string {
    if (gateway.status !== PaymentGatewayStatus.Active) {
      return 'neutral';
    }
    if (gateway.successRate >= 97) {
      return 'success';
    }
    return gateway.successRate >= 92 ? 'warning' : 'danger';
  }

  protected latencyTone(gateway: PaymentGateway): string {
    if (gateway.avgResponseMs <= 600) {
      return 'success';
    }
    return gateway.avgResponseMs <= 1500 ? 'warning' : 'danger';
  }

  protected setStatus(gateway: PaymentGateway, status: PaymentGatewayStatus): void {
    const disabling = status !== PaymentGatewayStatus.Active;

    this.confirm
      .ask({
        title: `Set ${gateway.name} to ${humanise(status).toLowerCase()}?`,
        message: disabling
          ? 'New transactions will stop routing to this gateway. In-flight transactions are unaffected.'
          : 'The gateway will re-enter the routing pool immediately.',
        confirmLabel: 'Apply change',
        tone: disabling ? 'warning' : 'primary',
        icon: disabling ? 'pause_circle' : 'play_circle',
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.repository.setGatewayStatus(gateway.id, status).subscribe(() => {
            this.toast.success('Gateway updated', `${gateway.name} · ${humanise(status)}`);
            this.load();
          });
        }
      });
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/payment']);
    } else if (action === 'banks') {
      void this.router.navigate(['/payment/banks']);
    }
  }
}
