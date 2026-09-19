import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';

import { num } from '@core/api/live.util';

import { LotteryStatus } from '@core/enums';
import { mockDataset } from '@core/mock/dataset';
import type { LotteryConfiguration, LotteryGame, Page, PageQuery, PrizeTier, StatMetric } from '@core/models';
import { BaseRepository } from '@core/services/base-repository';
import { sumBy } from '@core/utilities/object.util';

/** Lottery product catalogue: games, sales configuration and prize structure. */
@Injectable({ providedIn: 'root' })
export class LotteryRepository extends BaseRepository<LotteryGame> {
  protected readonly resourcePath = 'lottery';

  protected override queryOptions = {
    searchFields: ['name', 'nameLo', 'code', 'type', 'description'],
    dateField: 'createdAt',
  };

  protected seed(): LotteryGame[] {
    return mockDataset.lotteries;
  }

  /** Updates the sales window, limits and rates for one product. */
  saveConfiguration(id: string, configuration: LotteryConfiguration): Observable<LotteryGame> {
    return this.patch(id, { configuration } as Partial<LotteryGame>);
  }

  savePrizeTiers(id: string, prizeTiers: PrizeTier[]): Observable<LotteryGame> {
    return this.patch(id, { prizeTiers } as Partial<LotteryGame>);
  }

  setStatus(id: string, status: LotteryStatus): Observable<LotteryGame> {
    return this.patch(id, { status } as Partial<LotteryGame>);
  }

  statistics(): Observable<StatMetric[]> {
    if (this.live) {
      return this.liveStatistics();
    }
    return this.backend.respond(() => {
      const games = this.records;
      return [
        { id: 'products', label: 'Products', value: games.length, icon: 'casino', tone: 'primary' },
        {
          id: 'active',
          label: 'Active',
          value: games.filter((game) => game.status === LotteryStatus.Active).length,
          icon: 'play_circle',
          tone: 'success',
        },
        {
          id: 'paused',
          label: 'Paused',
          value: games.filter((game) => game.status === LotteryStatus.Paused).length,
          icon: 'pause_circle',
          tone: 'warning',
        },
        {
          id: 'tickets',
          label: 'Tickets today',
          value: sumBy(games, (game) => game.ticketsSoldToday),
          icon: 'confirmation_number',
          tone: 'info',
        },
        {
          id: 'sales',
          label: 'Sales today',
          value: sumBy(games, (game) => game.salesToday),
          icon: 'payments',
          tone: 'primary',
        },
        {
          id: 'month',
          label: 'Sales this month',
          value: sumBy(games, (game) => game.salesMonth),
          icon: 'calendar_month',
          tone: 'success',
        },
      ];
    });
  }
  // =====================================================================================
  // Live API implementation
  // =====================================================================================

  protected override get livePath(): string {
    return 'admin/lotteries';
  }

  private liveStats: Record<string, Record<string, number>> = {};

  protected override fromApi(record: unknown): LotteryGame {
    const api = record as LotteryGame;
    const stats = this.liveStats[api.id] ?? {};
    return {
      ...api,
      nameLo: api.nameLo ?? '',
      description: api.description ?? '',
      drawDays: api.drawDays ?? [],
      bannerUrl: api.bannerUrl ?? '',
      iconUrl: api.iconUrl ?? '',
      colour: api.colour ?? '#1565C0',
      prizeTiers: (api.prizeTiers ?? []).map((tier) => ({ ...tier, matchCriteria: tier.matchCriteria ?? '' })),
      totalDraws: num(stats['totalDraws']),
      activeDraws: num(stats['activeDraws']),
      ticketsSoldToday: num(stats['ticketsSoldToday']),
      salesToday: num(stats['salesToday']),
      salesMonth: num(stats['salesMonth']),
      popularityScore: Math.min(100, Math.round(num(stats['ticketsSoldToday']) / 10)),
    };
  }

  /** Sales / draw counters come from a separate aggregate endpoint; load them before mapping rows. */
  private withStats<R>(source: () => Observable<R>): Observable<R> {
    return this.http
      .get<Record<string, number | string>[]>(this.api('admin/stats/lotteries'), { headers: { 'X-Quiet': '1' } })
      .pipe(
        catchError(() => of([] as Record<string, number | string>[])),
        tap((rows) => {
          this.liveStats = {};
          rows.forEach((row) => (this.liveStats[String(row['lotteryId'])] = row as Record<string, number>));
        }),
        switchMap(() => source()),
      );
  }

  override list(query: PageQuery): Observable<Page<LotteryGame>> {
    return this.live ? this.withStats(() => super.list(query)) : super.list(query);
  }

  override all(): Observable<LotteryGame[]> {
    return this.live ? this.withStats(() => super.all()) : super.all();
  }

  protected override toApi(payload: Partial<LotteryGame>): unknown {
    const current = this.records.find((game) => game.id === payload.id || game.code === payload.code);
    const merged = { ...current, ...payload } as LotteryGame & { configuration: Record<string, unknown> };
    return {
      code: merged.code,
      name: merged.name,
      nameLo: merged.nameLo,
      type: merged.type,
      status: merged.status,
      description: merged.description,
      frequency: merged.frequency,
      drawDays: merged.drawDays,
      digitCount: merged.digitCount,
      bannerUrl: merged.bannerUrl,
      iconUrl: merged.iconUrl,
      colour: merged.colour,
      configuration: {
        drawTime: '20:30:00',
        ...(current?.configuration as unknown as Record<string, unknown>),
        ...merged.configuration,
      },
      prizeTiers: (merged.prizeTiers ?? []).map((tier, index) => {
        const extra = tier as PrizeTier & { matchType?: string; matchDigits?: number };
        return {
          ...tier,
          id: undefined,
          matchType: extra.matchType ?? 'EXACT',
          matchDigits: extra.matchDigits ?? 0,
          order: tier.order || index + 1,
        };
      }),
    };
  }

  protected override livePatch(id: string, changes: Partial<LotteryGame>): Observable<LotteryGame> {
    const keys = Object.keys(changes);
    if (keys.length === 1 && changes.status) {
      return this.http
        .patch<unknown>(`${this.baseUrl}/${id}/status`, { status: changes.status })
        .pipe(map((row) => this.fromApi(row)));
    }
    // configuration / prize tiers: the API replaces the whole product definition
    return this.getById(id).pipe(switchMap((game) => this.update(id, { ...game, ...changes })));
  }

  private liveStatistics(): Observable<StatMetric[]> {
    return this.all().pipe(
      map((games) => [
        { id: 'products', label: 'Products', value: games.length, icon: 'casino', tone: 'primary' as const },
        {
          id: 'active',
          label: 'Active',
          value: games.filter((game) => game.status === LotteryStatus.Active).length,
          icon: 'play_circle',
          tone: 'success' as const,
        },
        {
          id: 'paused',
          label: 'Paused',
          value: games.filter((game) => game.status === LotteryStatus.Paused).length,
          icon: 'pause_circle',
          tone: 'warning' as const,
        },
        {
          id: 'tickets',
          label: 'Tickets today',
          value: sumBy(games, (game) => game.ticketsSoldToday),
          icon: 'confirmation_number',
          tone: 'info' as const,
        },
        {
          id: 'sales',
          label: 'Sales today',
          value: sumBy(games, (game) => game.salesToday),
          icon: 'payments',
          tone: 'primary' as const,
        },
        {
          id: 'month',
          label: 'Sales this month',
          value: sumBy(games, (game) => game.salesMonth),
          icon: 'calendar_month',
          tone: 'success' as const,
        },
      ]),
    );
  }
}
