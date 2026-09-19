import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { LOTTERY_TYPE_MAP } from '@core/constants/status-maps.constants';
import type { LotteryConfiguration, LotteryGame } from '@core/models';
import { ConfirmService } from '@core/services/confirm.service';
import { ToastService } from '@core/services/toast.service';
import { DynamicForm } from '@shared/components/dynamic-form/dynamic-form';
import type { FormSchema } from '@shared/components/dynamic-form/dynamic-form.model';
import { PageHeader } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { AppValidators } from '@shared/validators/app.validators';
import { LotteryRepository } from '../data/lottery.repository';

/**
 * Per-product sales configuration.
 *
 * A product picker on the left, the schema-driven configuration form on the
 * right. Every field here directly governs what the sales channels will accept,
 * so saving asks for confirmation.
 */
@Component({
  selector: 'll-lottery-configuration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, PageHeader, DynamicForm, StatusBadge, Skeleton, StatePanel],
  templateUrl: './lottery-configuration.html',
  styleUrl: './lottery-configuration.scss',
})
export class LotteryConfigurationPage {
  private readonly repository = inject(LotteryRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly typeMap = LOTTERY_TYPE_MAP;

  protected readonly games = signal<LotteryGame[]>([]);
  protected readonly selectedId = signal<string | null>(this.route.snapshot.queryParamMap.get('game'));
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly selected = computed(
    () => this.games().find((game) => game.id === this.selectedId()) ?? this.games()[0] ?? null,
  );

  protected readonly model = computed<Record<string, unknown> | null>(() => {
    const game = this.selected();
    return game ? ({ ...game.configuration } as unknown as Record<string, unknown>) : null;
  });

  protected readonly schema: FormSchema = {
    sections: [
      {
        id: 'window',
        title: 'Sales window',
        description: 'When tickets can be bought, and how long before the draw sales stop.',
        icon: 'schedule',
        fields: [
          { key: 'openTime', label: 'Sales open', type: 'time', required: true, span: 4 },
          { key: 'closeTime', label: 'Sales close', type: 'time', required: true, span: 4 },
          {
            key: 'cutOffMinutes',
            label: 'Cut-off before draw',
            type: 'number',
            required: true,
            span: 4,
            min: 0,
            max: 180,
            suffix: 'min',
            hint: 'No ticket may be issued inside this window',
          },
        ],
      },
      {
        id: 'limits',
        title: 'Stake & exposure limits',
        description: 'Risk controls applied at the point of sale.',
        icon: 'shield',
        fields: [
          {
            key: 'minStake',
            label: 'Minimum stake',
            type: 'currency',
            required: true,
            span: 4,
            min: 0,
            prefix: '₭',
          },
          {
            key: 'maxStake',
            label: 'Maximum stake',
            type: 'currency',
            required: true,
            span: 4,
            min: 0,
            prefix: '₭',
          },
          {
            key: 'maxTicketsPerCustomer',
            label: 'Max tickets per customer',
            type: 'number',
            span: 4,
            min: 1,
            max: 1000,
          },
          {
            key: 'maxExposurePerNumber',
            label: 'Maximum exposure per number',
            type: 'currency',
            span: 6,
            min: 0,
            prefix: '₭',
            hint: 'Sales on a single number stop once this liability is reached',
          },
          {
            key: 'claimWindowDays',
            label: 'Prize claim window',
            type: 'number',
            span: 6,
            min: 1,
            max: 365,
            suffix: 'days',
          },
        ],
      },
      {
        id: 'financial',
        title: 'Tax & commission',
        description: 'Rates applied automatically to every ticket and payout.',
        icon: 'percent',
        fields: [
          {
            key: 'taxPercent',
            label: 'Prize tax',
            type: 'percent',
            required: true,
            span: 4,
            suffix: '%',
            validators: [AppValidators.percentage()],
          },
          {
            key: 'agentCommissionPercent',
            label: 'Agent commission',
            type: 'percent',
            required: true,
            span: 4,
            suffix: '%',
            validators: [AppValidators.percentage()],
          },
          {
            key: 'retailerCommissionPercent',
            label: 'Retailer commission',
            type: 'percent',
            required: true,
            span: 4,
            suffix: '%',
            validators: [AppValidators.percentage()],
          },
        ],
      },
      {
        id: 'cancellation',
        title: 'Cancellation policy',
        icon: 'undo',
        fields: [
          {
            key: 'allowCancellation',
            label: 'Allow ticket cancellation',
            type: 'toggle',
            span: 6,
            hint: 'Retailers may void a ticket shortly after issuing it',
          },
          {
            key: 'cancellationWindowMinutes',
            label: 'Cancellation window',
            type: 'number',
            span: 6,
            min: 0,
            max: 120,
            suffix: 'min',
            visibleWhen: (value) => Boolean(value['allowCancellation']),
          },
        ],
      },
    ],
    validators: [AppValidators.timeAfter('openTime', 'closeTime')],
  };

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
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Lottery products could not be loaded.');
      },
    });
  }

  protected select(game: LotteryGame): void {
    this.selectedId.set(game.id);
  }

  protected save(value: Record<string, unknown>): void {
    const game = this.selected();
    if (!game) {
      return;
    }

    this.confirm
      .ask({
        title: `Apply configuration to ${game.name}?`,
        message:
          'These limits govern every sales channel immediately — retailers, POS terminals, mobile and web.',
        detail: 'The change is written to the audit trail with the previous values.',
        confirmLabel: 'Apply configuration',
        tone: 'warning',
        icon: 'tune',
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.saving.set(true);
        this.repository.saveConfiguration(game.id, value as unknown as LotteryConfiguration).subscribe({
          next: () => {
            this.saving.set(false);
            this.toast.success('Configuration applied', game.name);
            this.load();
          },
          error: () => {
            this.saving.set(false);
            this.toast.error('Save failed', 'The configuration could not be applied.');
          },
        });
      });
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/lottery']);
    } else if (action === 'prizes') {
      void this.router.navigate(['/lottery/prizes']);
    }
  }
}
