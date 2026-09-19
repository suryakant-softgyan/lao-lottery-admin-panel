import { SortDirection } from '../enums';
import type { FilterCriterion, Page, PageQuery } from '../models/common.model';
import { getByPath } from './object.util';

/**
 * In-memory query engine.
 *
 * Every mock repository funnels its dataset through {@link applyQuery}, which
 * mirrors what the server will do once the REST endpoints exist: quick search,
 * structured filters, date-range narrowing, sorting, then pagination. Because
 * the contract is identical, swapping to HTTP is a one-line change in the
 * repository — the component keeps sending the same {@link PageQuery}.
 */

function compareValues(a: unknown, b: unknown): number {
  if (a === b) {
    return 0;
  }
  if (a === null || a === undefined) {
    return -1;
  }
  if (b === null || b === undefined) {
    return 1;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return Number(a) - Number(b);
  }

  const aString = String(a);
  const bString = String(b);
  const aDate = Date.parse(aString);
  const bDate = Date.parse(bString);
  const looksLikeDate = /^\d{4}-\d{2}-\d{2}/.test(aString) && /^\d{4}-\d{2}-\d{2}/.test(bString);
  if (looksLikeDate && !Number.isNaN(aDate) && !Number.isNaN(bDate)) {
    return aDate - bDate;
  }
  return aString.localeCompare(bString, undefined, { numeric: true, sensitivity: 'base' });
}

function matchesCriterion(row: unknown, criterion: FilterCriterion): boolean {
  const actual = getByPath(row, criterion.field);
  const expected = criterion.value;

  switch (criterion.operator) {
    case 'eq':
      return String(actual ?? '') === String(expected ?? '');
    case 'neq':
      return String(actual ?? '') !== String(expected ?? '');
    case 'contains':
      return String(actual ?? '')
        .toLowerCase()
        .includes(String(expected ?? '').toLowerCase());
    case 'startsWith':
      return String(actual ?? '')
        .toLowerCase()
        .startsWith(String(expected ?? '').toLowerCase());
    case 'endsWith':
      return String(actual ?? '')
        .toLowerCase()
        .endsWith(String(expected ?? '').toLowerCase());
    case 'gt':
      return compareValues(actual, expected) > 0;
    case 'gte':
      return compareValues(actual, expected) >= 0;
    case 'lt':
      return compareValues(actual, expected) < 0;
    case 'lte':
      return compareValues(actual, expected) <= 0;
    case 'between':
      return compareValues(actual, expected) >= 0 && compareValues(actual, criterion.valueTo) <= 0;
    case 'in':
      return Array.isArray(expected) && expected.map(String).includes(String(actual ?? ''));
    case 'notIn':
      return !(Array.isArray(expected) && expected.map(String).includes(String(actual ?? '')));
    case 'isNull':
      return actual === null || actual === undefined || actual === '';
    case 'isNotNull':
      return actual !== null && actual !== undefined && actual !== '';
    default:
      return true;
  }
}

/** Scans a whitelist of fields — or the whole row — for the search term. */
function matchesSearch(row: unknown, term: string, fields?: readonly string[]): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  if (fields?.length) {
    return fields.some((field) =>
      String(getByPath(row, field) ?? '')
        .toLowerCase()
        .includes(needle),
    );
  }
  return JSON.stringify(row ?? {})
    .toLowerCase()
    .includes(needle);
}

function withinDateRange(row: unknown, field: string, from: string | null, to: string | null): boolean {
  if (!from && !to) {
    return true;
  }
  const raw = getByPath(row, field);
  const value = raw ? Date.parse(String(raw)) : Number.NaN;
  if (Number.isNaN(value)) {
    return false;
  }
  if (from && value < Date.parse(from)) {
    return false;
  }
  // `to` is inclusive of the whole day.
  if (to && value > Date.parse(to) + 86_399_999) {
    return false;
  }
  return true;
}

export interface QueryOptions {
  /** Fields scanned by the quick-search box. Defaults to the whole row. */
  searchFields?: readonly string[];
  /** Field the `dateRange` filter applies to. Defaults to `createdAt`. */
  dateField?: string;
  /** Extra matcher for the `quick` bag, e.g. status chips. */
  quickMatcher?: (row: unknown, quick: Record<string, unknown>) => boolean;
}

/** Default `quick` handling: exact match on every non-empty key. */
function defaultQuickMatcher(row: unknown, quick: Record<string, unknown>): boolean {
  return Object.entries(quick).every(([field, value]) => {
    if (value === null || value === undefined || value === '' || value === 'ALL') {
      return true;
    }
    const actual = getByPath(row, field);
    if (Array.isArray(value)) {
      return value.length === 0 || value.map(String).includes(String(actual ?? ''));
    }
    if (typeof value === 'boolean') {
      return Boolean(actual) === value;
    }
    return String(actual ?? '') === String(value);
  });
}

/** Filters + sorts without paginating — used for exports and charts. */
export function applyFilters<T>(items: readonly T[], query: PageQuery, options: QueryOptions = {}): T[] {
  const { searchFields, dateField = 'createdAt', quickMatcher = defaultQuickMatcher } = options;

  let result = items.filter((row) => {
    if (query.search && !matchesSearch(row, query.search, searchFields)) {
      return false;
    }
    if (query.quick && !quickMatcher(row, query.quick)) {
      return false;
    }
    if (query.dateRange && !withinDateRange(row, dateField, query.dateRange.from, query.dateRange.to)) {
      return false;
    }
    if (query.filters?.length && !query.filters.every((criterion) => matchesCriterion(row, criterion))) {
      return false;
    }
    return true;
  });

  if (query.sort?.active && query.sort.direction) {
    const factor = query.sort.direction === SortDirection.Desc ? -1 : 1;
    const field = query.sort.active;
    result = [...result].sort((a, b) => compareValues(getByPath(a, field), getByPath(b, field)) * factor);
  }

  return result;
}

/** Full pipeline: filter → sort → slice into a {@link Page}. */
export function applyQuery<T>(items: readonly T[], query: PageQuery, options: QueryOptions = {}): Page<T> {
  const filtered = applyFilters(items, query, options);
  const size = Math.max(1, query.size || 25);
  const totalElements = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const page = Math.min(Math.max(0, query.page || 0), totalPages - 1);
  const start = page * size;

  return {
    content: filtered.slice(start, start + size),
    page,
    size,
    totalElements,
    totalPages,
    first: page === 0,
    last: page >= totalPages - 1,
  };
}

/** Convenience factory so callers never build a partial query by hand. */
export function createPageQuery(overrides: Partial<PageQuery> = {}): PageQuery {
  return {
    page: 0,
    size: 25,
    search: '',
    sort: { active: '', direction: '' },
    filters: [],
    dateRange: { from: null, to: null },
    quick: {},
    ...overrides,
  };
}

/** Wraps a plain array in a single-page {@link Page} envelope. */
export function toSinglePage<T>(items: readonly T[]): Page<T> {
  return {
    content: [...items],
    page: 0,
    size: items.length,
    totalElements: items.length,
    totalPages: 1,
    first: true,
    last: true,
  };
}
