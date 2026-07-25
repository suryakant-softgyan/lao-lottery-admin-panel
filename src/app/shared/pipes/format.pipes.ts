import { Pipe, inject, type PipeTransform } from '@angular/core';
import { DomSanitizer, type SafeHtml, type SafeResourceUrl } from '@angular/platform-browser';

import { ThemeService } from '@core/services/theme.service';
import {
  formatCompact,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatFileSize,
  formatNumber,
  formatPercent,
  formatRelative,
  formatTime,
  humanise,
  initials,
  maskAccount,
  maskEmail,
  maskPhone,
  truncate,
} from '@core/utilities/format.util';

/**
 * Presentation pipes.
 *
 * Each one reads the active regional settings from {@link ThemeService}, so a
 * white-label deployment that switches locale, currency or time format updates
 * every rendered value without touching a single template.
 */

/** `12500000 | llCurrency` → `12,500,000 ₭`. */
@Pipe({ name: 'llCurrency' })
export class CurrencyPipe implements PipeTransform {
  private readonly theme = inject(ThemeService);

  transform(value: number | null | undefined, compact = false, currency?: string): string {
    const regional = this.theme.regional();
    return formatCurrency(value, currency ?? regional.currency, regional.locale, {
      compact,
      symbol: regional.currencySymbol,
      position: regional.currencyPosition,
    });
  }
}

/** `1240000 | llNumber:1` → `1,240,000.0`. */
@Pipe({ name: 'llNumber' })
export class NumberPipe implements PipeTransform {
  private readonly theme = inject(ThemeService);

  transform(value: number | null | undefined, decimals = 0, compact = false): string {
    const locale = this.theme.regional().locale;
    return compact ? formatCompact(value, locale) : formatNumber(value, locale, decimals);
  }
}

@Pipe({ name: 'llPercent' })
export class PercentPipe implements PipeTransform {
  private readonly theme = inject(ThemeService);

  transform(value: number | null | undefined, decimals = 1): string {
    return formatPercent(value, decimals, this.theme.regional().locale);
  }
}

@Pipe({ name: 'llDate' })
export class DatePipe implements PipeTransform {
  private readonly theme = inject(ThemeService);

  transform(
    value: string | number | Date | null | undefined,
    mode: 'date' | 'datetime' | 'time' = 'date',
  ): string {
    const regional = this.theme.regional();
    const use24h = regional.timeFormat === '24h';
    switch (mode) {
      case 'datetime':
        return formatDateTime(value, regional.locale, use24h);
      case 'time':
        return formatTime(value, regional.locale, use24h);
      default:
        return formatDate(value, regional.locale);
    }
  }
}

/** `'2026-07-24' | llRelative` → `yesterday`. */
@Pipe({ name: 'llRelative' })
export class RelativePipe implements PipeTransform {
  private readonly theme = inject(ThemeService);

  transform(value: string | number | Date | null | undefined): string {
    return formatRelative(value, this.theme.regional().locale);
  }
}

/** `'PENDING_APPROVAL' | llHumanise` → `Pending Approval`. */
@Pipe({ name: 'llHumanise' })
export class HumanisePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return humanise(value);
  }
}

@Pipe({ name: 'llInitials' })
export class InitialsPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return initials(value);
  }
}

@Pipe({ name: 'llTruncate' })
export class TruncatePipe implements PipeTransform {
  transform(value: string | null | undefined, max = 60): string {
    return truncate(value, max);
  }
}

@Pipe({ name: 'llFileSize' })
export class FileSizePipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatFileSize(value);
  }
}

/** Masks sensitive values: `llMask:'account'`, `'phone'` or `'email'`. */
@Pipe({ name: 'llMask' })
export class MaskPipe implements PipeTransform {
  transform(value: string | null | undefined, mode: 'account' | 'phone' | 'email' = 'account'): string {
    switch (mode) {
      case 'phone':
        return maskPhone(value);
      case 'email':
        return maskEmail(value);
      default:
        return maskAccount(value);
    }
  }
}

/** Trusts server-supplied markup (template previews, rich notification bodies). */
@Pipe({ name: 'llSafeHtml' })
export class SafeHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(value ?? '');
  }
}

@Pipe({ name: 'llSafeUrl' })
export class SafeUrlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(value ?? '');
  }
}

/** Every pipe in one array for convenient standalone imports. */
export const FORMAT_PIPES = [
  CurrencyPipe,
  NumberPipe,
  PercentPipe,
  DatePipe,
  RelativePipe,
  HumanisePipe,
  InitialsPipe,
  TruncatePipe,
  FileSizePipe,
  MaskPipe,
  SafeHtmlPipe,
  SafeUrlPipe,
] as const;
