import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { LotteryStatus } from '@core/enums';
import { mockDataset } from '@core/mock/dataset';
import type { LotteryConfiguration, LotteryGame, PrizeTier, StatMetric } from '@core/models';
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
}
