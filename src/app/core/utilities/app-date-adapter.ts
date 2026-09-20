import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

const LAO_MONTHS = {
  long: ['ມັງກອນ', 'ກຸມພາ', 'ມີນາ', 'ເມສາ', 'ພຶດສະພາ', 'ມິຖຸນາ', 'ກໍລະກົດ', 'ສິງຫາ', 'ກັນຍາ', 'ຕຸລາ', 'ພະຈິກ', 'ທັນວາ'],
  short: ['ມ.ກ.', 'ກ.ພ.', 'ມ.ນ.', 'ມ.ສ.', 'ພ.ພ.', 'ມິ.ຖ.', 'ກ.ລ.', 'ສ.ຫ.', 'ກ.ຍ.', 'ຕ.ລ.', 'ພ.ຈ.', 'ທ.ວ.'],
};
const LAO_DAYS = {
  long: ['ວັນອາທິດ', 'ວັນຈັນ', 'ວັນອັງຄານ', 'ວັນພຸດ', 'ວັນພະຫັດ', 'ວັນສຸກ', 'ວັນເສົາ'],
  short: ['ອາທິດ', 'ຈັນ', 'ອັງຄານ', 'ພຸດ', 'ພະຫັດ', 'ສຸກ', 'ເສົາ'],
  narrow: ['ອາ', 'ຈ', 'ອ', 'ພ', 'ພຫ', 'ສ', 'ສ'],
};

/**
 * Material date adapter with built-in Lao names.
 *
 * The native adapter leans on `Intl`, and Chromium ships no Lao locale data —
 * `lo-LA` silently falls back to English there. Every other locale is left to
 * the native behaviour.
 */
@Injectable()
export class AppDateAdapter extends NativeDateAdapter {
  private get lao(): boolean {
    return String(this.locale ?? '').toLowerCase().startsWith('lo');
  }

  override getMonthNames(style: 'long' | 'short' | 'narrow'): string[] {
    return this.lao ? LAO_MONTHS[style === 'long' ? 'long' : 'short'] : super.getMonthNames(style);
  }

  override getDayOfWeekNames(style: 'long' | 'short' | 'narrow'): string[] {
    return this.lao ? LAO_DAYS[style] : super.getDayOfWeekNames(style);
  }

  override getFirstDayOfWeek(): number {
    return this.lao ? 1 : super.getFirstDayOfWeek();
  }

  override format(date: Date, displayFormat: Intl.DateTimeFormatOptions): string {
    if (!this.lao || !this.isValid(date)) {
      return super.format(date, displayFormat);
    }
    const year = date.getFullYear();
    if (displayFormat.month === 'long' || displayFormat.month === 'short') {
      const month = LAO_MONTHS[displayFormat.month][date.getMonth()];
      return displayFormat.day ? `${date.getDate()} ${month} ${year}` : `${month} ${year}`;
    }
    return `${date.getDate()}/${date.getMonth() + 1}/${year}`;
  }

  override parse(value: unknown, parseFormat?: unknown): Date | null {
    // Accept the d/M/yyyy text this adapter produces; the native parser reads it as M/d.
    const match = this.lao && typeof value === 'string' ? /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim()) : null;
    return match
      ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
      : super.parse(value, parseFormat);
  }
}
