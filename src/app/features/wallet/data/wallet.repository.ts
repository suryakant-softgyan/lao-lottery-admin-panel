import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

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
import { num } from '@core/api/live.util';
import { PLACEHOLDER } from '@core/constants/app.constants';
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
    if (this.live) {
      return this.liveFreeze(id, "freeze", reason);
    }
    return this.patch(id, {
      status: WalletStatus.Frozen,
      frozenAt: new Date().toISOString(),
      frozenBy: actor,
      freezeReason: reason,
    } as Partial<Wallet>);
  }

  unfreeze(id: string): Observable<Wallet> {
    if (this.live) {
      return this.liveFreeze(id, "unfreeze", "Unfrozen from the admin portal");
    }
    return this.patch(id, {
      status: WalletStatus.Active,
      frozenAt: undefined,
      frozenBy: undefined,
      freezeReason: undefined,
    } as Partial<Wallet>);
  }

  // ------------------------------------------------------------ transactions

  transactions(query: PageQuery): Observable<Page<WalletTransaction>> {
    if (this.live) {
      return this.livePage("admin/wallets/transactions", query, (row) => this.txFromApi(row));
    }
    return this.backend.respond(() =>
      applyQuery(mockDataset.walletTransactions, query, {
        searchFields: ['reference', 'ownerName', 'walletCode', 'narration', 'counterpartyName'],
        dateField: 'createdAt',
      }),
    );
  }

  transactionsOf(walletId: string): Observable<WalletTransaction[]> {
    if (this.live) {
      return this.livePage("admin/wallets/transactions", { page: 0, size: 30 }, (row) => this.txFromApi(row), { walletId }).pipe(map((page) => page.content));
    }
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
    if (this.live) {
      return this.liveTransfer(request, actor);
    }
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
    if (this.live) {
      return this.livePage("admin/payments/settlements", query, (row) => row as Settlement);
    }
    return this.backend.respond(() =>
      applyQuery(mockDataset.settlements, query, {
        searchFields: ['reference', 'partyName', 'bankName', 'paymentReference'],
        dateField: 'periodEnd',
      }),
    );
  }

  approveSettlement(id: string, actor: string): Observable<Settlement> {
    if (this.live) {
      return this.http.post<Settlement>(this.api(`admin/payments/settlements/${id}/review`), { approved: true });
    }
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
    if (this.live) {
      return this.http.post<Settlement>(this.api(`admin/payments/settlements/${id}/pay`), { paymentReference: reference });
    }
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
    if (this.live) {
      return this.liveStatistics();
    }
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
  // =====================================================================================
  // Live API implementation
  // =====================================================================================

  /** The ledger filter chip is called `direction`; on the API that name is the sort direction. */
  protected override paramAliases = { direction: 'flow' };

  protected override fromApi(record: unknown): Wallet {
    const api = record as Wallet;
    return { ...api, ownerAvatar: api.ownerAvatar || PLACEHOLDER.avatar(api.ownerName) };
  }

  private txFromApi(record: unknown): WalletTransaction {
    const api = record as WalletTransaction;
    return { ...api, narration: api.narration ?? '' };
  }

  private liveFreeze(id: string, action: 'freeze' | 'unfreeze', reason: string): Observable<Wallet> {
    return this.http.post<unknown>(`${this.baseUrl}/${id}/${action}`, { reason }).pipe(map((row) => this.fromApi(row)));
  }

  protected override livePatch(id: string, changes: Partial<Wallet>): Observable<Wallet> {
    if (changes.status === WalletStatus.Frozen) {
      return this.liveFreeze(id, 'freeze', changes.freezeReason ?? 'Frozen from the admin portal');
    }
    if (changes.status === WalletStatus.Active) {
      return this.liveFreeze(id, 'unfreeze', 'Unfrozen from the admin portal');
    }
    if (changes.creditLimit !== undefined) {
      return this.http
        .put<unknown>(`${this.baseUrl}/${id}/credit-limit`, { creditLimit: changes.creditLimit })
        .pipe(map((row) => this.fromApi(row)));
    }
    return super.livePatch(id, changes);
  }

  /**
   * Money never moves on one person's say-so: the API parks the transfer in the approval queue and a
   * second user releases it. The pending request is returned in ledger shape so the console can show it.
   */
  private liveTransfer(request: TransferRequest, actor: string): Observable<WalletTransaction> {
    const from = this.records.find((wallet) => wallet.id === request.fromWalletId);
    const to = this.records.find((wallet) => wallet.id === request.toWalletId);
    return this.http
      .post<{ id: string; summary: string; createdAt: string }>(this.api('admin/wallets/transfer'), {
        fromWalletId: request.fromWalletId,
        toWalletId: request.toWalletId,
        amount: request.amount,
        narration: request.narration,
      })
      .pipe(
        map((approval) => ({
          id: approval.id,
          reference: request.reference ?? `APPROVAL-${approval.id.slice(0, 8).toUpperCase()}`,
          walletId: request.fromWalletId,
          walletCode: from?.code ?? '',
          ownerName: from?.ownerName ?? '',
          ownerType: from?.ownerType ?? WalletOwnerType.System,
          type: request.type,
          direction: TransactionDirection.Debit,
          status: TransactionStatus.Pending,
          amount: request.amount,
          fee: 0,
          tax: 0,
          netAmount: request.amount,
          currency: from?.currency ?? 'LAK',
          balanceBefore: from?.balance ?? 0,
          balanceAfter: from?.balance ?? 0,
          counterpartyId: request.toWalletId,
          counterpartyName: to?.ownerName,
          narration: `${request.narration} — awaiting approval by a second user`,
          tenantId: from?.tenantId ?? '',
          createdAt: approval.createdAt,
          createdBy: actor,
        })),
      );
  }

  private liveStatistics(): Observable<StatMetric[]> {
    return this.http.get<Record<string, number>>(this.api('admin/stats/wallets')).pipe(
      map((totals) => [
        { id: 'wallets', label: 'Wallet accounts', value: num(totals['wallets']), icon: 'account_balance_wallet', tone: 'primary' as const },
        { id: 'balance', label: 'Network balance', value: num(totals['networkBalance']), icon: 'savings', tone: 'success' as const },
        { id: 'held', label: 'Held funds', value: num(totals['heldFunds']), icon: 'lock_clock', tone: 'warning' as const },
        { id: 'frozen', label: 'Frozen accounts', value: num(totals['frozen']), icon: 'ac_unit', tone: 'danger' as const },
        { id: 'system', label: 'Prize pool', value: num(totals['systemBalance']), icon: 'emoji_events', tone: 'info' as const },
        { id: 'credit', label: 'Credit extended', value: num(totals['creditExtended']), icon: 'credit_score', tone: 'neutral' as const },
      ]),
    );
  }
}
