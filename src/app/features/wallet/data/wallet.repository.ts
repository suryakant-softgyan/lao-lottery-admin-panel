import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  SettlementStatus,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
  WalletOwnerType,
  WalletStatus,
} from '@core/enums';
import { mockDataset } from '@core/mock/dataset';
import type { Page, PageQuery, Settlement, StatMetric, Wallet, WalletTransaction } from '@core/models';
import { BaseRepository } from '@core/services/base-repository';
import { applyQuery } from '@core/utilities/query.util';
import { sumBy } from '@core/utilities/object.util';

/** Payload for the transfer / adjustment console. */
export interface TransferRequest {
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  type: TransactionType;
  narration: string;
  reference?: string;
}

/** Wallet ledger repository: balances, movements, transfers and settlements. */
@Injectable({ providedIn: 'root' })
export class WalletRepository extends BaseRepository<Wallet> {
  protected readonly resourcePath = 'wallets';

  protected override queryOptions = {
    searchFields: ['code', 'ownerName', 'ownerType', 'province'],
    dateField: 'createdAt',
  };

  protected seed(): Wallet[] {
    return mockDataset.wallets;
  }

  freeze(id: string, reason: string, actor: string): Observable<Wallet> {
    return this.patch(id, {
      status: WalletStatus.Frozen,
      frozenAt: new Date().toISOString(),
      frozenBy: actor,
      freezeReason: reason,
    } as Partial<Wallet>);
  }

  unfreeze(id: string): Observable<Wallet> {
    return this.patch(id, {
      status: WalletStatus.Active,
      frozenAt: undefined,
      frozenBy: undefined,
      freezeReason: undefined,
    } as Partial<Wallet>);
  }

  // ------------------------------------------------------------ transactions

  transactions(query: PageQuery): Observable<Page<WalletTransaction>> {
    return this.backend.respond(() =>
      applyQuery(mockDataset.walletTransactions, query, {
        searchFields: ['reference', 'ownerName', 'walletCode', 'narration', 'counterpartyName'],
        dateField: 'createdAt',
      }),
    );
  }

  transactionsOf(walletId: string): Observable<WalletTransaction[]> {
    return this.backend.respond(() =>
      mockDataset.walletTransactions.filter((entry) => entry.walletId === walletId).slice(0, 30),
    );
  }

  /**
   * Records a double-entry movement between two wallets.
   *
   * The mock writes both legs so balances stay internally consistent — the same
   * invariant the ledger service will enforce server-side.
   */
  transfer(request: TransferRequest, actor: string): Observable<WalletTransaction> {
    const from = this.records.find((wallet) => wallet.id === request.fromWalletId);
    const to = this.records.find((wallet) => wallet.id === request.toWalletId);

    if (!from || !to) {
      return this.backend.fail<WalletTransaction>(200, 404, 'One of the wallets was not found');
    }
    if (from.status !== WalletStatus.Active || to.status !== WalletStatus.Active) {
      return this.backend.fail<WalletTransaction>(200, 409, 'Both wallets must be active to transfer');
    }
    if (from.availableBalance < request.amount) {
      return this.backend.fail<WalletTransaction>(200, 409, 'Insufficient available balance');
    }

    return this.backend.respond(() => {
      const now = new Date().toISOString();
      const reference = request.reference ?? `WTX${Date.now().toString().slice(-12)}`;

      const debit: WalletTransaction = {
        id: `wtx-${Date.now().toString(36)}-d`,
        reference,
        walletId: from.id,
        walletCode: from.code,
        ownerName: from.ownerName,
        ownerType: from.ownerType,
        type: request.type,
        direction: TransactionDirection.Debit,
        status: TransactionStatus.Success,
        amount: request.amount,
        fee: 0,
        tax: 0,
        netAmount: request.amount,
        currency: from.currency,
        balanceBefore: from.balance,
        balanceAfter: from.balance - request.amount,
        counterpartyId: to.id,
        counterpartyName: to.ownerName,
        narration: request.narration,
        processedAt: now,
        tenantId: from.tenantId,
        createdAt: now,
        createdBy: actor,
        updatedAt: now,
      };

      const credit: WalletTransaction = {
        ...debit,
        id: `wtx-${Date.now().toString(36)}-c`,
        walletId: to.id,
        walletCode: to.code,
        ownerName: to.ownerName,
        ownerType: to.ownerType,
        direction: TransactionDirection.Credit,
        balanceBefore: to.balance,
        balanceAfter: to.balance + request.amount,
        counterpartyId: from.id,
        counterpartyName: from.ownerName,
      };

      // Apply both legs, then publish them to the ledger.
      from.balance -= request.amount;
      from.availableBalance -= request.amount;
      to.balance += request.amount;
      to.availableBalance += request.amount;
      mockDataset.walletTransactions.unshift(credit, debit);

      return debit;
    });
  }

  // -------------------------------------------------------------- settlements

  settlements(query: PageQuery): Observable<Page<Settlement>> {
    return this.backend.respond(() =>
      applyQuery(mockDataset.settlements, query, {
        searchFields: ['reference', 'partyName', 'bankName', 'paymentReference'],
        dateField: 'periodEnd',
      }),
    );
  }

  approveSettlement(id: string, actor: string): Observable<Settlement> {
    const index = mockDataset.settlements.findIndex((item) => item.id === id);
    if (index === -1) {
      return this.backend.notFound<Settlement>('Settlement', id);
    }
    return this.backend.respond(() => {
      const updated: Settlement = {
        ...(mockDataset.settlements[index] as Settlement),
        status: SettlementStatus.Approved,
        approvedBy: actor,
        approvedAt: new Date().toISOString(),
      };
      mockDataset.settlements[index] = updated;
      return updated;
    });
  }

  paySettlement(id: string, reference: string): Observable<Settlement> {
    const index = mockDataset.settlements.findIndex((item) => item.id === id);
    if (index === -1) {
      return this.backend.notFound<Settlement>('Settlement', id);
    }
    return this.backend.respond(() => {
      const updated: Settlement = {
        ...(mockDataset.settlements[index] as Settlement),
        status: SettlementStatus.Paid,
        paidAt: new Date().toISOString(),
        paymentReference: reference,
      };
      mockDataset.settlements[index] = updated;
      return updated;
    });
  }

  // -------------------------------------------------------------- statistics

  statistics(): Observable<StatMetric[]> {
    return this.backend.respond(() => {
      const wallets = this.records;
      const network = wallets.filter((wallet) => wallet.ownerType !== WalletOwnerType.System);

      return [
        {
          id: 'wallets',
          label: 'Wallet accounts',
          value: wallets.length,
          icon: 'account_balance_wallet',
          tone: 'primary',
        },
        {
          id: 'balance',
          label: 'Network balance',
          value: sumBy(network, (wallet) => wallet.balance),
          icon: 'savings',
          tone: 'success',
        },
        {
          id: 'held',
          label: 'Held funds',
          value: sumBy(network, (wallet) => wallet.heldBalance),
          icon: 'lock',
          tone: 'warning',
        },
        {
          id: 'frozen',
          label: 'Frozen accounts',
          value: wallets.filter((wallet) => wallet.status === WalletStatus.Frozen).length,
          icon: 'ac_unit',
          tone: 'info',
        },
        {
          id: 'system',
          label: 'Prize pool',
          value: sumBy(
            wallets.filter((wallet) => wallet.ownerType === WalletOwnerType.System),
            (wallet) => wallet.balance,
          ),
          icon: 'account_balance',
          tone: 'primary',
        },
        {
          id: 'credit',
          label: 'Credit extended',
          value: sumBy(network, (wallet) => wallet.creditLimit),
          icon: 'credit_score',
          tone: 'neutral',
        },
      ];
    });
  }

  /** Active wallets as picker options for the transfer console. */
  transferOptions(): { value: string; label: string; description: string }[] {
    return this.records
      .filter((wallet) => wallet.status === WalletStatus.Active)
      .slice(0, 60)
      .map((wallet) => ({
        value: wallet.id,
        label: `${wallet.ownerName} (${wallet.code})`,
        description: `${wallet.ownerType} · balance ${wallet.balance.toLocaleString()} ₭`,
      }));
  }

  byId(walletId: string): Wallet | undefined {
    return this.records.find((wallet) => wallet.id === walletId);
  }
}
