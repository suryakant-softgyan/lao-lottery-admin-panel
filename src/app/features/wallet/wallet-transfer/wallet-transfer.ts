import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '@core/authentication/auth.service';
import { TransactionType } from '@core/enums';
import type { Wallet } from '@core/models';
import { ConfirmService } from '@core/services/confirm.service';
import { ThemeService } from '@core/services/theme.service';
import { ToastService } from '@core/services/toast.service';
import { formatCurrency, humanise } from '@core/utilities/format.util';
import { DynamicForm } from '@shared/components/dynamic-form/dynamic-form';
import type { FormSchema } from '@shared/components/dynamic-form/dynamic-form.model';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { WALLET_STATUS_MAP } from '@core/constants/status-maps.constants';
import { AppValidators } from '@shared/validators/app.validators';
import { WalletRepository, type TransferRequest } from '../data/wallet.repository';

/**
 * Transfer and adjustment console.
 *
 * Moving money between wallets is the highest-risk routine action in the
 * portal, so the screen shows both sides of the movement live — including the
 * resulting balances — and the submission requires typed confirmation.
 */
@Component({
  selector: 'll-wallet-transfer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, DynamicForm, StatusBadge],
  templateUrl: './wallet-transfer.html',
  styleUrl: './wallet-transfer.scss',
})
export class WalletTransfer {
  private readonly repository = inject(WalletRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);

  protected readonly statusMap = WALLET_STATUS_MAP;

  protected readonly submitting = signal(false);

  /** Mirrors the live form value so the preview stays in step. */
  protected readonly draft = signal<Record<string, unknown>>({});

  private readonly options = this.repository.transferOptions();

  protected readonly model = computed<Record<string, unknown>>(() => ({
    fromWalletId: this.route.snapshot.queryParamMap.get('from') ?? '',
    toWalletId: '',
    type: TransactionType.Transfer,
    amount: null,
    narration: '',
  }));

  protected readonly source = computed<Wallet | undefined>(() =>
    this.repository.byId(String(this.draft()['fromWalletId'] ?? '')),
  );

  protected readonly destination = computed<Wallet | undefined>(() =>
    this.repository.byId(String(this.draft()['toWalletId'] ?? '')),
  );

  protected readonly amount = computed(() => Number(this.draft()['amount'] ?? 0));

  /** Blocks submission when the transfer cannot possibly succeed. */
  protected readonly problem = computed(() => {
    const from = this.source();
    const to = this.destination();
    const amount = this.amount();

    if (from && to && from.id === to.id) {
      return 'The source and destination wallets must be different.';
    }
    if (from && amount > 0 && amount > from.availableBalance) {
      return `Insufficient available balance — ${formatCurrency(from.availableBalance)} is available.`;
    }
    return null;
  });

  protected readonly schema: FormSchema = {
    sections: [
      {
        id: 'movement',
        title: 'Movement',
        description: 'Both wallets must be active. The movement is posted as a double entry.',
        icon: 'sync_alt',
        fields: [
          {
            key: 'fromWalletId',
            label: 'From wallet',
            type: 'select',
            required: true,
            span: 6,
            icon: 'north_east',
            options: this.options,
          },
          {
            key: 'toWalletId',
            label: 'To wallet',
            type: 'select',
            required: true,
            span: 6,
            icon: 'south_west',
            options: this.options,
          },
          {
            key: 'type',
            label: 'Movement type',
            type: 'select',
            required: true,
            span: 6,
            options: [
              TransactionType.Transfer,
              TransactionType.Deposit,
              TransactionType.Withdrawal,
              TransactionType.Settlement,
              TransactionType.Commission,
              TransactionType.Adjustment,
            ].map((value) => ({ value, label: humanise(value) })),
          },
          {
            key: 'amount',
            label: 'Amount',
            type: 'currency',
            required: true,
            span: 6,
            min: 1000,
            prefix: '₭',
            hint: 'Minimum 1,000 ₭',
            validators: [AppValidators.min(1000, 'Amount')],
          },
          {
            key: 'narration',
            label: 'Narration',
            type: 'textarea',
            required: true,
            span: 12,
            rows: 2,
            maxLength: 240,
            hint: 'Appears on both ledger entries and in the audit trail',
          },
        ],
      },
    ],
  };

  protected humanise(value: string): string {
    return humanise(value);
  }

  protected money(value: number | undefined): string {
    return formatCurrency(value ?? 0, this.theme.regional().currency, this.theme.regional().locale);
  }

  /** Projected balance after the movement, shown live in the preview. */
  protected projectedSource(): number {
    return (this.source()?.balance ?? 0) - this.amount();
  }

  protected projectedDestination(): number {
    return (this.destination()?.balance ?? 0) + this.amount();
  }

  protected onValueChange(value: Record<string, unknown>): void {
    this.draft.set(value);
  }

  protected submit(value: Record<string, unknown>): void {
    if (this.problem()) {
      this.toast.error('Transfer blocked', this.problem() ?? '');
      return;
    }

    const request: TransferRequest = {
      fromWalletId: String(value['fromWalletId']),
      toWalletId: String(value['toWalletId']),
      amount: Number(value['amount']),
      type: value['type'] as TransactionType,
      narration: String(value['narration']),
    };

    this.confirm
      .open({
        title: 'Post this movement?',
        message: `${this.money(request.amount)} will move from ${this.source()?.ownerName} to ${this.destination()?.ownerName}.`,
        detail: 'Wallet movements cannot be edited — only reversed by a compensating entry.',
        confirmLabel: 'Post movement',
        tone: 'danger',
        icon: 'sync_alt',
        requireTypedConfirmation: 'TRANSFER',
      })
      .subscribe((result) => {
        if (!result.confirmed) {
          return;
        }

        this.submitting.set(true);
        this.repository.transfer(request, this.auth.user()?.fullName ?? 'Finance').subscribe({
          next: (transaction) => {
            this.submitting.set(false);
            this.toast.success('Movement posted', `Reference ${transaction.reference}`);
            void this.router.navigate(['/wallet/transactions']);
          },
          error: () => {
            this.submitting.set(false);
            this.toast.error('Transfer failed', 'The movement could not be posted.');
          },
        });
      });
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/wallet']);
    } else if (action === 'transactions') {
      void this.router.navigate(['/wallet/transactions']);
    }
  }
}
