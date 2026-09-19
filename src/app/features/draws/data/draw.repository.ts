import { Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { auditToTimeline, num, type ApiAuditEntry } from '@core/api/live.util';

import { DrawStatus, SortDirection } from '@core/enums';
import { mockDataset } from '@core/mock/dataset';
import type { Draw, DrawWinningNumber, Page, PageQuery, StatMetric, TimelineEvent } from '@core/models';
import { BaseRepository } from '@core/services/base-repository';
import { applyQuery } from '@core/utilities/query.util';
import { sumBy } from '@core/utilities/object.util';

/**
 * Draw lifecycle repository.
 *
 * Draws move through a strict state machine — scheduled → sales open → sales
 * closed → drawing → pending verification → published — and every transition
 * here is one an operator with the matching permission can trigger.
 */
@Injectable({ providedIn: 'root' })
export class DrawRepository extends BaseRepository<Draw> {
  protected readonly resourcePath = 'draws';

  protected override queryOptions = {
    searchFields: ['code', 'lotteryName', 'lotteryType', 'status'],
    dateField: 'scheduledAt',
  };

  protected seed(): Draw[] {
    return mockDataset.draws;
  }

  /** Draws that have not yet taken place, soonest first. */
  upcoming(query: PageQuery): Observable<Page<Draw>> {
    if (this.live) {
      return this.livePage(this.livePath, { ...query, sort: query.sort?.active ? query.sort : { active: "scheduledAt", direction: SortDirection.Asc } }, (row) => this.fromApi(row), { status: "SCHEDULED,SALES_OPEN,SALES_CLOSED,DRAWING" });
    }
    const now = Date.now();
    const rows = this.records
      .filter((draw) => Date.parse(draw.scheduledAt) >= now || draw.status === DrawStatus.SalesOpen)
      .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
    return this.backend.respond(() => applyQuery(rows, query, this.queryOptions));
  }

  /** Draws awaiting verification or already published — the results worklist. */
  results(query: PageQuery): Observable<Page<Draw>> {
    if (this.live) {
      return this.livePage(this.livePath, query, (row) => this.fromApi(row), { status: "PENDING_VERIFICATION,PUBLISHED,ROLLED_BACK" });
    }
    const rows = this.records.filter(
      (draw) =>
        draw.status === DrawStatus.PendingVerification ||
        draw.status === DrawStatus.Published ||
        draw.status === DrawStatus.RolledBack,
    );
    return this.backend.respond(() => applyQuery(rows, query, this.queryOptions));
  }

  /** Draws eligible for the live studio. */
  liveCandidates(): Observable<Draw[]> {
    if (this.live) {
      return this.livePage(this.livePath, { page: 0, size: 50, sort: { active: "scheduledAt", direction: SortDirection.Asc } }, (row) => this.fromApi(row), { status: "SALES_OPEN,SALES_CLOSED,DRAWING,PENDING_VERIFICATION" }).pipe(map((page) => page.content));
    }
    return this.backend.respond(() =>
      this.records
        .filter((draw) =>
          [
            DrawStatus.SalesOpen,
            DrawStatus.SalesClosed,
            DrawStatus.Drawing,
            DrawStatus.PendingVerification,
          ].includes(draw.status),
        )
        .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)),
    );
  }

  closeSales(id: string): Observable<Draw> {
    if (this.live) {
      return this.command(id, "close-sales");
    }
    return this.patch(id, { status: DrawStatus.SalesClosed } as Partial<Draw>);
  }

  startDrawing(id: string): Observable<Draw> {
    if (this.live) {
      return this.command(id, "start");
    }
    return this.patch(id, { status: DrawStatus.Drawing } as Partial<Draw>);
  }

  /** Records the drawn numbers and moves the draw to verification. */
  recordNumbers(id: string, winningNumbers: DrawWinningNumber[]): Observable<Draw> {
    if (this.live) {
      return this.liveRecordNumbers(id, winningNumbers);
    }
    return this.patch(id, {
      winningNumbers,
      status: DrawStatus.PendingVerification,
      drawnAt: new Date().toISOString(),
    } as Partial<Draw>);
  }

  verify(id: string, verifier: string, remarks?: string): Observable<Draw> {
    if (this.live) {
      return this.command(id, "verify", { remarks });
    }
    const draw = this.records.find((item) => item.id === id);
    if (!draw) {
      return this.backend.notFound<Draw>('Draw', id);
    }
    return this.patch(id, {
      verification: {
        ...draw.verification,
        verifiedBy: verifier,
        verifiedAt: new Date().toISOString(),
        remarks,
      },
    } as Partial<Draw>);
  }

  /** Publishing makes results visible to customers and triggers payouts. */
  publish(id: string, approver: string): Observable<Draw> {
    if (this.live) {
      return this.command(id, "publish");
    }
    const draw = this.records.find((item) => item.id === id);
    if (!draw) {
      return this.backend.notFound<Draw>('Draw', id);
    }
    return this.patch(id, {
      status: DrawStatus.Published,
      publishedAt: new Date().toISOString(),
      verification: {
        ...draw.verification,
        approvedBy: approver,
        approvedAt: new Date().toISOString(),
      },
    } as Partial<Draw>);
  }

  rollback(id: string, reason: string): Observable<Draw> {
    if (this.live) {
      return this.command(id, "rollback", { reason });
    }
    return this.patch(id, {
      status: DrawStatus.RolledBack,
      rollbackReason: reason,
    } as Partial<Draw>);
  }

  cancel(id: string, reason: string): Observable<Draw> {
    if (this.live) {
      return this.command(id, "cancel", { reason });
    }
    return this.patch(id, {
      status: DrawStatus.Cancelled,
      cancelledReason: reason,
    } as Partial<Draw>);
  }

  statistics(): Observable<StatMetric[]> {
    if (this.live) {
      return this.liveStatistics();
    }
    return this.backend.respond(() => {
      const draws = this.records;
      const count = (status: DrawStatus): number => draws.filter((draw) => draw.status === status).length;
      const published = draws.filter((draw) => draw.status === DrawStatus.Published);

      return [
        {
          id: 'total',
          label: 'Total draws',
          value: draws.length,
          icon: 'stadia_controller',
          tone: 'primary',
        },
        {
          id: 'scheduled',
          label: 'Scheduled',
          value: count(DrawStatus.Scheduled),
          icon: 'event',
          tone: 'info',
        },
        {
          id: 'pending',
          label: 'Pending verification',
          value: count(DrawStatus.PendingVerification),
          icon: 'fact_check',
          tone: 'warning',
        },
        { id: 'published', label: 'Published', value: published.length, icon: 'campaign', tone: 'success' },
        {
          id: 'sales',
          label: 'Draw sales',
          value: sumBy(published, (draw) => draw.salesAmount),
          icon: 'payments',
          tone: 'primary',
        },
        {
          id: 'payout',
          label: 'Prize payouts',
          value: sumBy(published, (draw) => draw.payoutAmount),
          icon: 'emoji_events',
          tone: 'danger',
        },
      ];
    });
  }

  /** Lifecycle timeline for the draw detail page. */
  timeline(draw: Draw): Observable<TimelineEvent[]> {
    if (this.live) {
      return this.liveTimeline(draw);
    }
    return this.backend.respond(() => {
      const events: TimelineEvent[] = [
        {
          id: 'created',
          title: 'Draw scheduled',
          description: `${draw.lotteryName} draw #${draw.drawNumber} added to the calendar.`,
          actor: draw.createdBy ?? 'Scheduler',
          timestamp: draw.createdAt,
          icon: 'event',
          tone: 'info',
        },
        {
          id: 'sales-open',
          title: 'Sales opened',
          actor: 'System',
          timestamp: draw.salesOpenAt,
          icon: 'lock_open',
          tone: 'success',
        },
        {
          id: 'sales-close',
          title: 'Sales closed',
          description: `${draw.ticketsSold.toLocaleString()} tickets sold.`,
          actor: 'System',
          timestamp: draw.salesCloseAt,
          icon: 'lock',
          tone: 'warning',
        },
      ];

      if (draw.drawnAt) {
        events.push({
          id: 'drawn',
          title: 'Numbers drawn',
          description: `Executed in ${draw.mode.toLowerCase()} mode.`,
          actor: draw.verification.verifiedBy ?? 'Draw Engine',
          timestamp: draw.drawnAt,
          icon: 'casino',
          tone: 'primary',
          meta: { Checksum: draw.verification.checksum },
        });
      }
      if (draw.verification.verifiedAt) {
        events.push({
          id: 'verified',
          title: 'Result verified',
          description: `Witnessed by ${draw.verification.witnessNames.join(', ')}.`,
          actor: draw.verification.verifiedBy ?? 'Verifier',
          timestamp: draw.verification.verifiedAt,
          icon: 'fact_check',
          tone: 'success',
        });
      }
      if (draw.publishedAt) {
        events.push({
          id: 'published',
          title: 'Result published',
          description: `${draw.winnerCount.toLocaleString()} winning tickets identified.`,
          actor: draw.verification.approvedBy ?? 'Approver',
          timestamp: draw.publishedAt,
          icon: 'campaign',
          tone: 'success',
        });
      }
      if (draw.rollbackReason) {
        events.push({
          id: 'rolled-back',
          title: 'Draw rolled back',
          description: draw.rollbackReason,
          actor: 'Draw Control',
          timestamp: draw.updatedAt ?? draw.createdAt,
          icon: 'undo',
          tone: 'danger',
        });
      }
      if (draw.cancelledReason) {
        events.push({
          id: 'cancelled',
          title: 'Draw cancelled',
          description: draw.cancelledReason,
          actor: 'Draw Control',
          timestamp: draw.updatedAt ?? draw.createdAt,
          icon: 'cancel',
          tone: 'danger',
        });
      }

      return events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    });
  }
  // =====================================================================================
  // Live API implementation
  // =====================================================================================

  protected override fromApi(record: unknown): Draw {
    const api = record as Draw & { winningNumber?: string };
    return {
      ...api,
      // Before publication the API only has the drawn number (tiers are settled at publish): show it to
      // the people allowed to see it (holders of draws.verify) instead of an empty cell.
      winningNumbers: api.winningNumbers?.length
        ? api.winningNumbers
        : api.winningNumber
          ? [
              {
                tierCode: 'FIRST' as DrawWinningNumber['tierCode'],
                tierName: 'Drawn number',
                numbers: [api.winningNumber],
                winnerCount: 0,
                prizePerWinner: 0,
                totalPayout: 0,
              },
            ]
          : [],
      verification: {
        ...api.verification,
        witnessNames: api.verification?.witnessNames ?? [],
        checksum: api.verification?.checksum ?? '',
      },
    };
  }

  protected override toApi(payload: Partial<Draw>): unknown {
    return {
      lotteryId: payload.lotteryId,
      scheduledAt: payload.scheduledAt,
      salesOpenAt: payload.salesOpenAt,
      salesCloseAt: payload.salesCloseAt,
      mode: payload.mode,
      jackpotAmount: payload.jackpotAmount,
      streamUrl: payload.streamUrl,
    };
  }

  /** Every lifecycle step is an explicit, separately authorised command on the API. */
  private command(id: string, action: string, body: Record<string, unknown> = {}): Observable<Draw> {
    return this.http.post<unknown>(`${this.baseUrl}/${id}/${action}`, body).pipe(map((row) => this.fromApi(row)));
  }

  protected override livePatch(id: string, changes: Partial<Draw>): Observable<Draw> {
    switch (changes.status) {
      case DrawStatus.SalesOpen:
        return this.command(id, 'open-sales');
      case DrawStatus.SalesClosed:
        return this.command(id, 'close-sales');
      case DrawStatus.Drawing:
        return this.command(id, 'start');
      case DrawStatus.Cancelled:
        return this.command(id, 'cancel', { reason: changes.cancelledReason ?? 'Cancelled from the admin portal' });
      default:
        return super.livePatch(id, changes);
    }
  }

  /**
   * The API stores ONE drawn number and derives every prize tier from it, so the full-length number
   * entered for the top tier is what gets recorded.
   */
  private liveRecordNumbers(id: string, winningNumbers: DrawWinningNumber[]): Observable<Draw> {
    const candidates = winningNumbers.flatMap((tier) => tier.numbers).filter((value) => /^\d+$/.test(value));
    const winningNumber = candidates.sort((a, b) => b.length - a.length)[0];
    return this.command(id, 'result', winningNumber ? { winningNumber } : {});
  }

  private liveStatistics(): Observable<StatMetric[]> {
    const count = (status?: DrawStatus): Observable<number> =>
      this.liveCount(this.livePath, status ? { status } : {});
    return forkJoin({
      total: count(),
      scheduled: count(DrawStatus.Scheduled),
      pending: count(DrawStatus.PendingVerification),
      published: count(DrawStatus.Published),
      sums: this.http
        .get<Record<string, number>>(this.api('admin/stats/draws'), { headers: { 'X-Quiet': '1' } })
        .pipe(catchError(() => of({} as Record<string, number>))),
    }).pipe(
      map((totals) => [
        { id: 'total', label: 'Total draws', value: totals.total, icon: 'stadia_controller', tone: 'primary' as const },
        { id: 'scheduled', label: 'Scheduled', value: totals.scheduled, icon: 'event', tone: 'info' as const },
        {
          id: 'pending',
          label: 'Pending verification',
          value: totals.pending,
          icon: 'fact_check',
          tone: 'warning' as const,
        },
        { id: 'published', label: 'Published', value: totals.published, icon: 'campaign', tone: 'success' as const },
        {
          id: 'sales',
          label: 'Draw sales',
          value: num(totals.sums['publishedSales']),
          icon: 'payments',
          tone: 'primary' as const,
        },
        {
          id: 'payout',
          label: 'Prize payouts',
          value: num(totals.sums['publishedPayout']),
          icon: 'emoji_events',
          tone: 'danger' as const,
        },
      ]),
    );
  }

  private liveTimeline(draw: Draw): Observable<TimelineEvent[]> {
    const scheduled: TimelineEvent = {
      id: 'created',
      title: 'Draw scheduled',
      description: `${draw.lotteryName} draw #${draw.drawNumber} added to the calendar.`,
      actor: draw.createdBy ?? 'Scheduler',
      timestamp: draw.createdAt,
      icon: 'event',
      tone: 'info',
    };
    return this.http
      .get<ApiAuditEntry[]>(this.api('admin/audit/timeline'), {
        params: { entityType: 'Draw', entityId: draw.id, limit: '100' },
        headers: { 'X-Quiet': '1' },
      })
      .pipe(
        catchError(() => of([] as ApiAuditEntry[])),
        map((entries) => [...entries.map(auditToTimeline), scheduled]),
      );
  }
}
