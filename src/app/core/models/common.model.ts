import type { Severity, SortDirection, TrendDirection } from '../enums';

/** Every persisted entity carries these audit columns. */
export interface AuditableEntity {
  readonly id: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** Server envelope. Mock repositories emit the same shape as the real gateway. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
  traceId?: string;
}

/** Normalised error surfaced by the HTTP error interceptor. */
export interface AppError {
  status: number;
  code: string;
  message: string;
  details?: string;
  traceId?: string;
  timestamp: string;
  retriable: boolean;
}

export interface SortState {
  active: string;
  direction: SortDirection | '';
}

/** Operators understood by the advanced filter builder. */
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'notIn'
  | 'isNull'
  | 'isNotNull';

export interface FilterCriterion {
  field: string;
  operator: FilterOperator;
  value: unknown;
  valueTo?: unknown;
}

export interface DateRange {
  from: string | null;
  to: string | null;
}

/** Query sent to any paged endpoint. */
export interface PageQuery {
  page: number;
  size: number;
  search?: string;
  sort?: SortState;
  filters?: FilterCriterion[];
  dateRange?: DateRange;
  /** Free-form quick filters, e.g. `{ status: 'ACTIVE' }`. */
  quick?: Record<string, unknown>;
}

/** Standard paged payload. */
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface KeyValue<T = string> {
  key: string;
  value: T;
}

/** Option used by every select / autocomplete control in the app. */
export interface SelectOption<T = string> {
  value: T;
  label: string;
  icon?: string;
  colour?: string;
  description?: string;
  disabled?: boolean;
  group?: string;
}

/** Metric tile shown on dashboards and page headers. */
export interface StatMetric {
  id: string;
  label: string;
  value: number;
  formatted?: string;
  unit?: string;
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  delta?: number;
  deltaLabel?: string;
  trend?: TrendDirection;
  sparkline?: number[];
  route?: string;
  hint?: string;
}

/** Timeline entry rendered by the activity-timeline component. */
export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  actor: string;
  actorAvatar?: string;
  timestamp: string;
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  severity?: Severity;
  meta?: Record<string, string>;
}

export interface Address {
  line1: string;
  line2?: string;
  village?: string;
  district: string;
  province: string;
  postalCode?: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

export interface ContactDetails {
  phone: string;
  altPhone?: string;
  email: string;
  whatsapp?: string;
}

export interface MoneyAmount {
  amount: number;
  currency: string;
}

export interface AttachmentRef {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}
