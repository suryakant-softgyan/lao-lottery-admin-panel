import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ReconciliationStatus, RefundStatus, TransactionStatus } from '@core/enums';
import { mockDataset } from '@core/mock/dataset';
import type {
  Bank,
  Page,
  PageQuery,
  PaymentGateway,
  PaymentTransaction,
  ReconciliationRecord,
  Refund,
  StatMetric,
} from '@core/models';
import { BaseRepository } from '@core/services/base-repository';
import { applyQuery } from '@core/utilities/query.util';
import { sumBy } from '@core/utilities/object.util';

/** Payments repository: gateway traffic, banks, refunds and reconciliation. */
@Injectable({ providedIn: 'root' })
export class PaymentRepository extends BaseRepository<PaymentTransaction> {
  protected readonly resourcePath = 'payments';

  protected override queryOptions = {
    searchFields: [
      'reference',
      'gatewayReference',
      'customerName',
      'customerPhone',
      'gatewayName',
      'bankName',
      'accountNumber',
    ],
    dateField: 'initiatedAt',
  };

  protected seed(): PaymentTransaction[] {
    return mockDataset.paymentTransactions;
  }

  /** Re-attempts a failed gateway transaction. */
  retry(id: string): Observable<PaymentTransaction> {
    const transaction = this.records.find((item) => item.id === id);
    if (!transaction) {
      return this.backend.notFound<PaymentTransaction>('Payment', id);
    }
    return this.patch(id, {
      status: TransactionStatus.Processing,
      retryCount: transaction.retryCount + 1,
      failureCode: undefined,
      failureReason: undefined,
    } as Partial<PaymentTransaction>);
  }

  markReconciled(id: string): Observable<PaymentTransaction> {
    return this.patch(id, {
      reconciliationStatus: ReconciliationStatus.Matched,
    } as Partial<PaymentTransaction>);
  }

  // -------------------------------------------------------------- gateways

  gateways(query: PageQuery): Observable<Page<PaymentGateway>> {
    return this.backend.respond(() =>
      applyQuery(mockDataset.gateways, query, {
        searchFields: ['name', 'code', 'provider'],
        dateField: 'createdAt',
      }),
    );
  }

  allGateways(): Observable<PaymentGateway[]> {
    return this.backend.respond(() => mockDataset.gateways);
  }

  setGatewayStatus(id: string, status: PaymentGateway['status']): Observable<PaymentGateway> {
    const index = mockDataset.gateways.findIndex((gateway) => gateway.id === id);
    if (index === -1) {
      return this.backend.notFound<PaymentGateway>('Gateway', id);
    }
    return this.backend.respond(() => {
      const updated: PaymentGateway = {
        ...(mockDataset.gateways[index] as PaymentGateway),
        status,
        updatedAt: new Date().toISOString(),
      };
      mockDataset.gateways[index] = updated;
      return updated;
    });
  }

  // ------------------------------------------------------------------ banks

  banks(query: PageQuery): Observable<Page<Bank>> {
    return this.backend.respond(() =>
      applyQuery(mockDataset.banks, query, {
        searchFields: ['name', 'nameLo', 'code', 'swiftCode', 'contactPerson'],
        dateField: 'createdAt',
      }),
    );
  }

  setBankActive(id: string, active: boolean): Observable<Bank> {
    const index = mockDataset.banks.findIndex((bank) => bank.id === id);
    if (index === -1) {
      return this.backend.notFound<Bank>('Bank', id);
    }
    return this.backend.respond(() => {
      const updated: Bank = {
        ...(mockDataset.banks[index] as Bank),
        active,
        updatedAt: new Date().toISOString(),
      };
      mockDataset.banks[index] = updated;
      return updated;
    });
  }

  // ---------------------------------------------------------------- refunds

  refunds(query: PageQuery): Observable<Page<Refund>> {
    return this.backend.respond(() =>
      applyQuery(mockDataset.refunds, query, {
        searchFields: ['reference', 'paymentReference', 'customerName', 'reason', 'requestedBy'],
        dateField: 'requestedAt',
      }),
    );
  }

  decideRefund(id: string, status: RefundStatus, actor: string, remarks?: string): Observable<Refund> {
    const index = mockDataset.refunds.findIndex((refund) => refund.id === id);
    if (index === -1) {
      return this.backend.notFound<Refund>('Refund', id);
    }
    return this.backend.respond(() => {
      const now = new Date().toISOString();
      const updated: Refund = {
        ...(mockDataset.refunds[index] as Refund),
        status,
        approvedBy: actor,
        approvedAt: now,
        completedAt: status === RefundStatus.Completed ? now : undefined,
        remarks,
        updatedAt: now,
      };
      mockDataset.refunds[index] = updated;
      return updated;
    });
  }

  // --------------------------------------------------------- reconciliation

  reconciliations(query: PageQuery): Observable<Page<ReconciliationRecord>> {
    return this.backend.respond(() =>
      applyQuery(mockDataset.reconciliations, query, {
        searchFields: ['batchReference', 'gatewayName', 'reconciledBy'],
        dateField: 'statementDate',
      }),
    );
  }

  resolveReconciliation(id: string, actor: string, remarks: string): Observable<ReconciliationRecord> {
    const index = mockDataset.reconciliations.findIndex((record) => record.id === id);
    if (index === -1) {
      return this.backend.notFound<ReconciliationRecord>('Reconciliation batch', id);
    }
    return this.backend.respond(() => {
      const updated: ReconciliationRecord = {
        ...(mockDataset.reconciliations[index] as ReconciliationRecord),
        status: ReconciliationStatus.Resolved,
        reconciledBy: actor,
        reconciledAt: new Date().toISOString(),
        remarks,
      };
      mockDataset.reconciliations[index] = updated;
      return updated;
    });
  }

  // -------------------------------------------------------------- statistics

  statistics(): Observable<StatMetric[]> {
    return this.backend.respond(() => {
      const payments = this.records;
      const count = (status: TransactionStatus): number =>
        payments.filter((payment) => payment.status === status).length;
      const successful = payments.filter((payment) => payment.status === TransactionStatus.Success);

      return [
        { id: 'total', label: 'Transactions', value: payments.length, icon: 'payments', tone: 'primary' },
        {
          id: 'success',
          label: 'Successful',
          value: successful.length,
          icon: 'check_circle',
          tone: 'success',
        },
        {
          id: 'failed',
          label: 'Failed',
          value: count(TransactionStatus.Failed),
          icon: 'error',
          tone: 'danger',
        },
        {
          id: 'pending',
          label: 'Pending',
          value: count(TransactionStatus.Pending) + count(TransactionStatus.Processing),
          icon: 'hourglass_top',
          tone: 'warning',
        },
        {
          id: 'volume',
          label: 'Processed value',
          value: sumBy(successful, (payment) => payment.amount),
          icon: 'account_balance',
          tone: 'primary',
        },
        {
          id: 'fees',
          label: 'Gateway fees',
          value: sumBy(successful, (payment) => payment.fee),
          icon: 'toll',
          tone: 'neutral',
        },
      ];
    });
  }

  /** Gateway health rollup for the gateway screen. */
  gatewayStatistics(): Observable<StatMetric[]> {
    return this.backend.respond(() => {
      const gateways = mockDataset.gateways;
      return [
        { id: 'gateways', label: 'Gateways', value: gateways.length, icon: 'hub', tone: 'primary' },
        {
          id: 'active',
          label: 'Active',
          value: gateways.filter((gateway) => gateway.status === 'ACTIVE').length,
          icon: 'check_circle',
          tone: 'success',
        },
        {
          id: 'degraded',
          label: 'Degraded',
          value: gateways.filter((gateway) => gateway.status === 'DEGRADED').length,
          icon: 'warning',
          tone: 'warning',
        },
        {
          id: 'volume',
          label: 'Volume today',
          value: sumBy(gateways, (gateway) => gateway.volumeToday),
          icon: 'payments',
          tone: 'info',
        },
      ];
    });
  }
}
