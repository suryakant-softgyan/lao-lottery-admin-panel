import { Directive, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap, tap } from 'rxjs';
import type { Observable } from 'rxjs';

import { DEFAULT_PAGE_SIZE } from '@core/constants/app.constants';
import type { ExportFormat } from '@core/enums';
import type { AppError, DateRange, Page, PageQuery, SortState } from '@core/models/common.model';
import type { TableColumn } from '@core/models/table.model';
import { ExportService } from '@core/services/export.service';
import { ToastService } from '@core/services/toast.service';
import { createPageQuery } from '@core/utilities/query.util';

/**
 * Base class for every list screen.
 *
 * Owns the query lifecycle that would otherwise be copy-pasted into fifteen
 * components: paging, sorting, search, quick filters, date range, reload,
 * loading/error state and export. A concrete list page supplies `fetch()` and
 * the table columns, then focuses on what makes it different.
 *
 * Declared as a `@Directive` (not a plain class) so Angular's DI works in
 * subclasses without each one re-declaring providers.
 */
@Directive()
export abstract class ListPageBase<T extends { id: string }> {
  protected readonly exportService = inject(ExportService);
  protected readonly toast = inject(ToastService);

  /** Fires whenever the query changes or a reload is requested. */
  private readonly trigger = new Subject<void>();

  protected readonly query = signal<PageQuery>(createPageQuery({ size: DEFAULT_PAGE_SIZE }));
  protected readonly page = signal<Page<T> | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly selected = signal<T[]>([]);

  /** Human label for the export file and print header. */
  protected abstract readonly entityLabel: string;

  /** Columns rendered by the table and included in exports. */
  protected abstract readonly columns: TableColumn<T>[] | (() => TableColumn<T>[]);

  /** Executes the query against a repository. */
  protected abstract fetch(query: PageQuery): Observable<Page<T>>;

  /** True when any narrowing is applied — switches the empty state copy. */
  protected readonly isFiltered = computed(() => {
    const query = this.query();
    const quickApplied = Object.values(query.quick ?? {}).some((value) => value !== '' && value !== null);
    return Boolean(
      query.search || quickApplied || query.dateRange?.from || query.dateRange?.to || query.filters?.length,
    );
  });

  protected readonly total = computed(() => this.page()?.totalElements ?? 0);

  protected readonly rows = computed(() => this.page()?.content ?? []);

  /** Wire the pipeline. Subclasses call this from their constructor. */
  protected initialise(): void {
    this.trigger
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.errorMessage.set(null);
        }),
        // switchMap cancels an in-flight request when the operator keeps typing.
        switchMap(() => this.fetch(this.query())),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (page) => {
          this.page.set(page);
          this.loading.set(false);
        },
        error: (error: AppError | Error) => {
          this.loading.set(false);
          this.errorMessage.set('message' in error ? error.message : 'The data could not be loaded.');
        },
      });

    this.reload();
  }

  reload(): void {
    this.trigger.next();
  }

  /** Applies a partial query change and resets to the first page. */
  protected patchQuery(changes: Partial<PageQuery>, resetPage = true): void {
    this.query.update((current) => ({
      ...current,
      ...changes,
      page: resetPage ? 0 : (changes.page ?? current.page),
    }));
    this.reload();
  }

  onSearch(term: string): void {
    this.patchQuery({ search: term });
  }

  onSort(sort: SortState): void {
    this.patchQuery({ sort });
  }

  onPage(event: { page: number; size: number }): void {
    this.patchQuery({ page: event.page, size: event.size }, false);
  }

  onQuickFilter(quick: Record<string, string>): void {
    this.patchQuery({ quick });
  }

  onDateRange(dateRange: DateRange): void {
    this.patchQuery({ dateRange });
  }

  onClearFilters(): void {
    this.query.set(createPageQuery({ size: this.query().size }));
    this.reload();
  }

  onSelectionChange(rows: T[]): void {
    this.selected.set(rows);
  }

  /** Resolves the columns whether they were supplied as an array or a factory. */
  protected resolvedColumns(): TableColumn<T>[] {
    return typeof this.columns === 'function' ? this.columns() : this.columns;
  }

  /**
   * Exports what the operator is currently looking at.
   *
   * Uses the loaded page when nothing is selected, or just the selected rows
   * when there is a selection — which is what an operator expects after ticking
   * a handful of records.
   */
  onExport(format: ExportFormat): void {
    const selection = this.selected();
    const rows = selection.length > 0 ? selection : this.rows();

    this.exportService.export<T>({
      format,
      fileName: this.entityLabel.toLowerCase().replace(/\s+/g, '-'),
      title: this.entityLabel,
      subtitle: this.exportSubtitle(),
      columns: this.resolvedColumns(),
      rows,
      includeTotals: true,
    });
  }

  /** Describes the active filters in the export/print header. */
  protected exportSubtitle(): string {
    const query = this.query();
    const parts: string[] = [];
    if (query.search) {
      parts.push(`Search: “${query.search}”`);
    }
    for (const [key, value] of Object.entries(query.quick ?? {})) {
      if (value) {
        parts.push(`${key}: ${String(value)}`);
      }
    }
    if (query.dateRange?.from || query.dateRange?.to) {
      parts.push(`Period: ${query.dateRange.from ?? '…'} → ${query.dateRange.to ?? '…'}`);
    }
    const selection = this.selected().length;
    if (selection > 0) {
      parts.push(`${selection} selected row(s)`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'All records';
  }
}
