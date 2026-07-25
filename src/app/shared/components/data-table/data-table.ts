import { SelectionModel } from '@angular/cdk/collections';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
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
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PermissionService } from '@core/authentication/permission.service';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, STORAGE_KEYS } from '@core/constants/app.constants';
import { SortDirection } from '@core/enums';
import type { Page, SortState } from '@core/models/common.model';
import type {
  BulkAction,
  BulkActionEvent,
  TableAction,
  TableActionEvent,
  TableColumn,
  TablePreferences,
} from '@core/models/table.model';
import { ConfirmService } from '@core/services/confirm.service';
import { StorageService } from '@core/services/storage.service';
import { ThemeService } from '@core/services/theme.service';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelative,
  formatTime,
  humanise,
} from '@core/utilities/format.util';
import { getByPath } from '@core/utilities/object.util';
import { Avatar } from '../avatar/avatar';
import { Skeleton } from '../skeleton/skeleton';
import { StatePanel } from '../state-panel/state-panel';
import { StatusBadge } from '../status-badge/status-badge';
import { ResizableColumnDirective } from '../../directives/ui.directives';

/**
 * Enterprise data table.
 *
 * One component covers the table requirements of every list screen: sorting,
 * pagination, single/bulk selection, row and bulk actions, column visibility,
 * reordering, resizing, sticky header and columns, expandable rows, a context
 * menu, and the loading/empty/error states.
 *
 * It is deliberately *presentational* — paging and filtering happen on the
 * server (or in the mock query engine). The host page owns the query and hands
 * back a {@link Page}, which is exactly how it will behave against a real API.
 *
 * Column layout preferences are persisted per `tableId`, so an operator's
 * arrangement survives a reload.
 */
@Component({
  selector: 'll-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    CdkDrag,
    CdkDropList,
    MatButtonModule,
    MatCheckboxModule,
    MatDividerModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTooltipModule,
    Avatar,
    Skeleton,
    StatePanel,
    StatusBadge,
    ResizableColumnDirective,
  ],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
})
export class DataTable<T extends { id: string }> {
  private readonly storage = inject(StorageService);
  private readonly permissions = inject(PermissionService);
  private readonly confirm = inject(ConfirmService);
  private readonly theme = inject(ThemeService);

  /** Stable identifier used to persist column preferences. */
  readonly tableId = input.required<string>();
  readonly columns = input.required<TableColumn<T>[]>();
  readonly page = input<Page<T> | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly sort = input<SortState>({ active: '', direction: '' });

  readonly selectable = input(true);
  readonly rowActions = input<TableAction<T>[]>([]);
  readonly bulkActions = input<BulkAction[]>([]);
  readonly expandable = input(false);
  readonly stickyHeader = input(true);
  readonly showPaginator = input(true);
  readonly pageSizeOptions = input<readonly number[]>(PAGE_SIZE_OPTIONS);
  /** Empty-state copy shown when there is no data at all. */
  readonly emptyTitle = input('Nothing here yet');
  readonly emptyMessage = input('Once records are created they will appear in this list.');
  /** True when filters are applied — switches the empty state to "no results". */
  readonly filtered = input(false);
  readonly rowLink = input<((row: T) => unknown[]) | null>(null);
  /** Renders rows with a pointer cursor when the host handles `rowClick`. */
  readonly clickableRows = input(true);

  readonly sortChange = output<SortState>();
  readonly pageChange = output<{ page: number; size: number }>();
  readonly rowAction = output<TableActionEvent<T>>();
  readonly bulkAction = output<BulkActionEvent<T>>();
  readonly rowClick = output<T>();
  readonly selectionChange = output<T[]>();
  readonly retry = output<void>();

  protected readonly selection = new SelectionModel<string>(true, []);
  protected readonly expandedRows = signal<ReadonlySet<string>>(new Set());
  protected readonly contextRow = signal<T | null>(null);

  /** Persisted per-table layout: order, hidden columns, widths, page size. */
  private readonly preferences = signal<TablePreferences>({
    columnOrder: [],
    hiddenColumns: [],
    columnWidths: {},
    pageSize: DEFAULT_PAGE_SIZE,
    density: 'comfortable',
  });

  /** Mirrors the selection model into a signal for template reads. */
  private readonly selectedKeys = signal<readonly string[]>([]);

  constructor() {
    // Load stored preferences once the table id is known.
    effect(() => {
      const id = this.tableId();
      const stored = this.storage.get<TablePreferences | null>(`${STORAGE_KEYS.tablePrefs}.${id}`, null);
      if (stored) {
        this.preferences.set(stored);
      }
    });

    // A new page of data invalidates any selection of rows no longer present.
    effect(() => {
      const rows = this.page()?.content ?? [];
      const present = new Set(rows.map((row) => row.id));
      const stale = this.selection.selected.filter((id) => !present.has(id));
      if (stale.length > 0) {
        this.selection.deselect(...stale);
        this.syncSelection();
      }
    });
  }

  // ------------------------------------------------------------------ columns

  /** Visible columns, honouring the stored order and hidden set. */
  protected readonly visibleColumns = computed<TableColumn<T>[]>(() => {
    const preferences = this.preferences();
    const hidden = new Set(preferences.hiddenColumns);
    const byKey = new Map(this.columns().map((column) => [column.key, column]));

    const ordered = preferences.columnOrder.length
      ? [
          ...preferences.columnOrder
            .map((key) => byKey.get(key))
            .filter((column): column is TableColumn<T> => Boolean(column)),
          ...this.columns().filter((column) => !preferences.columnOrder.includes(column.key)),
        ]
      : this.columns();

    return ordered
      .filter((column) => !column.hidden && !hidden.has(column.key))
      .map((column) => ({ ...column, width: preferences.columnWidths[column.key] ?? column.width }));
  });

  /** Column keys in render order, including the selection and action columns. */
  protected readonly displayedKeys = computed(() => {
    const keys: string[] = [];
    if (this.selectable()) {
      keys.push('__select');
    }
    if (this.expandable()) {
      keys.push('__expand');
    }
    keys.push(...this.visibleColumns().map((column) => column.key));
    if (this.resolvedRowActions().length > 0) {
      keys.push('__actions');
    }
    return keys;
  });

  /** Columns offered in the column-visibility menu (locked ones excluded). */
  protected readonly toggleableColumns = computed(() => this.columns().filter((column) => !column.locked));

  protected isColumnVisible(key: string): boolean {
    return !this.preferences().hiddenColumns.includes(key);
  }

  protected toggleColumn(key: string): void {
    this.preferences.update((current) => {
      const hidden = current.hiddenColumns.includes(key)
        ? current.hiddenColumns.filter((item) => item !== key)
        : [...current.hiddenColumns, key];
      return { ...current, hiddenColumns: hidden };
    });
    this.persistPreferences();
  }

  protected showAllColumns(): void {
    this.preferences.update((current) => ({ ...current, hiddenColumns: [] }));
    this.persistPreferences();
  }

  protected resetLayout(): void {
    this.preferences.set({
      columnOrder: [],
      hiddenColumns: [],
      columnWidths: {},
      pageSize: this.preferences().pageSize,
      density: 'comfortable',
    });
    this.persistPreferences();
  }

  protected onColumnDrop(event: CdkDragDrop<string[]>): void {
    const order = this.visibleColumns().map((column) => column.key);
    moveItemInArray(order, event.previousIndex, event.currentIndex);
    this.preferences.update((current) => ({ ...current, columnOrder: order }));
    this.persistPreferences();
  }

  protected onColumnResize(key: string, width: number): void {
    this.preferences.update((current) => ({
      ...current,
      columnWidths: { ...current.columnWidths, [key]: width },
    }));
    this.persistPreferences();
  }

  private persistPreferences(): void {
    this.storage.set(`${STORAGE_KEYS.tablePrefs}.${this.tableId()}`, this.preferences());
  }

  // ------------------------------------------------------------------ sorting

  protected sortIcon(column: TableColumn<T>): string {
    const sort = this.sort();
    if (sort.active !== column.key || !sort.direction) {
      return 'unfold_more';
    }
    return sort.direction === SortDirection.Asc ? 'arrow_upward' : 'arrow_downward';
  }

  protected isSorted(column: TableColumn<T>): boolean {
    return this.sort().active === column.key && Boolean(this.sort().direction);
  }

  protected toggleSort(column: TableColumn<T>): void {
    if (column.sortable === false) {
      return;
    }
    const sort = this.sort();
    if (sort.active !== column.key) {
      this.sortChange.emit({ active: column.key, direction: SortDirection.Asc });
      return;
    }
    // asc → desc → cleared, the pattern operators expect from Material tables.
    if (sort.direction === SortDirection.Asc) {
      this.sortChange.emit({ active: column.key, direction: SortDirection.Desc });
    } else {
      this.sortChange.emit({ active: '', direction: '' });
    }
  }

  // ---------------------------------------------------------------- selection

  protected readonly rows = computed(() => this.page()?.content ?? []);

  protected readonly selectedCount = computed(() => this.selectedKeys().length);

  protected readonly allSelected = computed(() => {
    const rows = this.rows();
    return rows.length > 0 && rows.every((row) => this.selectedKeys().includes(row.id));
  });

  protected readonly someSelected = computed(() => this.selectedCount() > 0 && !this.allSelected());

  protected isSelected(row: T): boolean {
    return this.selectedKeys().includes(row.id);
  }

  protected toggleRow(row: T): void {
    this.selection.toggle(row.id);
    this.syncSelection();
  }

  protected toggleAll(): void {
    if (this.allSelected()) {
      this.selection.deselect(...this.rows().map((row) => row.id));
    } else {
      this.selection.select(...this.rows().map((row) => row.id));
    }
    this.syncSelection();
  }

  protected clearSelection(): void {
    this.selection.clear();
    this.syncSelection();
  }

  private syncSelection(): void {
    this.selectedKeys.set([...this.selection.selected]);
    this.selectionChange.emit(this.selectedRows());
  }

  private selectedRows(): T[] {
    const selected = new Set(this.selection.selected);
    return this.rows().filter((row) => selected.has(row.id));
  }

  // ------------------------------------------------------------------ actions

  /** Row actions filtered by the operator's permissions. */
  protected readonly resolvedRowActions = computed(() =>
    this.rowActions().filter((action) => this.permissions.hasAny(action.permissions)),
  );

  protected readonly resolvedBulkActions = computed(() =>
    this.bulkActions().filter((action) => this.permissions.hasAny(action.permissions)),
  );

  protected visibleActions(row: T): TableAction<T>[] {
    return this.resolvedRowActions().filter((action) => action.visible?.(row) ?? true);
  }

  protected primaryActions(row: T): TableAction<T>[] {
    return this.visibleActions(row).filter((action) => action.primary);
  }

  protected menuActions(row: T): TableAction<T>[] {
    return this.visibleActions(row).filter((action) => !action.primary);
  }

  protected runRowAction(action: TableAction<T>, row: T, event?: Event): void {
    event?.stopPropagation();
    if (!action.confirm) {
      this.rowAction.emit({ action: action.id, row });
      return;
    }
    this.confirm
      .ask({
        title: action.confirm.title,
        message: action.confirm.message,
        confirmLabel: action.confirm.confirmLabel ?? action.label,
        tone: action.confirm.tone ?? 'warning',
        icon: action.icon,
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.rowAction.emit({ action: action.id, row });
        }
      });
  }

  protected runBulkAction(action: BulkAction): void {
    const rows = this.selectedRows();
    if (rows.length === 0) {
      return;
    }
    const emit = (): void => {
      this.bulkAction.emit({ action: action.id, rows });
      this.clearSelection();
    };

    if (!action.confirm) {
      emit();
      return;
    }
    this.confirm
      .ask({
        title: action.confirm.title,
        message: action.confirm.message.replace('{count}', String(rows.length)),
        confirmLabel: action.confirm.confirmLabel ?? action.label,
        tone: action.confirm.tone ?? 'warning',
        icon: action.icon,
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          emit();
        }
      });
  }

  // ------------------------------------------------------------------- rows

  protected isExpanded(row: T): boolean {
    return this.expandedRows().has(row.id);
  }

  protected toggleExpanded(row: T, event?: Event): void {
    event?.stopPropagation();
    this.expandedRows.update((current) => {
      const next = new Set(current);
      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.add(row.id);
      }
      return next;
    });
  }

  protected onRowClick(row: T): void {
    this.rowClick.emit(row);
  }

  protected onPage(event: PageEvent): void {
    this.preferences.update((current) => ({ ...current, pageSize: event.pageSize }));
    this.persistPreferences();
    this.pageChange.emit({ page: event.pageIndex, size: event.pageSize });
  }

  // ------------------------------------------------------------- cell render

  /** Raw value for a cell, before formatting. */
  protected rawValue(row: T, column: TableColumn<T>): unknown {
    return column.value ? column.value(row) : getByPath(row, column.key);
  }

  /** Fully formatted display string for text-like column types. */
  protected displayValue(row: T, column: TableColumn<T>): string {
    const raw = this.rawValue(row, column);
    if (column.format) {
      return column.format(raw, row);
    }
    if (raw === null || raw === undefined || raw === '') {
      return '—';
    }

    const regional = this.theme.regional();
    const use24h = regional.timeFormat === '24h';

    switch (column.type) {
      case 'number':
        return formatNumber(Number(raw), regional.locale);
      case 'currency':
        return formatCurrency(Number(raw), regional.currency, regional.locale, {
          compact: false,
          symbol: regional.currencySymbol,
          position: regional.currencyPosition,
        });
      case 'percent':
        return formatPercent(Number(raw), 1, regional.locale);
      case 'date':
        return formatDate(String(raw), regional.locale);
      case 'datetime':
        return formatDateTime(String(raw), regional.locale, use24h);
      case 'time':
        return formatTime(String(raw), regional.locale, use24h);
      case 'relative':
        return formatRelative(String(raw), regional.locale);
      case 'boolean':
        return raw ? 'Yes' : 'No';
      case 'chips':
        return Array.isArray(raw) ? raw.join(', ') : String(raw);
      default:
        return typeof raw === 'string' ? raw : String(raw);
    }
  }

  protected chipValues(row: T, column: TableColumn<T>): string[] {
    const raw = this.rawValue(row, column);
    return Array.isArray(raw) ? raw.map((item) => humanise(String(item))) : [];
  }

  protected progressValue(row: T, column: TableColumn<T>): number {
    const raw = Number(this.rawValue(row, column));
    return Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
  }

  /** Numeric and currency columns align to the end for scannability. */
  protected alignment(column: TableColumn<T>): string {
    if (column.align) {
      return column.align;
    }
    return column.type === 'number' || column.type === 'currency' || column.type === 'percent'
      ? 'end'
      : 'start';
  }

  protected stickyClass(column: TableColumn<T>): string {
    if (column.sticky === 'start') {
      return 'cell--sticky-start';
    }
    return column.sticky === 'end' ? 'cell--sticky-end' : '';
  }

  protected trackRow = (_index: number, row: T): string => row.id;

  protected trackColumn = (_index: number, column: TableColumn<T>): string => column.key;
}
