import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ThemeService } from '@core/services/theme.service';
import { formatCurrency } from '@core/utilities/format.util';
import { ChartComponent } from '@shared/components/chart/chart';
import { PageHeader } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { CurrencyPipe, PercentPipe } from '@shared/pipes/format.pipes';
import { RetailerRepository, type ProvinceCoverage } from '../data/retailer.repository';

/**
 * Retail coverage by province.
 *
 * A choropleth needs vector boundaries that a mock cannot supply, so coverage
 * is presented as a density grid plus comparative charts — the same insight
 * (where the network is thin) without a fake map. The `map__canvas` block is
 * the drop-in point for a real tile layer later.
 */
@Component({
  selector: 'll-coverage-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    MatTooltipModule,
    PageHeader,
    ChartComponent,
    Skeleton,
    StatePanel,
    CurrencyPipe,
    PercentPipe,
  ],
  templateUrl: './coverage-map.html',
  styleUrl: './coverage-map.scss',
})
export class CoverageMap {
  private readonly repository = inject(RetailerRepository);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);

  protected readonly coverage = signal<ProvinceCoverage[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly totals = computed(() => {
    const rows = this.coverage();
    return {
      provinces: rows.length,
      retailers: rows.reduce((sum, row) => sum + row.retailers, 0),
      devices: rows.reduce((sum, row) => sum + row.devices, 0),
      sales: rows.reduce((sum, row) => sum + row.salesToday, 0),
    };
  });

  /** Highest retailer count, used to normalise the density shading. */
  private readonly peak = computed(() => Math.max(1, ...this.coverage().map((row) => row.retailers)));

  protected readonly chartLabels = computed(() => this.coverage().map((row) => row.province));

  protected readonly chartSeries = computed(() => [
    { label: 'Retail outlets', data: this.coverage().map((row) => row.retailers) },
    { label: 'POS terminals', data: this.coverage().map((row) => row.devices) },
  ]);

  protected readonly salesSeries = computed(() => [
    { label: 'Sales today', data: this.coverage().map((row) => row.salesToday) },
  ]);

  protected readonly currencyFormatter = (value: number): string =>
    formatCurrency(value, this.theme.regional().currency, this.theme.regional().locale, { compact: true });

  protected readonly countFormatter = (value: number): string => value.toLocaleString();

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.repository.coverage().subscribe({
      next: (rows) => {
        this.coverage.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Coverage data could not be loaded.');
      },
    });
  }

  /** 0–1 density used for the tile background opacity. */
  protected density(row: ProvinceCoverage): number {
    return Math.max(0.12, row.retailers / this.peak());
  }

  protected openProvince(row: ProvinceCoverage): void {
    void this.router.navigate(['/retailers'], { queryParams: { province: row.province } });
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/retailers']);
    }
  }
}
