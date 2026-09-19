import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  PolarAreaController,
  RadarController,
  RadialLinearScale,
  Tooltip,
  type ChartConfiguration,
  type ChartData,
  type ChartOptions,
  type ChartType,
} from 'chart.js';

import { ThemeService } from '@core/services/theme.service';
import { withAlpha } from '@core/utilities/colour.util';

// Tree-shakeable registration: only the controllers this portal actually uses.
Chart.register(
  BarController,
  LineController,
  PieController,
  DoughnutController,
  PolarAreaController,
  RadarController,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  Filler,
  Legend,
  Tooltip,
);

export type LlChartType =
  'bar' | 'horizontalBar' | 'line' | 'area' | 'pie' | 'doughnut' | 'radar' | 'polarArea';

export interface ChartSeries {
  label: string;
  data: number[];
  colour?: string;
  /** Draws this series as a line on top of a bar chart. */
  type?: 'bar' | 'line';
  fill?: boolean;
  stack?: string;
}

/**
 * Themed Chart.js wrapper.
 *
 * The chart is rebuilt whenever the palette changes, so switching preset or
 * toggling dark mode restyles every chart instantly. Colour-blind-safe mode and
 * the reduced-motion setting are honoured automatically, and no component ever
 * passes a literal colour.
 */
@Component({
  selector: 'll-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" [style.height.px]="height()">
      <canvas #canvas [attr.aria-label]="ariaLabel()" role="img"></canvas>
    </div>
    <p class="ll-visually-hidden">{{ summary() }}</p>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      width: 100%;
    }

    .chart {
      position: relative;
      width: 100%;
    }

    canvas {
      width: 100% !important;
    }
  `,
})
export class ChartComponent {
  private readonly theme = inject(ThemeService);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  readonly type = input<LlChartType>('bar');
  readonly labels = input<string[]>([]);
  readonly series = input<ChartSeries[]>([]);
  readonly height = input(280);
  readonly showLegend = input(true);
  readonly showGrid = input(true);
  readonly stacked = input(false);
  readonly beginAtZero = input(true);
  readonly ariaLabel = input('Chart');
  /** Formats axis ticks and tooltip values, e.g. currency. */
  readonly valueFormatter = input<(value: number) => string>((value) => value.toLocaleString());
  /** Renders a compact chart with no axes — used inside stat tiles. */
  readonly sparkline = input(false);

  private chart: Chart | null = null;

  /** Screen-reader description so charts are not opaque to assistive tech. */
  protected readonly summary = computed(() => {
    const series = this.series();
    if (series.length === 0) {
      return 'Chart has no data.';
    }
    return series
      .map((entry) => {
        const total = entry.data.reduce((sum, value) => sum + value, 0);
        return `${entry.label}: total ${this.valueFormatter()(total)} across ${entry.data.length} points`;
      })
      .join('. ');
  });

  constructor() {
    // Re-render on data change and on any palette/accessibility change.
    effect(() => {
      const configuration = this.buildConfiguration();
      this.render(configuration);
    });

    // Chart.js keeps global registry entries; release them with the component.
    inject(DestroyRef).onDestroy(() => {
      this.chart?.destroy();
      this.chart = null;
    });
  }

  private baseType(): ChartType {
    switch (this.type()) {
      case 'horizontalBar':
        return 'bar';
      case 'area':
        return 'line';
      case 'polarArea':
        return 'polarArea';
      default:
        return this.type() as ChartType;
    }
  }

  private buildConfiguration(): ChartConfiguration {
    const palette = this.theme.chartColours();
    const colours = this.theme.palette();
    const type = this.type();
    const isArea = type === 'area';
    const isCircular = type === 'pie' || type === 'doughnut' || type === 'polarArea';
    const animate = this.theme.animationsEnabled();

    const datasets = this.series().map((entry, index) => {
      const colour = entry.colour ?? palette[index % palette.length] ?? colours.primary;

      if (isCircular) {
        return {
          label: entry.label,
          data: entry.data,
          backgroundColor: entry.data.map((_, pointIndex) => palette[pointIndex % palette.length] ?? colour),
          borderColor: colours.surfaceElevated,
          borderWidth: 2,
          hoverOffset: 8,
        };
      }

      const useLine = entry.type === 'line' || type === 'line' || isArea;
      return {
        type: entry.type ?? (isArea ? 'line' : undefined),
        label: entry.label,
        data: entry.data,
        backgroundColor: useLine
          ? isArea || entry.fill
            ? this.areaGradient(colour)
            : withAlpha(colour, 0.16)
          : withAlpha(colour, 0.86),
        borderColor: colour,
        borderWidth: useLine ? 2.5 : 0,
        borderRadius: useLine ? 0 : 6,
        borderSkipped: false,
        fill: isArea || entry.fill === true,
        tension: 0.38,
        pointRadius: this.sparkline() ? 0 : 3,
        pointHoverRadius: 6,
        pointBackgroundColor: colours.surfaceElevated,
        pointBorderColor: colour,
        pointBorderWidth: 2,
        stack: entry.stack,
        maxBarThickness: 46,
      };
    });

    const formatter = this.valueFormatter();

    const options: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: type === 'horizontalBar' ? 'y' : 'x',
      animation: animate ? { duration: 620, easing: 'easeOutQuart' } : false,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: this.sparkline() ? 0 : 4 },
      plugins: {
        legend: {
          display: this.showLegend() && !this.sparkline(),
          position: isCircular ? 'right' : 'top',
          align: 'end',
          labels: {
            color: colours.textSecondary,
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            boxHeight: 8,
            padding: 16,
            font: { size: 11.5, weight: 600 },
          },
        },
        tooltip: {
          backgroundColor: colours.textPrimary,
          titleColor: colours.surfaceElevated,
          bodyColor: colours.surfaceElevated,
          borderColor: colours.border,
          borderWidth: 1,
          padding: 11,
          cornerRadius: 8,
          displayColors: true,
          usePointStyle: true,
          callbacks: {
            label: (context) => {
              const value = Number(context.parsed.y ?? context.parsed);
              return ` ${context.dataset.label ?? ''}: ${formatter(value)}`;
            },
          },
        },
      },
      scales: isCircular
        ? undefined
        : {
            x: {
              display: !this.sparkline(),
              stacked: this.stacked(),
              grid: { display: false },
              border: { color: colours.border },
              ticks: { color: colours.textMuted, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 12 },
            },
            y: {
              display: !this.sparkline(),
              stacked: this.stacked(),
              beginAtZero: this.beginAtZero(),
              grid: {
                display: this.showGrid(),
                color: withAlpha(colours.border, 0.75),
              },
              border: { display: false },
              ticks: {
                color: colours.textMuted,
                font: { size: 11 },
                padding: 8,
                callback: (value) => formatter(Number(value)),
              },
            },
          },
    };

    return {
      type: this.baseType(),
      data: { labels: this.labels(), datasets } as ChartData,
      options,
    };
  }

  /** Vertical gradient behind area charts; falls back to a flat tint. */
  private areaGradient(colour: string): CanvasGradient | string {
    const context = this.canvasRef().nativeElement.getContext('2d');
    if (!context) {
      return withAlpha(colour, 0.2);
    }
    const gradient = context.createLinearGradient(0, 0, 0, this.height());
    gradient.addColorStop(0, withAlpha(colour, 0.42));
    gradient.addColorStop(1, withAlpha(colour, 0.02));
    return gradient;
  }

  private render(configuration: ChartConfiguration): void {
    this.chart?.destroy();
    const canvas = this.canvasRef().nativeElement;
    this.chart = new Chart(canvas, configuration);
  }
}
