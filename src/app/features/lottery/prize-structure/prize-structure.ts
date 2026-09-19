import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { LOTTERY_TYPE_MAP } from '@core/constants/status-maps.constants';
import type { LotteryGame, PrizeTier } from '@core/models';
import { ConfirmService } from '@core/services/confirm.service';
import { ThemeService } from '@core/services/theme.service';
import { ToastService } from '@core/services/toast.service';
import { formatCurrency, humanise } from '@core/utilities/format.util';
import { ChartComponent } from '@shared/components/chart/chart';
import { PageHeader } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { CurrencyPipe } from '@shared/pipes/format.pipes';
import { LotteryRepository } from '../data/lottery.repository';

/**
 * Prize ladder editor.
 *
 * Multipliers are edited inline against a worked example, because the number
 * that matters to an operator is "what does a 10,000 ₭ stake pay out", not the
 * multiplier itself.
 */
@Component({
  selector: 'll-prize-structure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatTooltipModule,
    PageHeader,
    ChartComponent,
    StatusBadge,
    Skeleton,
    StatePanel,
    CurrencyPipe,
  ],
  templateUrl: './prize-structure.html',
  styleUrl: './prize-structure.scss',
})
export class PrizeStructure {
  private readonly repository = inject(LotteryRepository);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly theme = inject(ThemeService);

  protected readonly typeMap = LOTTERY_TYPE_MAP;

  protected readonly games = signal<LotteryGame[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly dirty = signal(false);

  /** Staged tier edits, applied only on save. */
  protected readonly draft = signal<PrizeTier[]>([]);

  /** Worked example stake used to show real payout values. */
  protected readonly sampleStake = signal(10_000);

  protected readonly selected = computed(
    () => this.games().find((game) => game.id === this.selectedId()) ?? this.games()[0] ?? null,
  );

  protected readonly chartLabels = computed(() => this.draft().map((tier) => humanise(tier.code)));

  protected readonly chartSeries = computed(() => [
    {
      label: 'Payout on the sample stake',
      data: this.draft().map((tier) => this.payout(tier)),
    },
  ]);

  /** Total liability if every tier paid its maximum number of winners. */
  protected readonly maximumLiability = computed(() =>
    this.draft().reduce((total, tier) => total + this.payout(tier) * tier.maxWinners, 0),
  );

  protected readonly currencyFormatter = (value: number): string =>
    formatCurrency(value, this.theme.regional().currency, this.theme.regional().locale, { compact: true });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.repository.all().subscribe({
      next: (games) => {
        this.games.set(games);
        if (!this.selectedId() && games[0]) {
          this.selectedId.set(games[0].id);
        }
        this.syncDraft();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Prize structures could not be loaded.');
      },
    });
  }

  protected select(game: LotteryGame): void {
    this.selectedId.set(game.id);
    this.syncDraft();
  }

  private syncDraft(): void {
    this.draft.set(this.selected()?.prizeTiers.map((tier) => ({ ...tier })) ?? []);
    this.dirty.set(false);
  }

  protected humanise(value: string): string {
    return humanise(value);
  }

  /** Payout for the worked example: fixed amount wins over multiplier. */
  protected payout(tier: PrizeTier): number {
    return tier.fixedAmount > 0 ? tier.fixedAmount : tier.multiplier * this.sampleStake();
  }

  protected netPayout(tier: PrizeTier): number {
    return this.payout(tier) * (1 - tier.taxPercent / 100);
  }

  protected updateTier(index: number, field: keyof PrizeTier, value: number): void {
    this.draft.update((current) =>
      current.map((tier, position) => (position === index ? { ...tier, [field]: value } : tier)),
    );
    this.dirty.set(true);
  }

  protected save(): void {
    const game = this.selected();
    if (!game) {
      return;
    }

    this.confirm
      .ask({
        title: `Update the prize ladder for ${game.name}?`,
        message:
          'New multipliers apply to tickets sold from now on. Tickets already issued keep the terms they were sold under.',
        detail: `Maximum theoretical liability becomes ${formatCurrency(this.maximumLiability())}.`,
        confirmLabel: 'Update prize ladder',
        tone: 'warning',
        icon: 'emoji_events',
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.saving.set(true);
        this.repository.savePrizeTiers(game.id, this.draft()).subscribe({
          next: () => {
            this.saving.set(false);
            this.dirty.set(false);
            this.toast.success('Prize ladder updated', game.name);
            this.load();
          },
          error: () => {
            this.saving.set(false);
            this.toast.error('Save failed', 'The prize ladder could not be updated.');
          },
        });
      });
  }

  protected discard(): void {
    this.syncDraft();
    this.toast.info('Changes discarded');
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/lottery']);
    } else if (action === 'configuration') {
      void this.router.navigate(['/lottery/configuration']);
    }
  }
}
