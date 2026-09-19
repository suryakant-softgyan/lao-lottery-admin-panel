import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';

import { ExportFormat, ReportPeriod } from '@core/enums';
import { mockDataset } from '@core/mock/dataset';
import type { ReportRequest, ReportResult } from '@core/models';
import type { TableColumn } from '@core/models/table.model';
import { BreadcrumbService } from '@core/services/breadcrumb.service';
import { ExportService } from '@core/services/export.service';
import { LayoutService } from '@core/services/layout.service';
import { ThemeService } from '@core/services/theme.service';
import { ToastService } from '@core/services/toast.service';
import { formatCurrency, humanise } from '@core/utilities/format.util';
import { ChartComponent, type LlChartType } from '@shared/components/chart/chart';
import { PageHeader } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatePanel } from '@shared/components/state-panel/state-panel';
import { ReportService } from '../data/report.service';

type ReportRow = Record<string, string | number>;

/**
 * Universal report view.
 *
 * Renders any {@link ReportResult}: a filter bar, a chart with a switchable
 * type, a totals strip and the underlying table — all exportable to Excel, CSV,
 * PDF or the printer.
 */
@Component({
  selector: 'll-report-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatMenuModule, PageHeader, ChartComponent, Skeleton, StatePanel],
  templateUrl: './report-view.html',
  styleUrl: './report-view.scss',
})
export class ReportView {
  private readonly reports = inject(ReportService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly exportService = inject(ExportService);
  private readonly layout = inject(LayoutService);
  private readonly theme = inject(ThemeService);
  private readonly toast = inject(ToastService);
  private readonly breadcrumb = inject(BreadcrumbService);

  protected readonly ExportFormat = ExportFormat;

  protected readonly reportType = this.route.snapshot.paramMap.get('type') ?? 'sales';
  protected readonly definition = this.reports.definition(this.reportType);

  protected readonly result = signal<ReportResult | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly period = signal<ReportPeriod>(ReportPeriod.Monthly);
  protected readonly groupBy = signal<string>(this.definition?.defaultGroupBy ?? 'day');
  protected readonly province = signal<string>('');
  protected readonly lotteryId = signal<string>('');
  protected readonly chartType = signal<LlChartType>('bar');

  protected readonly periods = [
    { value: ReportPeriod.Today, label: 'Today' },
    { value: ReportPeriod.Weekly, label: 'Last 7 days' },
    { value: ReportPeriod.Monthly, label: 'Last 30 days' },
    { value: ReportPeriod.Quarterly, label: 'Last 90 days' },
    { value: ReportPeriod.Yearly, label: 'Last 12 months' },
    { value: ReportPeriod.Custom, label: 'All time' },
  ];

  protected readonly groupings = [
    { value: 'day', label: 'Day' },
    { value: 'month', label: 'Month' },
    { value: 'province', label: 'Province' },
    { value: 'product', label: 'Product' },
    { value: 'channel', label: 'Channel' },
  ];

  protected readonly chartTypes: { value: LlChartType; label: string; icon: string }[] = [
    { value: 'bar', label: 'Bar', icon: 'bar_chart' },
    { value: 'line', label: 'Line', icon: 'show_chart' },
    { value: 'area', label: 'Area', icon: 'area_chart' },
    { value: 'horizontalBar', label: 'Horizontal bar', icon: 'align_horizontal_left' },
    { value: 'doughnut', label: 'Doughnut', icon: 'donut_large' },
    { value: 'pie', label: 'Pie', icon: 'pie_chart' },
  ];

  protected readonly provinces = [
    { value: '', label: 'All provinces' },
    ...[...new Set(mockDataset.retailers.map((retailer) => retailer.province))]
      .sort()
      .map((province) => ({ value: province, label: province })),
  ];

  protected readonly lotteries = [
    { value: '', label: 'All products' },
    ...mockDataset.lotteries.map((game) => ({ value: game.id, label: game.name })),
  ];

  /** Totals rendered as a strip above the table. */
  protected readonly totalEntries = computed(() =>
    Object.entries(this.result()?.totals ?? {}).map(([key, value]) => ({
      key,
      label: humanise(key),
      value,
      currency: this.isCurrencyColumn(key),
    })),
  );

  protected readonly currencyFormatter = (value: number): string =>
    formatCurrency(value, this.theme.regional().currency, this.theme.regional().locale, { compact: true });

  constructor() {
    if (this.definition) {
      this.breadcrumb.setDynamicLabel(this.definition.title);
    }
    this.run();
  }

  protected run(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const request: ReportRequest = {
      reportType: this.reportType,
      period: this.period(),
      groupBy: this.groupBy(),
      province: this.province() || undefined,
      lotteryId: this.lotteryId() || undefined,
    };

    this.reports.run(request).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('The report could not be generated. Please try again.');
      },
    });
  }

  protected isCurrencyColumn(key: string): boolean {
    return this.result()?.columns.find((column) => column.key === key)?.type === 'currency';
  }

  protected formatCell(row: ReportRow, key: string): string {
    const column = this.result()?.columns.find((item) => item.key === key);
    const value = row[key];
    const regional = this.theme.regional();

    switch (column?.type) {
      case 'currency':
        return formatCurrency(Number(value), regional.currency, regional.locale);
      case 'percent':
        return `${Number(value).toFixed(1)}%`;
      case 'number':
        return Number(value).toLocaleString(regional.locale);
      default:
        return humanise(String(value ?? ''));
    }
  }

  protected formatTotal(value: number, currency: boolean): string {
    const regional = this.theme.regional();
    return currency
      ? formatCurrency(value, regional.currency, regional.locale, { compact: true })
      : value.toLocaleString(regional.locale);
  }

  protected alignment(key: string): string {
    const type = this.result()?.columns.find((column) => column.key === key)?.type;
    return type === 'currency' || type === 'number' || type === 'percent' ? 'end' : 'start';
  }

  /** Maps the report's own column metadata onto the export contract. */
  private exportColumns(): TableColumn<ReportRow>[] {
    return (this.result()?.columns ?? []).map((column) => ({
      key: column.key,
      label: column.label,
      type: column.type === 'text' ? 'text' : column.type,
      format: (value) => this.formatCell({ [column.key]: value as string | number }, column.key),
    }));
  }

  protected export(format: ExportFormat): void {
    const result = this.result();
    if (!result) {
      return;
    }

    if (format === ExportFormat.Print) {
      this.layout.print();
      return;
    }

    this.exportService.export<ReportRow>({
      format,
      fileName: `${result.reportType}-report`,
      title: result.title,
      subtitle: `${result.period} · generated ${new Date(result.generatedAt).toLocaleString()}`,
      columns: this.exportColumns(),
      rows: result.rows,
      includeTotals: true,
    });
  }

  protected onHeaderAction(action: string): void {
    switch (action) {
      case 'back':
        void this.router.navigate(['/reports']);
        break;
      case 'refresh':
        this.run();
        break;
      case 'print':
        this.layout.print();
        break;
      default:
        break;
    }
  }

  protected notFound(): void {
    this.toast.error('Unknown report', 'That report does not exist.');
    void this.router.navigate(['/reports']);
  }
}
