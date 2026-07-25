import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { REGEX, VALIDATION_LIMITS } from '@core/constants/app.constants';

/**
 * Reusable reactive-form validators.
 *
 * Every validator returns a `message` alongside the error key so the shared
 * form-error component can render text without a per-field lookup table.
 */
export class AppValidators {
  /** Lao mobile number, accepting +856 and local 020/030 forms. */
  static laoPhone(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value ?? '').replace(/[\s-]/g, '');
      if (!value) {
        return null;
      }
      return REGEX.laoPhone.test(value)
        ? null
        : { laoPhone: { message: 'Enter a valid Lao mobile number, e.g. +856 20 5555 1234.' } };
    };
  }

  static email(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value ?? '').trim();
      if (!value) {
        return null;
      }
      return REGEX.email.test(value) ? null : { email: { message: 'Enter a valid email address.' } };
    };
  }

  static username(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value ?? '').trim();
      if (!value) {
        return null;
      }
      return REGEX.username.test(value)
        ? null
        : {
            username: {
              message: `Use ${VALIDATION_LIMITS.usernameMin}–${VALIDATION_LIMITS.usernameMax} letters, numbers, dots, hyphens or underscores.`,
            },
          };
    };
  }

  /** Banking-grade password policy. */
  static strongPassword(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value ?? '');
      if (!value) {
        return null;
      }
      return REGEX.strongPassword.test(value)
        ? null
        : {
            strongPassword: {
              message: 'Use at least 8 characters with upper case, lower case, a number and a symbol.',
            },
          };
    };
  }

  /** Cross-field check placed on the form group. */
  static matchFields(sourceField: string, targetField: string, label = 'Passwords'): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const source = group.get(sourceField);
      const target = group.get(targetField);
      if (!source || !target || !target.value) {
        return null;
      }
      if (source.value === target.value) {
        // Clear a previously set mismatch without discarding other errors.
        if (target.hasError('fieldsMismatch')) {
          const { fieldsMismatch: _removed, ...rest } = target.errors ?? {};
          target.setErrors(Object.keys(rest).length ? rest : null);
        }
        return null;
      }
      const error = { fieldsMismatch: { message: `${label} do not match.` } };
      target.setErrors({ ...target.errors, ...error });
      return error;
    };
  }

  /** Rejects whitespace-only input on otherwise required fields. */
  static notBlank(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.value === null || control.value === undefined || control.value === '') {
        return null;
      }
      return String(control.value).trim().length > 0
        ? null
        : { notBlank: { message: 'This field cannot be blank.' } };
    };
  }

  static min(minimum: number, label = 'Value'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = Number(control.value);
      if (control.value === null || control.value === '' || Number.isNaN(value)) {
        return null;
      }
      return value >= minimum
        ? null
        : { minValue: { message: `${label} must be at least ${minimum.toLocaleString()}.` } };
    };
  }

  static max(maximum: number, label = 'Value'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = Number(control.value);
      if (control.value === null || control.value === '' || Number.isNaN(value)) {
        return null;
      }
      return value <= maximum
        ? null
        : { maxValue: { message: `${label} must not exceed ${maximum.toLocaleString()}.` } };
    };
  }

  /** Percentage between 0 and 100, allowing up to two decimals. */
  static percentage(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = Number(control.value);
      if (control.value === null || control.value === '' || Number.isNaN(value)) {
        return null;
      }
      return value >= 0 && value <= 100
        ? null
        : { percentage: { message: 'Enter a percentage between 0 and 100.' } };
    };
  }

  /** Ensures a "to" date is not before its "from" date. */
  static dateRange(fromField: string, toField: string): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const from = group.get(fromField)?.value as string | Date | null;
      const to = group.get(toField)?.value as string | Date | null;
      if (!from || !to) {
        return null;
      }
      const fromTime = new Date(from).getTime();
      const toTime = new Date(to).getTime();
      return fromTime <= toTime
        ? null
        : { dateRange: { message: 'The end date must be on or after the start date.' } };
    };
  }

  /** Ensures a closing time falls after the opening time (HH:mm strings). */
  static timeAfter(openField: string, closeField: string): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const open = String(group.get(openField)?.value ?? '');
      const close = String(group.get(closeField)?.value ?? '');
      if (!open || !close) {
        return null;
      }
      return open < close
        ? null
        : { timeAfter: { message: 'The closing time must be after the opening time.' } };
    };
  }

  static hexColour(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value ?? '').trim();
      if (!value) {
        return null;
      }
      return REGEX.hexColour.test(value)
        ? null
        : { hexColour: { message: 'Enter a valid hex colour, e.g. #0b3d91.' } };
    };
  }

  /** OTP of exactly the configured length, digits only. */
  static otp(length = VALIDATION_LIMITS.otpLength): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value ?? '');
      if (!value) {
        return null;
      }
      return new RegExp(`^\\d{${length}}$`).test(value)
        ? null
        : { otp: { message: `Enter the ${length}-digit verification code.` } };
    };
  }

  /** Scores password strength 0–4 for the strength meter. */
  static passwordStrength(password: string): { score: number; label: string; hints: string[] } {
    const hints: string[] = [];
    let score = 0;

    if (password.length >= VALIDATION_LIMITS.passwordMin) {
      score++;
    } else {
      hints.push(`At least ${VALIDATION_LIMITS.passwordMin} characters`);
    }
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
      score++;
    } else {
      hints.push('Mix upper and lower case');
    }
    if (/\d/.test(password)) {
      score++;
    } else {
      hints.push('Include a number');
    }
    if (/[^A-Za-z0-9]/.test(password)) {
      score++;
    } else {
      hints.push('Include a symbol');
    }
    if (password.length >= 14) {
      score = Math.min(4, score + 1);
    }

    const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
    return { score, label: labels[score] ?? 'Very weak', hints };
  }
}

/** Extracts the first human-readable message from a control's errors. */
export function firstErrorMessage(control: AbstractControl | null): string {
  if (!control?.errors) {
    return '';
  }
  const [key, detail] = Object.entries(control.errors)[0] ?? [];
  if (!key) {
    return '';
  }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    return String((detail as { message: string }).message);
  }

  // Fall back to sensible text for Angular's built-in validators.
  switch (key) {
    case 'required':
      return 'This field is required.';
    case 'minlength':
      return `Minimum ${(detail as { requiredLength: number }).requiredLength} characters.`;
    case 'maxlength':
      return `Maximum ${(detail as { requiredLength: number }).requiredLength} characters.`;
    case 'min':
      return `Minimum value is ${(detail as { min: number }).min}.`;
    case 'max':
      return `Maximum value is ${(detail as { max: number }).max}.`;
    case 'pattern':
      return 'The value does not match the expected format.';
    default:
      return 'This value is not valid.';
  }
}
