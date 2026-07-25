/**
 * Presentation formatting helpers.
 *
 * All of these accept an explicit locale/currency so the regional settings from
 * the white-label configuration flow through without any global state.
 */

const COMPACT_THRESHOLD = 10_000;

export function formatNumber(value: number | null | undefined, locale = 'en-GB', decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** `12 400 000` → `12.4M`. Used on stat tiles where space is tight. */
export function formatCompact(value: number | null | undefined, locale = 'en-GB'): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  if (Math.abs(value) < COMPACT_THRESHOLD) {
    return formatNumber(value, locale);
  }
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function formatCurrency(
  value: number | null | undefined,
  currency = 'LAK',
  locale = 'en-GB',
  options: { compact?: boolean; symbol?: string; position?: 'prefix' | 'suffix' } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  const amount = options.compact ? formatCompact(value, locale) : formatNumber(value, locale);
  const symbol = options.symbol ?? currencySymbol(currency);
  return options.position === 'prefix' ? `${symbol}${amount}` : `${amount} ${symbol}`;
}

export function currencySymbol(currency: string): string {
  switch (currency) {
    case 'LAK':
      return '₭';
    case 'USD':
      return '$';
    case 'THB':
      return '฿';
    default:
      return currency;
  }
}

export function formatPercent(value: number | null | undefined, decimals = 1, locale = 'en-GB'): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `${formatNumber(value, locale, decimals)}%`;
}

export function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(
  value: string | number | Date | null | undefined,
  locale = 'en-GB',
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(locale, options).format(date) : '—';
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
  locale = 'en-GB',
  use24h = true,
): string {
  return formatDate(value, locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: !use24h,
  });
}

export function formatTime(
  value: string | number | Date | null | undefined,
  locale = 'en-GB',
  use24h = true,
): string {
  return formatDate(value, locale, { hour: '2-digit', minute: '2-digit', hour12: !use24h });
}

/** `3 minutes ago`, `in 2 days` — driven by Intl.RelativeTimeFormat. */
export function formatRelative(
  value: string | number | Date | null | undefined,
  locale = 'en-GB',
  now: Date = new Date(),
): string {
  const date = toDate(value);
  if (!date) {
    return '—';
  }
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const divisions: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
  ];

  let duration = diffSeconds;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return formatter.format(Math.round(duration), 'year');
}

/** Countdown parts for the upcoming-draw widget. */
export function countdownParts(
  target: string | number | Date | null | undefined,
  now: Date = new Date(),
): { days: number; hours: number; minutes: number; seconds: number; expired: boolean } {
  const date = toDate(target);
  const remaining = date ? date.getTime() - now.getTime() : 0;
  if (!date || remaining <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: false,
  };
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) {
    return '—';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/** `1234567890123456` → `**** **** **** 3456`. */
export function maskAccount(value: string | null | undefined, visible = 4): string {
  if (!value) {
    return '—';
  }
  const trimmed = value.replace(/\s+/g, '');
  if (trimmed.length <= visible) {
    return trimmed;
  }
  const masked = '•'.repeat(Math.max(0, trimmed.length - visible));
  return `${masked}${trimmed.slice(-visible)}`.replace(/(.{4})/g, '$1 ').trim();
}

export function maskPhone(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return value.replace(/(\d{3})\d{3,4}(\d{3})/, '$1•••$2');
}

export function maskEmail(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const [name, domain] = value.split('@');
  if (!name || !domain) {
    return value;
  }
  const head = name.slice(0, Math.min(2, name.length));
  return `${head}${'•'.repeat(Math.max(1, name.length - 2))}@${domain}`;
}

/** Converts an enum-ish token (`PENDING_APPROVAL`) into `Pending Approval`. */
export function humanise(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return value
    .toString()
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function initials(name: string | null | undefined): string {
  if (!name) {
    return '?';
  }
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '?';
}

export function truncate(value: string | null | undefined, max = 60): string {
  if (!value) {
    return '';
  }
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
