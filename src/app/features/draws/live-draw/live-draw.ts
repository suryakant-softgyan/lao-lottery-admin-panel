import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { DRAW_MODE_MAP, DRAW_STATUS_MAP } from '@core/constants/status-maps.constants';
import { DrawMode, DrawStatus, LotteryType } from '@core/enums';
import type { Draw, DrawWinningNumber } from '@core/models';
import { ConfirmService } from '@core/services/confirm.service';
import { ToastService } from '@core/services/toast.service';
import { humanise } from '@core/utilities/format.util';
import { Countdown } from '@shared/components/countdown/countdown';
import { PageHeader } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { CurrencyPipe, DatePipe } from '@shared/pipes/format.pipes';
import { DrawRepository } from '../data/draw.repository';

/**
 * Live draw studio.
 *
 * The operator console for executing a draw: pick the draw, close sales, enter
 * or generate the winning numbers per prize tier, then submit for verification.
 *
 * Two safeguards are deliberate. Numbers can only be submitted once every tier
 * has the right number of digits, and submission is a confirmed action — a draw
 * result is the single most consequential input in the whole platform.
 */
@Component({
  selector: 'll-live-draw',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatTooltipModule,
    PageHeader,
    Countdown,
    StatusBadge,
    Skeleton,
    StatePanel,
    CurrencyPipe,
    DatePipe,
  ],
  templateUrl: './live-draw.html',
  styleUrl: './live-draw.scss',
})
export class LiveDraw {
  private readonly repository = inject(DrawRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusMap = DRAW_STATUS_MAP;
  protected readonly modeMap = DRAW_MODE_MAP;
  protected readonly DrawStatus = DrawStatus;
  protected readonly DrawMode = DrawMode;

  protected readonly candidates = signal<Draw[]>([]);
  protected readonly selectedId = signal<string | null>(this.route.snapshot.queryParamMap.get('draw'));
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Per-tier number entry, keyed by tier code. */
  protected readonly entries = signal<Record<string, string>>({});

  // ---- Powerball (two-pool) result entry ----
  /** Comma-separated main numbers, e.g. "3,11,19,27,35". */
  protected readonly pbMain = signal<string>('');
  /** The bonus (powerball) number. */
  protected readonly pbBonus = signal<string>('');
  // Pool sizes for this Powerball game (matches the seeded 5-of-35 + 1-of-10).
  private readonly pbMainPool = 35;
  private readonly pbBonusPool = 10;
  private readonly pbMainPick = 5;

  protected readonly isPowerball = computed(
    () => this.selected()?.lotteryType === LotteryType.Powerball,
  );

  /** Distinct, in-range main numbers currently entered. */
  private pbMains(): number[] {
    const seen = new Set<number>();
    for (const part of this.pbMain().split(/[,\s]+/)) {
      const n = Number(part.trim());
      if (Number.isInteger(n) && n >= 1 && n <= this.pbMainPool) {
        seen.add(n);
      }
    }
    return [...seen];
  }

  protected readonly canSubmitPowerball = computed(() => {
    this.pbMain(); // track
    const bonus = Number(this.pbBonus());
    return (
      this.pbMains().length === this.pbMainPick &&
      Number.isInteger(bonus) &&
      bonus >= 1 &&
      bonus <= this.pbBonusPool
    );
  });

  /** Set while the RNG animation runs. */
  protected readonly spinning = signal(false);

  protected readonly selected = computed(
    () => this.candidates().find((draw) => draw.id === this.selectedId()) ?? this.candidates()[0] ?? null,
  );

  /** Digits required per tier, derived from the product. */
  protected readonly digitCount = computed(() => {
    const code = this.selected()?.lotteryType ?? '';
    const match = /(\w+)_DIGIT/.exec(code);
    const words: Record<string, number> = { TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6 };
    return match ? (words[match[1] ?? ''] ?? 2) : 2;
  });

  /** The tiers to capture — taken from the draw's existing structure. */
  protected readonly tiers = computed(() => {
    const draw = this.selected();
    if (!draw) {
      return [];
    }
    if (draw.winningNumbers.length > 0) {
      return draw.winningNumbers;
    }
    // A draw that has not been executed yet still needs its tier skeleton.
    return [
      {
        tierCode: 'JACKPOT',
        tierName: 'Jackpot',
        numbers: [],
        winnerCount: 0,
        prizePerWinner: 0,
        totalPayout: 0,
      },
      {
        tierCode: 'FIRST',
        tierName: 'First Prize',
        numbers: [],
        winnerCount: 0,
        prizePerWinner: 0,
        totalPayout: 0,
      },
      {
        tierCode: 'SECOND',
        tierName: 'Second Prize',
        numbers: [],
        winnerCount: 0,
        prizePerWinner: 0,
        totalPayout: 0,
      },
      {
        tierCode: 'THIRD',
        tierName: 'Third Prize',
        numbers: [],
        winnerCount: 0,
        prizePerWinner: 0,
        totalPayout: 0,
      },
    ] as DrawWinningNumber[];
  });

  /** Submission is blocked until every tier is complete. */
  protected readonly canSubmit = computed(() => {
    const required = this.digitCount();
    const entries = this.entries();
    return (
      this.tiers().length > 0 &&
      this.tiers().every((tier) => (entries[tier.tierCode] ?? '').length === required)
    );
  });

  protected readonly progress = computed(() => {
    const required = this.digitCount();
    const entries = this.entries();
    const complete = this.tiers().filter((tier) => (entries[tier.tierCode] ?? '').length === required).length;
    return this.tiers().length === 0 ? 0 : Math.round((complete / this.tiers().length) * 100);
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.repository.liveCandidates().subscribe({
      next: (draws) => {
        this.candidates.set(draws);
        if (!this.selectedId() && draws[0]) {
          this.selectedId.set(draws[0].id);
        }
        this.seedEntries();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Draws could not be loaded.');
      },
    });
  }

  protected select(draw: Draw): void {
    this.selectedId.set(draw.id);
    this.seedEntries();
  }

  private seedEntries(): void {
    const draw = this.selected();
    const seeded: Record<string, string> = {};
    for (const tier of draw?.winningNumbers ?? []) {
      seeded[tier.tierCode] = tier.numbers[0] ?? '';
    }
    this.entries.set(seeded);
  }

  protected humanise(value: string): string {
    return humanise(value);
  }

  protected entryFor(tierCode: string): string {
    return this.entries()[tierCode] ?? '';
  }

  protected onEntryChange(tierCode: string, value: string): void {
    const cleaned = value.replace(/\D/g, '').slice(0, this.digitCount());
    this.entries.update((current) => ({ ...current, [tierCode]: cleaned }));
  }

  protected digitsOf(tierCode: string): string[] {
    const value = this.entryFor(tierCode);
    return Array.from({ length: this.digitCount() }, (_, index) => value.charAt(index));
  }

  /**
   * Automatic mode: the RNG picks the numbers. The brief spin is deliberate —
   * an instant result gives the operator no chance to see that it happened.
   */
  protected generate(): void {
    const draw = this.selected();
    if (!draw || this.spinning()) {
      return;
    }

    if (this.isPowerball()) {
      const pool = Array.from({ length: this.pbMainPool }, (_, i) => i + 1);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j]!, pool[i]!];
      }
      const mains = pool.slice(0, this.pbMainPick).sort((a, b) => a - b);
      this.pbMain.set(mains.join(','));
      this.pbBonus.set(String(1 + Math.floor(Math.random() * this.pbBonusPool)));
      this.toast.info('Numbers generated', 'Review the result before submitting for verification.');
      return;
    }

    this.spinning.set(true);
    const digits = this.digitCount();

    let ticks = 0;
    const spinner = setInterval(() => {
      const shuffled: Record<string, string> = {};
      for (const tier of this.tiers()) {
        shuffled[tier.tierCode] = Array.from({ length: digits }, () =>
          Math.floor(Math.random() * 10).toString(),
        ).join('');
      }
      this.entries.set(shuffled);

      if (++ticks >= 14) {
        clearInterval(spinner);
        this.spinning.set(false);
        this.toast.info('Numbers generated', 'Review the result before submitting for verification.');
      }
    }, 90);

    // Leaving the studio mid-spin must not leave a timer running.
    this.destroyRef.onDestroy(() => clearInterval(spinner));
  }

  protected clearEntries(): void {
    this.entries.set({});
    this.pbMain.set('');
    this.pbBonus.set('');
  }

  protected closeSales(): void {
    const draw = this.selected();
    if (!draw) {
      return;
    }

    this.confirm
      .ask({
        title: 'Close ticket sales?',
        message: `No further tickets can be issued for ${draw.code} on any channel.`,
        confirmLabel: 'Close sales',
        tone: 'warning',
        icon: 'lock',
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.busy.set(true);
        this.repository.closeSales(draw.id).subscribe({
          next: () => {
            this.busy.set(false);
            this.toast.success('Sales closed', draw.code);
            this.load();
          },
          error: () => {
            this.busy.set(false);
            this.toast.error('Unable to close sales');
          },
        });
      });
  }

  /** Commits the entered numbers and moves the draw to verification. */
  protected submit(): void {
    const draw = this.selected();
    if (this.isPowerball()) {
      this.submitPowerball(draw);
      return;
    }
    if (!draw || !this.canSubmit()) {
      return;
    }

    const entries = this.entries();
    const summary = this.tiers()
      .map((tier) => `${tier.tierName}: ${entries[tier.tierCode]}`)
      .join(' · ');

    this.confirm
      .open({
        title: 'Submit this draw result?',
        message: `The result for ${draw.code} will be locked and sent for independent verification.`,
        detail: summary,
        confirmLabel: 'Submit for verification',
        tone: 'danger',
        icon: 'fact_check',
        requireTypedConfirmation: 'CONFIRM',
      })
      .subscribe((result) => {
        if (!result.confirmed) {
          return;
        }

        const winningNumbers: DrawWinningNumber[] = this.tiers().map((tier) => ({
          ...tier,
          numbers: [entries[tier.tierCode] ?? ''],
        }));

        this.busy.set(true);
        this.repository.recordNumbers(draw.id, winningNumbers).subscribe({
          next: () => {
            this.busy.set(false);
            this.toast.success('Result submitted', `${draw.code} is awaiting verification.`);
            void this.router.navigate(['/draws/results']);
          },
          error: () => {
            this.busy.set(false);
            this.toast.error('Submission failed', 'The result could not be recorded.');
          },
        });
      });
  }

  /** Two-pool (Powerball) result submission. */
  private submitPowerball(draw: Draw | null): void {
    if (!draw || !this.canSubmitPowerball()) {
      return;
    }
    const mains = this.pbMains().sort((a, b) => a - b);
    const bonus = Number(this.pbBonus());
    this.confirm
      .open({
        title: 'Submit this Powerball result?',
        message: `The result for ${draw.code} will be locked and sent for independent verification.`,
        detail: `Main: ${mains.join(', ')}  ·  Powerball: ${bonus}`,
        confirmLabel: 'Submit for verification',
        tone: 'danger',
        icon: 'fact_check',
        requireTypedConfirmation: 'CONFIRM',
      })
      .subscribe((result) => {
        if (!result.confirmed) {
          return;
        }
        this.busy.set(true);
        this.repository.recordPowerball(draw.id, mains.join(','), bonus).subscribe({
          next: () => {
            this.busy.set(false);
            this.toast.success('Result submitted', `${draw.code} is awaiting verification.`);
            void this.router.navigate(['/draws/results']);
          },
          error: () => {
            this.busy.set(false);
            this.toast.error('Submission failed', 'The result could not be recorded.');
          },
        });
      });
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/draws']);
    } else if (action === 'results') {
      void this.router.navigate(['/draws/results']);
    }
  }
}
