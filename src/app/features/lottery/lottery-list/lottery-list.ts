import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PermissionService } from '@core/authentication/permission.service';
import { PERMISSIONS } from '@core/constants/permission.constants';
import { LOTTERY_STATUS_MAP, LOTTERY_TYPE_MAP } from '@core/constants/status-maps.constants';
import { LotteryStatus } from '@core/enums';
import type { LotteryGame, StatMetric } from '@core/models';
import { ConfirmService } from '@core/services/confirm.service';
import { ToastService } from '@core/services/toast.service';
import { humanise } from '@core/utilities/format.util';
import { PageHeader } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatCard } from '@shared/components/stat-card/stat-card';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { CurrencyPipe, NumberPipe } from '@shared/pipes/format.pipes';
import { LotteryRepository } from '../data/lottery.repository';

/**
 * Lottery product catalogue.
 *
 * Cards rather than a table: each game has a brand colour, a draw rhythm and a
 * prize ladder, which read far better as a card than as a row of cells.
 */
@Component({
  selector: 'll-lottery-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    PageHeader,
    StatCard,
    StatusBadge,
    Skeleton,
    StatePanel,
    CurrencyPipe,
    NumberPipe,
  ],
  templateUrl: './lottery-list.html',
  styleUrl: './lottery-list.scss',
})
export class LotteryList {
  private readonly repository = inject(LotteryRepository);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly permissions = inject(PermissionService);

  protected readonly PERMISSIONS = PERMISSIONS;
  protected readonly statusMap = LOTTERY_STATUS_MAP;
  protected readonly typeMap = LOTTERY_TYPE_MAP;
  protected readonly LotteryStatus = LotteryStatus;

  protected readonly games = signal<LotteryGame[]>([]);
  protected readonly summary = signal<StatMetric[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly activeCount = computed(
    () => this.games().filter((game) => game.status === LotteryStatus.Active).length,
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.repository.all().subscribe({
      next: (games) => {
        this.games.set(games);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('The lottery catalogue could not be loaded.');
      },
    });

    this.repository.statistics().subscribe((metrics) => this.summary.set(metrics));
  }

  protected humanise(value: string): string {
    return humanise(value);
  }

  /** Human-readable draw rhythm for the card footer. */
  protected schedule(game: LotteryGame): string {
    if (game.drawDays.includes('FESTIVAL')) {
      return 'Festival draws only';
    }
    if (game.drawDays.includes('LAST_FRI')) {
      return 'Last Friday of the month';
    }
    if (game.drawDays.length === 7) {
      return 'Daily';
    }
    return game.drawDays.join(', ');
  }

  protected toggleStatus(game: LotteryGame): void {
    const pausing = game.status === LotteryStatus.Active;

    this.confirm
      .ask({
        title: pausing ? `Pause ${game.name}?` : `Resume ${game.name}?`,
        message: pausing
          ? 'Ticket sales stop immediately across every channel. Scheduled draws are not cancelled.'
          : 'Ticket sales resume immediately across every channel.',
        confirmLabel: pausing ? 'Pause sales' : 'Resume sales',
        tone: pausing ? 'warning' : 'primary',
        icon: pausing ? 'pause_circle' : 'play_circle',
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        const status = pausing ? LotteryStatus.Paused : LotteryStatus.Active;
        this.repository.setStatus(game.id, status).subscribe(() => {
          this.toast.success(pausing ? 'Sales paused' : 'Sales resumed', game.name);
          this.load();
        });
      });
  }

  protected onHeaderAction(action: string): void {
    if (action === 'configuration') {
      void this.router.navigate(['/lottery/configuration']);
    } else if (action === 'prizes') {
      void this.router.navigate(['/lottery/prizes']);
    }
  }
}
