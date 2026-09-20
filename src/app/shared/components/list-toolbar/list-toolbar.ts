import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { DEBOUNCE_MS } from '@core/constants/app.constants';
import { ExportFormat } from '@core/enums';
import type { DateRange, SelectOption } from '@core/models/common.model';
import { LayoutService } from '@core/services/layout.service';
import { AppDateAdapter } from '@core/utilities/app-date-adapter';
import { TranslationService } from '@core/services/translation.service';

export interface QuickFilter {
  /** Field the value is applied to in the page query's `quick` bag. */
  key: string;
  label: string;
  options: SelectOption[];
  value?: string;
  icon?: string;
}

/**
 * Toolbar shared by every list page.
 *
 * Owns quick search (debounced), quick filter chips, a date range, and the
 * export / print / refresh / fullscreen / advanced-filter controls. Pages
 * project their bespoke filters into the `advanced` slot, which keeps the
 * common 90% out of every feature module.
 */
@Component({
  selector: 'll-list-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDividerModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  providers: [provideNativeDateAdapter(), { provide: DateAdapter, useClass: AppDateAdapter }],
  template: `
    <div class="toolbar ll-card">
      <div class="toolbar__main">
        <!-- Quick search -->
        <div class="toolbar__search">
          <span class="material-symbols-rounded toolbar__search-icon" aria-hidden="true">search</span>
          <input
            type="search"
            class="toolbar__search-input"
            [placeholder]="searchPlaceholder()"
            [attr.aria-label]="searchPlaceholder()"
            [ngModel]="searchTerm()"
            (ngModelChange)="onSearchInput($event)" />
          @if (searchTerm()) {
            <button
              type="button"
              class="toolbar__search-clear"
              aria-label="Clear search"
              (click)="onSearchInput('')">
              <span class="material-symbols-rounded" aria-hidden="true">close</span>
            </button>
          }
        </div>

        <!-- Quick filters -->
        @for (filter of quickFilters(); track filter.key) {
          <button
            mat-stroked-button
            type="button"
            class="toolbar__chip"
            [class.toolbar__chip--active]="activeQuick()[filter.key]"
            [matMenuTriggerFor]="quickMenu">
            @if (filter.icon) {
              <span class="material-symbols-rounded" aria-hidden="true">{{ filter.icon }}</span>
            }
            {{ quickLabel(filter) }}
            <span class="material-symbols-rounded" aria-hidden="true">expand_more</span>
          </button>
          <mat-menu #quickMenu="matMenu">
            <button mat-menu-item type="button" (click)="setQuick(filter.key, '')">
              <span matMenuItemIcon class="material-symbols-rounded" aria-hidden="true">
                {{ !activeQuick()[filter.key] ? 'radio_button_checked' : 'radio_button_unchecked' }}
              </span>
              <span>All {{ filter.label.toLowerCase() }}</span>
            </button>
            <mat-divider />
            @for (option of filter.options; track option.value) {
              <button mat-menu-item type="button" (click)="setQuick(filter.key, String(option.value))">
                <span matMenuItemIcon class="material-symbols-rounded" aria-hidden="true">
                  {{
                    activeQuick()[filter.key] === option.value
                      ? 'radio_button_checked'
                      : 'radio_button_unchecked'
                  }}
                </span>
                <span>{{ option.label }}</span>
              </button>
            }
          </mat-menu>
        }

        <!-- Date range -->
        @if (showDateRange()) {
          <div class="toolbar__dates">
            <!--
              A Material range picker rather than native date inputs: those follow the
              browser's language, this one follows the portal's.
            -->
            <button
              type="button"
              class="toolbar__date-toggle"
              aria-label="Open calendar"
              (click)="rangePicker.open()">
              <span class="material-symbols-rounded" aria-hidden="true">date_range</span>
            </button>
            <mat-date-range-input class="toolbar__range" [rangePicker]="rangePicker">
              <input
                matStartDate
                readonly
                placeholder="From date"
                aria-label="From date"
                [value]="fromDate()"
                (click)="rangePicker.open()"
                (dateChange)="onRangeChange('from', $event.value)" />
              <input
                matEndDate
                readonly
                placeholder="To date"
                aria-label="To date"
                [value]="toDate()"
                (click)="rangePicker.open()"
                (dateChange)="onRangeChange('to', $event.value)" />
            </mat-date-range-input>
            @if (hasDateRange()) {
              <button
                type="button"
                class="toolbar__date-toggle"
                aria-label="Clear dates"
                (click)="clearRange()">
                <span class="material-symbols-rounded" aria-hidden="true">close</span>
              </button>
            }
            <mat-date-range-picker #rangePicker />
          </div>
        }

        <span class="ll-spacer"></span>

        <!-- Controls -->
        <div class="toolbar__controls">
          @if (hasAdvanced()) {
            <button
              mat-stroked-button
              type="button"
              class="toolbar__chip"
              [class.toolbar__chip--active]="advancedOpen()"
              (click)="toggleAdvanced()">
              <span class="material-symbols-rounded" aria-hidden="true">tune</span>
              Filters
              @if (activeFilterCount() > 0) {
                <span class="toolbar__badge">{{ activeFilterCount() }}</span>
              }
            </button>
          }

          @if (activeFilterCount() > 0 || searchTerm() || hasDateRange()) {
            <button mat-button type="button" class="toolbar__reset" (click)="clearAll()">
              <span class="material-symbols-rounded" aria-hidden="true">filter_alt_off</span>
              Clear
            </button>
          }

          <span class="ll-divider--vertical" aria-hidden="true"></span>

          <button
            mat-icon-button
            type="button"
            matTooltip="Refresh"
            aria-label="Refresh data"
            (click)="refresh.emit()">
            <span class="material-symbols-rounded" [class.ll-spin]="refreshing()" aria-hidden="true">
              refresh
            </span>
          </button>

          @if (showExport()) {
            <button
              mat-icon-button
              type="button"
              matTooltip="Export"
              aria-label="Export data"
              [matMenuTriggerFor]="exportMenu">
              <span class="material-symbols-rounded" aria-hidden="true">download</span>
            </button>
            <mat-menu #exportMenu="matMenu">
              <button mat-menu-item type="button" (click)="export.emit(ExportFormat.Excel)">
                <span matMenuItemIcon class="material-symbols-rounded" aria-hidden="true">table_view</span>
                <span>Excel (.xls)</span>
              </button>
              <button mat-menu-item type="button" (click)="export.emit(ExportFormat.Csv)">
                <span matMenuItemIcon class="material-symbols-rounded" aria-hidden="true">description</span>
                <span>CSV</span>
              </button>
              <button mat-menu-item type="button" (click)="export.emit(ExportFormat.Pdf)">
                <span matMenuItemIcon class="material-symbols-rounded" aria-hidden="true"
                  >picture_as_pdf</span
                >
                <span>PDF</span>
              </button>
              <button mat-menu-item type="button" (click)="export.emit(ExportFormat.Json)">
                <span matMenuItemIcon class="material-symbols-rounded" aria-hidden="true">data_object</span>
                <span>JSON</span>
              </button>
            </mat-menu>
          }

          <button
            mat-icon-button
            type="button"
            matTooltip="Print"
            aria-label="Print"
            (click)="export.emit(ExportFormat.Print)">
            <span class="material-symbols-rounded" aria-hidden="true">print</span>
          </button>

          <button
            mat-icon-button
            type="button"
            [matTooltip]="layout.isFullscreen() ? 'Exit fullscreen' : 'Fullscreen'"
            aria-label="Toggle fullscreen"
            (click)="layout.toggleFullscreen()">
            <span class="material-symbols-rounded" aria-hidden="true">
              {{ layout.isFullscreen() ? 'fullscreen_exit' : 'fullscreen' }}
            </span>
          </button>
        </div>
      </div>

      <!-- Advanced filter drawer -->
      @if (hasAdvanced() && advancedOpen()) {
        <div class="toolbar__advanced">
          <ng-content select="[advanced]" />
        </div>
      }
    </div>
  `,
  styleUrl: './list-toolbar.scss',
})
export class ListToolbar {
  protected readonly layout = inject(LayoutService);
  protected readonly ExportFormat = ExportFormat;
  protected readonly String = String;

  readonly searchPlaceholder = input('Search…');
  readonly quickFilters = input<QuickFilter[]>([]);
  readonly showDateRange = input(false);
  readonly showExport = input(true);
  readonly hasAdvanced = input(false);
  readonly refreshing = input(false);
  /** Number of advanced criteria currently applied, rendered as a badge. */
  readonly activeFilterCount = input(0);

  readonly searchChange = output<string>();
  readonly quickChange = output<Record<string, string>>();
  readonly rangeChange = output<DateRange>();
  readonly refresh = output<void>();
  readonly export = output<ExportFormat>();
  readonly clear = output<void>();

  protected readonly searchTerm = signal('');
  protected readonly activeQuick = signal<Record<string, string>>({});
  protected readonly range = signal<DateRange>({ from: null, to: null });
  protected readonly advancedOpen = signal(false);
  protected readonly fromDate = computed(() => toDate(this.range().from));
  protected readonly toDate = computed(() => toDate(this.range().to));

  private readonly dateAdapter = inject<DateAdapter<Date>>(DateAdapter);
  private readonly translation = inject(TranslationService);

  private debounce: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Calendar month and weekday names follow the interface language.
    effect(() => this.dateAdapter.setLocale(this.translation.dateLocale()));

    // Seed the chip state from the declared filters' initial values.
    effect(() => {
      const seeded: Record<string, string> = {};
      for (const filter of this.quickFilters()) {
        if (filter.value) {
          seeded[filter.key] = filter.value;
        }
      }
      if (Object.keys(seeded).length > 0) {
        this.activeQuick.set(seeded);
      }
    });
  }

  protected hasDateRange(): boolean {
    const range = this.range();
    return Boolean(range.from || range.to);
  }

  protected quickLabel(filter: QuickFilter): string {
    const value = this.activeQuick()[filter.key];
    if (!value) {
      return filter.label;
    }
    return filter.options.find((option) => String(option.value) === value)?.label ?? filter.label;
  }

  /** Debounced so a fast typist does not fire a request per keystroke. */
  protected onSearchInput(value: string): void {
    this.searchTerm.set(value);
    if (this.debounce) {
      clearTimeout(this.debounce);
    }
    this.debounce = setTimeout(() => this.searchChange.emit(value.trim()), DEBOUNCE_MS.search);
  }

  protected setQuick(key: string, value: string): void {
    this.activeQuick.update((current) => {
      const next = { ...current };
      if (value) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return next;
    });
    this.quickChange.emit(this.activeQuick());
  }

  protected onRangeChange(field: 'from' | 'to', value: Date | null): void {
    this.range.update((current) => ({ ...current, [field]: toIsoDate(value) }));
    // Picking the start clears the end first; wait for a complete (or empty) range.
    const { from, to } = this.range();
    if ((from && to) || (!from && !to)) {
      this.rangeChange.emit(this.range());
    }
  }

  protected clearRange(): void {
    this.range.set({ from: null, to: null });
    this.rangeChange.emit(this.range());
  }

  protected toggleAdvanced(): void {
    this.advancedOpen.update((open) => !open);
  }

  protected clearAll(): void {
    this.searchTerm.set('');
    this.activeQuick.set({});
    this.range.set({ from: null, to: null });
    this.clear.emit();
  }
}

/** `yyyy-MM-dd` in local time — the shape list queries send to the API. */
function toIsoDate(value: Date | null): string | null {
  if (!value) {
    return null;
  }
  const pad = (part: number): string => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function toDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}
