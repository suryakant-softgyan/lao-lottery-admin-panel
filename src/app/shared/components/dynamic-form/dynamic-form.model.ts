import type { ValidatorFn } from '@angular/forms';

import type { SelectOption } from '@core/models/common.model';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'password'
  | 'number'
  | 'currency'
  | 'percent'
  | 'phone'
  | 'select'
  | 'multiselect'
  | 'autocomplete'
  | 'date'
  | 'time'
  | 'datetime'
  | 'checkbox'
  | 'toggle'
  | 'radio'
  | 'colour'
  | 'slider'
  | 'file'
  | 'divider'
  | 'heading';

/** One control in a generated form. */
export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  hint?: string;
  icon?: string;
  /** Grid span out of 12. Defaults to 6 (half width) on desktop. */
  span?: number;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  options?: SelectOption[];
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  rows?: number;
  validators?: ValidatorFn[];
  /** Default applied when the form is created without an initial value. */
  defaultValue?: unknown;
  /** Hides the field unless the predicate passes — enables dependent fields. */
  visibleWhen?: (value: Record<string, unknown>) => boolean;
  /** Accepted MIME types for `file`. */
  accept?: string;
  multiple?: boolean;
  /** Shows the password strength meter on a `password` field. */
  showStrength?: boolean;
  /** Prefix/suffix text rendered inside the field, e.g. `₭` or `%`. */
  prefix?: string;
  suffix?: string;
}

/** A titled group of fields, rendered as a section or a wizard step. */
export interface FormSection {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  fields: FormField[];
}

/** Full schema handed to the dynamic form / form dialog. */
export interface FormSchema {
  sections: FormSection[];
  /** Renders as a stepper wizard rather than a single scrolling form. */
  wizard?: boolean;
  /** Cross-field validators applied to the whole form group. */
  validators?: ValidatorFn[];
}
