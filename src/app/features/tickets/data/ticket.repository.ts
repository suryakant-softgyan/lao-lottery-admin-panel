import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ClaimStatus, TicketStatus } from '@core/enums';
import { mockDataset } from '@core/mock/dataset';
import type { Page, PageQuery, StatMetric, Ticket, TimelineEvent } from '@core/models';
import { BaseRepository } from '@core/services/base-repository';
import { applyQuery } from '@core/utilities/query.util';
import { sumBy } from '@core/utilities/object.util';

/** Outcome of scanning or keying a ticket at the validation counter. */
export interface ValidationResult {
  found: boolean;
  ticket?: Ticket;
  /** Why the ticket cannot be paid, when it cannot. */
  reason?: string;
  payable: boolean;
  grossPayout: number;
  tax: number;
  netPayout: number;
}

/** Ticket repository: sales, winners, cancellations and counter validation. */
@Injectable({ providedIn: 'root' })
export class TicketRepository extends BaseRepository<Ticket> {
  protected readonly resourcePath = 'tickets';

  protected override queryOptions = {
    searchFields: [
      'ticketNumber',
      'serialNumber',
      'barcode',
      'customerName',
      'customerPhone',
      'retailerName',
      'agentName',
      'drawCode',
      'lotteryName',
    ],
    dateField: 'purchasedAt',
  };

  protected seed(): Ticket[] {
    return mockDataset.tickets;
  }

  /** Winning and claimed tickets. */
  winning(query: PageQuery): Observable<Page<Ticket>> {
    const rows = this.records.filter(
      (ticket) => ticket.status === TicketStatus.Winning || ticket.status === TicketStatus.Claimed,
    );
    return this.backend.respond(() => applyQuery(rows, query, this.queryOptions));
  }

  /** Cancelled and voided tickets — the anomaly worklist. */
  cancelled(query: PageQuery): Observable<Page<Ticket>> {
    const rows = this.records.filter(
      (ticket) => ticket.status === TicketStatus.Cancelled || ticket.status === TicketStatus.Void,
    );
    return this.backend.respond(() => applyQuery(rows, query, this.queryOptions));
  }

  cancel(id: string, reason: string, actor: string): Observable<Ticket> {
    return this.patch(id, {
      status: TicketStatus.Cancelled,
      cancelledAt: new Date().toISOString(),
      cancelledBy: actor,
      cancellationReason: reason,
    } as Partial<Ticket>);
  }

  void(id: string, reason: string, actor: string): Observable<Ticket> {
    return this.patch(id, {
      status: TicketStatus.Void,
      cancelledAt: new Date().toISOString(),
      cancelledBy: actor,
      cancellationReason: reason,
    } as Partial<Ticket>);
  }

  /** Marks a winning ticket as paid out at the counter. */
  payout(id: string, actor: string): Observable<Ticket> {
    return this.patch(id, {
      status: TicketStatus.Claimed,
      claimStatus: ClaimStatus.Paid,
      claimedAt: new Date().toISOString(),
      claimedBy: actor,
      validatedAt: new Date().toISOString(),
      validatedBy: actor,
    } as Partial<Ticket>);
  }

  setClaimStatus(id: string, claimStatus: ClaimStatus): Observable<Ticket> {
    return this.patch(id, { claimStatus } as Partial<Ticket>);
  }

  /**
   * Counter validation.
   *
   * Accepts a ticket number, serial, barcode or QR payload and returns whether
   * the ticket can be paid, with the exact reason when it cannot — which is
   * what the person at the counter actually needs to see.
   */
  validate(code: string): Observable<ValidationResult> {
    return this.backend
      .respond(
        () => {
          const needle = code.trim().toLowerCase();
          const ticket = this.records.find(
            (item) =>
              item.ticketNumber.toLowerCase() === needle ||
              item.serialNumber.toLowerCase() === needle ||
              item.barcode.toLowerCase() === needle ||
              item.qrPayload.toLowerCase() === needle,
          );

          if (!ticket) {
            return {
              found: false,
              payable: false,
              grossPayout: 0,
              tax: 0,
              netPayout: 0,
              reason: 'No ticket matches this number. Check the code and try again.',
            } satisfies ValidationResult;
          }

          const result: ValidationResult = {
            found: true,
            ticket,
            payable: false,
            grossPayout: ticket.totalPayout,
            tax: ticket.taxDeducted,
            netPayout: ticket.netPayout,
          };

          switch (ticket.status) {
            case TicketStatus.Winning:
              if (Date.parse(ticket.expiresAt) < Date.now()) {
                return { ...result, reason: 'The claim window for this ticket has expired.' };
              }
              return { ...result, payable: true };
            case TicketStatus.Claimed:
              return { ...result, reason: `Already paid on ${ticket.claimedAt?.slice(0, 10)}.` };
            case TicketStatus.Cancelled:
              return {
                ...result,
                reason: `Cancelled: ${ticket.cancellationReason ?? 'no reason recorded'}.`,
              };
            case TicketStatus.Void:
              return { ...result, reason: 'This ticket has been voided and carries no value.' };
            case TicketStatus.Expired:
              return { ...result, reason: 'The claim window for this ticket has expired.' };
            case TicketStatus.Pending:
              return { ...result, reason: 'Payment for this ticket has not been confirmed.' };
            default:
              return { ...result, reason: 'This ticket did not win a prize in its draw.' };
          }
        },
        { latencyMs: 320 },
      )
      .pipe(map((result) => result));
  }

  statistics(): Observable<StatMetric[]> {
    return this.backend.respond(() => {
      const tickets = this.records;
      const count = (status: TicketStatus): number =>
        tickets.filter((ticket) => ticket.status === status).length;

      return [
        {
          id: 'total',
          label: 'Total tickets',
          value: tickets.length,
          icon: 'confirmation_number',
          tone: 'primary',
        },
        {
          id: 'sold',
          label: 'Sold',
          value: count(TicketStatus.Sold),
          icon: 'shopping_cart_checkout',
          tone: 'info',
        },
        {
          id: 'winning',
          label: 'Winning',
          value: count(TicketStatus.Winning),
          icon: 'emoji_events',
          tone: 'success',
        },
        {
          id: 'claimed',
          label: 'Claimed',
          value: count(TicketStatus.Claimed),
          icon: 'redeem',
          tone: 'success',
        },
        {
          id: 'cancelled',
          label: 'Cancelled',
          value: count(TicketStatus.Cancelled),
          icon: 'cancel',
          tone: 'danger',
        },
        {
          id: 'stake',
          label: 'Total stake',
          value: sumBy(tickets, (ticket) => ticket.totalStake),
          icon: 'payments',
          tone: 'primary',
        },
      ];
    });
  }

  /** Unclaimed prizes — a compliance-reportable liability. */
  unclaimedStatistics(): Observable<StatMetric[]> {
    return this.backend.respond(() => {
      const winners = this.records.filter(
        (ticket) => ticket.status === TicketStatus.Winning || ticket.status === TicketStatus.Claimed,
      );
      const unclaimed = winners.filter((ticket) => ticket.claimStatus === ClaimStatus.Unclaimed);

      return [
        {
          id: 'winners',
          label: 'Winning tickets',
          value: winners.length,
          icon: 'emoji_events',
          tone: 'success',
        },
        {
          id: 'unclaimed',
          label: 'Unclaimed',
          value: unclaimed.length,
          icon: 'pending_actions',
          tone: 'warning',
        },
        {
          id: 'liability',
          label: 'Unclaimed value',
          value: sumBy(unclaimed, (ticket) => ticket.netPayout),
          icon: 'account_balance',
          tone: 'danger',
        },
        {
          id: 'paid',
          label: 'Paid out',
          value: sumBy(
            winners.filter((ticket) => ticket.claimStatus === ClaimStatus.Paid),
            (ticket) => ticket.netPayout,
          ),
          icon: 'paid',
          tone: 'success',
        },
      ];
    });
  }

  /** Ticket lifecycle for the detail page. */
  timeline(ticket: Ticket): Observable<TimelineEvent[]> {
    return this.backend.respond(() => {
      const events: TimelineEvent[] = [
        {
          id: 'sold',
          title: 'Ticket issued',
          description: `Sold through ${ticket.retailerName ?? ticket.channel} for ${ticket.lotteryName}.`,
          actor: ticket.retailerName ?? 'Sales channel',
          timestamp: ticket.purchasedAt,
          icon: 'point_of_sale',
          tone: 'primary',
          meta: { Channel: ticket.channel, Draw: ticket.drawCode },
        },
      ];

      if (ticket.cancelledAt) {
        events.push({
          id: 'cancelled',
          title: 'Ticket cancelled',
          description: ticket.cancellationReason,
          actor: ticket.cancelledBy ?? 'Retailer',
          timestamp: ticket.cancelledAt,
          icon: 'cancel',
          tone: 'danger',
        });
      }
      if (ticket.status === TicketStatus.Winning || ticket.status === TicketStatus.Claimed) {
        events.push({
          id: 'won',
          title: 'Winning ticket confirmed',
          description: `Prize of ${ticket.totalPayout.toLocaleString()} ₭ before tax.`,
          actor: 'Draw Engine',
          timestamp: ticket.purchasedAt,
          icon: 'emoji_events',
          tone: 'success',
        });
      }
      if (ticket.validatedAt) {
        events.push({
          id: 'validated',
          title: 'Ticket validated',
          actor: ticket.validatedBy ?? 'Counter',
          timestamp: ticket.validatedAt,
          icon: 'verified',
          tone: 'success',
        });
      }
      if (ticket.claimedAt) {
        events.push({
          id: 'claimed',
          title: 'Prize paid',
          description: `Net payout ${ticket.netPayout.toLocaleString()} ₭ after ${ticket.taxDeducted.toLocaleString()} ₭ tax.`,
          actor: ticket.claimedBy ?? 'Counter',
          timestamp: ticket.claimedAt,
          icon: 'paid',
          tone: 'success',
        });
      }

      return events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    });
  }
}
