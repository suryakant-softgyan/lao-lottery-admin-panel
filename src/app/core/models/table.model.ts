import type { TemplateRef } from '@angular/core';

import type { FilterOperator, SelectOption } from './common.model';

/** How a cell is rendered when no custom template is supplied. */
export type ColumnType =
  | 'text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'time'
  | 'relative'
  | 'boolean'
  | 'badge'
  | 'avatar'
  | 'chips'
  | 'progress'
  | 'icon'
  | 'link'
  | 'actions'
  | 'template';

export type ColumnAlign = 'start' | 'center' | 'end';

/** Maps a raw enum value to a rendered badge. */
export interface BadgeMapEntry {
  label: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  icon?: string;
}

export interface TableColumn<T = Record<string, unknown>> {
  /** Property path on the row, dot notation supported (`contact.phone`). */
  key: string;
  label: string;
  labelKey?: string;
  type?: ColumnType;
  align?: ColumnAlign;
  width?: number;
  minWidth?: number;
  sortable?: boolean;
  /** Column takes part in the quick-search scan. */
  searchable?: boolean;
  /** Column is offered in the advanced filter builder. */
  filterable?: boolean;
  filterOperators?: FilterOperator[];
  filterOptions?: SelectOption[];
  hidden?: boolean;
  /** Column cannot be hidden or reordered by the user. */
  locked?: boolean;
  sticky?: 'start' | 'end';
  resizable?: boolean;
  exportable?: boolean;
  /** Badge lookup for `type: 'badge'`. */
  badgeMap?: Record<string, BadgeMapEntry>;
  /** Derives the display value; falls back to the raw property. */
  value?: (row: T) => unknown;
  /** Formats the derived value into a display string. */
  format?: (value: unknown, row: T) => string;
  /** Extra CSS classes applied to the cell. */
  cellClass?: (row: T) => string;
  tooltip?: (row: T) => string;
  template?: TemplateRef<unknown>;
  /** Sub-label rendered under the main value for `avatar` / `text`. */
  subLabel?: (row: T) => string;
  avatarUrl?: (row: T) => string;
  routerLink?: (row: T) => unknown[];
}

export interface TableAction<T = Record<string, unknown>> {
  id: string;
  label: string;
  labelKey?: string;
  icon: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  /** Hidden entirely when this returns false. */
  visible?: (row: T) => boolean;
  disabled?: (row: T) => boolean;
  permissions?: string[];
  divider?: boolean;
  /** Shown as an icon button in the row rather than in the overflow menu. */
  primary?: boolean;
  confirm?: {
    title: string;
    message: string;
    confirmLabel?: string;
    tone?: 'primary' | 'warning' | 'danger';
  };
}

export interface BulkAction {
  id: string;
  label: string;
  icon: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  permissions?: string[];
  confirm?: {
    title: string;
    message: string;
    confirmLabel?: string;
    tone?: 'primary' | 'warning' | 'danger';
  };
}

export interface TableActionEvent<T = Record<string, unknown>> {
  action: string;
  row: T;
}

export interface BulkActionEvent<T = Record<string, unknown>> {
  action: string;
  rows: T[];
}

/** Persisted per-table user preferences. */
export interface TablePreferences {
  columnOrder: string[];
  hiddenColumns: string[];
  columnWidths: Record<string, number>;
  pageSize: number;
  density: 'comfortable' | 'compact' | 'ultra-compact';
}
