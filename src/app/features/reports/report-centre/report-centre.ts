import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { PermissionService } from '@core/authentication/permission.service';
import { ThemeService } from '@core/services/theme.service';
import { formatCompact, formatCurrency } from '@core/utilities/format.util';
import { PageHeader } from '@shared/components/page-header/page-header';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { ReportService, type ReportDefinition } from '../data/report.service';

/** Landing page listing every available report with its headline figure. */
@Component({
  selector: 'll-report-centre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, PageHeader, Skeleton],
  templateUrl: './report-centre.html',
  styleUrl: './report-centre.scss',
})
export class ReportCentre {
  private readonly reports = inject(ReportService);
  private readonly permissions = inject(PermissionService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly headlines = signal<Record<string, number>>({});

  /** Only reports the operator is allowed to run. */
  protected readonly definitions = computed(() =>
    this.reports.definitions.filter((report) => this.permissions.has(report.permission)),
  );

  constructor() {
    this.reports.headlines().subscribe((values) => {
      this.headlines.set(values);
      this.loading.set(false);
    });
  }

  /** Currency reports get a money headline; count reports get a plain number. */
  protected headline(report: ReportDefinition): string {
    const value = this.headlines()[report.key] ?? 0;
    const regional = this.theme.regional();

    if (report.key === 'winners' || report.key === 'channel') {
      return formatCompact(value, regional.locale);
    }
    return formatCurrency(value, regional.currency, regional.locale, {
      compact: true,
      symbol: regional.currencySymbol,
      position: regional.currencyPosition,
    });
  }

  protected headlineLabel(report: ReportDefinition): string {
    switch (report.key) {
      case 'winners':
        return 'Winning tickets';
      case 'channel':
        return 'Tickets sold';
      case 'tax':
        return 'Tax withheld';
      case 'commission':
        return 'Commission accrued';
      case 'revenue':
        return 'Gross revenue';
      default:
        return 'Total sales';
    }
  }

  protected open(report: ReportDefinition): void {
    void this.router.navigate(['/reports', report.key]);
  }
}
