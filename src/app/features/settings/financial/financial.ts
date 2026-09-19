import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ConfirmService } from '@core/services/confirm.service';
import { StorageService } from '@core/services/storage.service';
import { ToastService } from '@core/services/toast.service';
import { DynamicForm } from '@shared/components/dynamic-form/dynamic-form';
import type { FormSchema } from '@shared/components/dynamic-form/dynamic-form.model';
import { PageHeader } from '@shared/components/page-header/page-header';
import { AppValidators } from '@shared/validators/app.validators';

interface FinancialConfiguration {
  defaultAgentCommission: number;
  defaultRetailerCommission: number;
  prizeTaxPercent: number;
  vatPercent: number;
  minWalletTopUp: number;
  maxWalletTopUp: number;
  minWithdrawal: number;
  maxWithdrawal: number;
  dailyWithdrawalLimit: number;
  settlementFrequency: string;
  settlementDay: string;
  autoSettlement: boolean;
  negativeBalanceAllowed: boolean;
  payoutApprovalThreshold: number;
  requireDualApproval: boolean;
}

const CONFIG_KEY = 'settings.financial';

/**
 * Financial rules.
 *
 * Commission defaults, tax rates, wallet limits and settlement cadence. Changes
 * here affect money movement, so saving asks for explicit confirmation.
 */
@Component({
  selector: 'll-financial-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, DynamicForm],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Financial Rules"
        eyebrow="Settings"
        subtitle="Commission defaults, tax rates, wallet limits and settlement cadence across the platform."
        icon="account_balance"
        [compact]="true" />

      <div class="ll-card">
        <div class="ll-card__body">
          <ll-dynamic-form
            [schema]="schema"
            [value]="model()"
            [submitting]="saving()"
            submitLabel="Apply financial rules"
            cancelLabel="Reset"
            (formSubmit)="save($event)"
            (cancelled)="reset()" />
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class FinancialSettings {
  private readonly storage = inject(StorageService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly saving = signal(false);

  private readonly defaults: FinancialConfiguration = {
    defaultAgentCommission: 7,
    defaultRetailerCommission: 4.5,
    prizeTaxPercent: 5,
    vatPercent: 10,
    minWalletTopUp: 10_000,
    maxWalletTopUp: 50_000_000,
    minWithdrawal: 50_000,
    maxWithdrawal: 20_000_000,
    dailyWithdrawalLimit: 100_000_000,
    settlementFrequency: 'WEEKLY',
    settlementDay: 'MONDAY',
    autoSettlement: true,
    negativeBalanceAllowed: false,
    payoutApprovalThreshold: 10_000_000,
    requireDualApproval: true,
  };

  private readonly stored = signal<FinancialConfiguration>(
    this.storage.get<FinancialConfiguration>(CONFIG_KEY, this.defaults),
  );

  protected readonly model = computed<Record<string, unknown>>(
    () => ({ ...this.stored() }) as unknown as Record<string, unknown>,
  );

  protected readonly schema: FormSchema = {
    sections: [
      {
        id: 'commission',
        title: 'Commission & tax',
        description: 'Defaults applied when an agent or retailer is onboarded without a bespoke plan.',
        icon: 'percent',
        fields: [
          {
            key: 'defaultAgentCommission',
            label: 'Default agent commission',
            type: 'percent',
            required: true,
            span: 6,
            suffix: '%',
            validators: [AppValidators.percentage()],
          },
          {
            key: 'defaultRetailerCommission',
            label: 'Default retailer commission',
            type: 'percent',
            required: true,
            span: 6,
            suffix: '%',
            validators: [AppValidators.percentage()],
          },
          {
            key: 'prizeTaxPercent',
            label: 'Prize tax',
            type: 'percent',
            required: true,
            span: 6,
            suffix: '%',
            hint: 'Withheld from every prize payout',
            validators: [AppValidators.percentage()],
          },
          {
            key: 'vatPercent',
            label: 'VAT',
            type: 'percent',
            span: 6,
            suffix: '%',
            validators: [AppValidators.percentage()],
          },
        ],
      },
      {
        id: 'wallet',
        title: 'Wallet limits',
        description: 'Enforced at the point of transaction on every channel.',
        icon: 'account_balance_wallet',
        fields: [
          { key: 'minWalletTopUp', label: 'Minimum top-up', type: 'currency', span: 6, min: 0, prefix: '₭' },
          { key: 'maxWalletTopUp', label: 'Maximum top-up', type: 'currency', span: 6, min: 0, prefix: '₭' },
          {
            key: 'minWithdrawal',
            label: 'Minimum withdrawal',
            type: 'currency',
            span: 6,
            min: 0,
            prefix: '₭',
          },
          {
            key: 'maxWithdrawal',
            label: 'Maximum withdrawal',
            type: 'currency',
            span: 6,
            min: 0,
            prefix: '₭',
          },
          {
            key: 'dailyWithdrawalLimit',
            label: 'Daily withdrawal limit',
            type: 'currency',
            span: 6,
            min: 0,
            prefix: '₭',
            hint: 'Per wallet, rolling 24 hours',
          },
          {
            key: 'negativeBalanceAllowed',
            label: 'Allow negative balances',
            type: 'toggle',
            span: 6,
            hint: 'Only sensible where agents trade against a credit limit',
          },
        ],
      },
      {
        id: 'settlement',
        title: 'Settlement',
        icon: 'receipt',
        fields: [
          {
            key: 'settlementFrequency',
            label: 'Settlement frequency',
            type: 'select',
            required: true,
            span: 6,
            options: [
              { value: 'DAILY', label: 'Daily' },
              { value: 'WEEKLY', label: 'Weekly' },
              { value: 'FORTNIGHTLY', label: 'Fortnightly' },
              { value: 'MONTHLY', label: 'Monthly' },
            ],
          },
          {
            key: 'settlementDay',
            label: 'Settlement day',
            type: 'select',
            span: 6,
            options: [
              { value: 'MONDAY', label: 'Monday' },
              { value: 'TUESDAY', label: 'Tuesday' },
              { value: 'WEDNESDAY', label: 'Wednesday' },
              { value: 'THURSDAY', label: 'Thursday' },
              { value: 'FRIDAY', label: 'Friday' },
            ],
            visibleWhen: (value) => value['settlementFrequency'] !== 'DAILY',
          },
          {
            key: 'autoSettlement',
            label: 'Generate settlements automatically',
            type: 'toggle',
            span: 12,
            hint: 'Runs at the end of each period; approval is still required before payment',
          },
        ],
      },
      {
        id: 'approvals',
        title: 'Payout approvals',
        description: 'Controls that stop a single operator releasing a large payout unchecked.',
        icon: 'gavel',
        fields: [
          {
            key: 'payoutApprovalThreshold',
            label: 'Approval threshold',
            type: 'currency',
            span: 6,
            min: 0,
            prefix: '₭',
            hint: 'Payouts above this amount require explicit approval',
          },
          {
            key: 'requireDualApproval',
            label: 'Require dual approval above the threshold',
            type: 'toggle',
            span: 6,
            hint: 'Two different operators must approve',
          },
        ],
      },
    ],
  };

  protected save(value: Record<string, unknown>): void {
    this.confirm
      .ask({
        title: 'Apply these financial rules?',
        message:
          'Commission, tax and wallet limits take effect immediately for every new transaction across all channels.',
        detail: 'Existing transactions and settlements already generated are unaffected.',
        confirmLabel: 'Apply rules',
        tone: 'warning',
        icon: 'account_balance',
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.saving.set(true);
        const configuration = value as unknown as FinancialConfiguration;
        this.stored.set(configuration);
        this.storage.set(CONFIG_KEY, configuration);
        this.saving.set(false);
        this.toast.success('Financial rules applied');
      });
  }

  protected reset(): void {
    this.stored.set(this.defaults);
    this.storage.set(CONFIG_KEY, this.defaults);
    this.toast.info('Financial rules reset to defaults');
  }
}
