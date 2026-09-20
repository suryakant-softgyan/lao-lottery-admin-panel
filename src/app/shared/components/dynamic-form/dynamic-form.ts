import { NgTemplateOutlet } from '@angular/common';
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
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';

import { VALIDATION_LIMITS } from '@core/constants/app.constants';
import { TranslationService } from '@core/services/translation.service';
import { AppDateAdapter } from '@core/utilities/app-date-adapter';
import { AppValidators, firstErrorMessage } from '../../validators/app.validators';
import type { FormField, FormSchema } from './dynamic-form.model';

/**
 * Schema-driven reactive form.
 *
 * Feature modules describe *what* to capture ({@link FormSchema}) rather than
 * hand-writing markup for every field, which is what keeps create/edit screens
 * consistent — same spacing, same validation messages, same required markers,
 * same responsive grid — with no duplicated template code.
 *
 * Supports plain sections or a stepper wizard, conditional fields, inline
 * errors and a password-strength meter.
 */
@Component({
  selector: 'll-dynamic-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: DateAdapter, useClass: AppDateAdapter }],
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatStepperModule,
    MatTooltipModule,
  ],
  templateUrl: './dynamic-form.html',
  styleUrl: './dynamic-form.scss',
})
export class DynamicForm {
  private readonly fb = inject(FormBuilder);
  private readonly dateAdapter = inject<DateAdapter<Date>>(DateAdapter);
  private readonly translation = inject(TranslationService);

  readonly schema = input.required<FormSchema>();
  readonly value = input<Record<string, unknown> | null>(null);
  readonly submitting = input(false);
  readonly submitLabel = input('Save');
  readonly cancelLabel = input('Cancel');
  readonly showActions = input(true);

  readonly formSubmit = output<Record<string, unknown>>();
  readonly cancelled = output<void>();
  readonly valueChanged = output<Record<string, unknown>>();

  /** Mirrors the raw form value so `visibleWhen` predicates stay reactive. */
  private readonly currentValue = signal<Record<string, unknown>>({});

  readonly form = signal<FormGroup>(this.fb.group({}));

  constructor() {
    // The calendar's month and weekday names follow the interface language.
    effect(() => this.dateAdapter.setLocale(this.translation.dateLocale()));

    // Rebuild whenever the schema or the seeded value changes.
    effect(() => {
      const schema = this.schema();
      const seed = this.value();
      this.form.set(this.buildForm(schema, seed));
    });
  }

  /** True when the operator has edited the form — drives the unsaved guard. */
  isDirty(): boolean {
    return this.form().dirty;
  }

  private buildForm(schema: FormSchema, seed: Record<string, unknown> | null): FormGroup {
    const controls: Record<string, unknown[]> = {};

    for (const section of schema.sections) {
      for (const field of section.fields) {
        if (field.type === 'divider' || field.type === 'heading') {
          continue;
        }
        const initial = seed?.[field.key] ?? field.defaultValue ?? this.emptyValue(field);
        controls[field.key] = [
          { value: initial, disabled: field.disabled ?? false },
          this.validatorsFor(field),
        ];
      }
    }

    const group = this.fb.group(controls, { validators: schema.validators ?? [] });
    this.currentValue.set(group.getRawValue());

    group.valueChanges.subscribe(() => {
      const raw = group.getRawValue();
      this.currentValue.set(raw);
      this.valueChanged.emit(raw);
    });

    return group;
  }

  private emptyValue(field: FormField): unknown {
    switch (field.type) {
      case 'checkbox':
      case 'toggle':
        return false;
      case 'multiselect':
        return [];
      case 'number':
      case 'currency':
      case 'percent':
      case 'slider':
        return null;
      default:
        return '';
    }
  }

  private validatorsFor(field: FormField): ReturnType<typeof Validators.required>[] {
    const validators = [...(field.validators ?? [])];

    if (field.required) {
      validators.push(Validators.required);
      if (['text', 'textarea', 'email', 'password'].includes(field.type)) {
        validators.push(AppValidators.notBlank());
      }
    }
    if (field.maxLength) {
      validators.push(Validators.maxLength(field.maxLength));
    }
    if (field.min !== undefined) {
      validators.push(AppValidators.min(field.min, field.label));
    }
    if (field.max !== undefined) {
      validators.push(AppValidators.max(field.max, field.label));
    }

    switch (field.type) {
      case 'email':
        validators.push(AppValidators.email());
        break;
      case 'phone':
        validators.push(AppValidators.laoPhone());
        break;
      case 'password':
        validators.push(Validators.minLength(VALIDATION_LIMITS.passwordMin), AppValidators.strongPassword());
        break;
      case 'percent':
        validators.push(AppValidators.percentage());
        break;
      case 'colour':
        validators.push(AppValidators.hexColour());
        break;
      default:
        break;
    }

    return validators;
  }

  // ------------------------------------------------------------------ template helpers

  protected control(key: string): AbstractControl | null {
    return this.form().get(key);
  }

  protected isVisible(field: FormField): boolean {
    return field.visibleWhen ? field.visibleWhen(this.currentValue()) : true;
  }

  protected showError(key: string): boolean {
    const control = this.control(key);
    return Boolean(control && control.invalid && (control.dirty || control.touched));
  }

  protected errorFor(key: string): string {
    return firstErrorMessage(this.control(key));
  }

  protected strength(key: string): { score: number; label: string; hints: string[] } {
    return AppValidators.passwordStrength(String(this.control(key)?.value ?? ''));
  }

  protected onFileSelected(key: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? [...input.files] : [];
    this.control(key)?.setValue(files.length === 1 ? files[0] : files);
    this.control(key)?.markAsDirty();
  }

  protected fileName(key: string): string {
    const value = this.control(key)?.value as File | File[] | null;
    if (!value) {
      return '';
    }
    return Array.isArray(value) ? `${value.length} file(s) selected` : value.name;
  }

  protected readonly sections = computed(() => this.schema().sections);

  protected submit(): void {
    const form = this.form();
    if (form.invalid) {
      form.markAllAsTouched();
      // Bring the first invalid control into view so the operator sees why.
      const firstInvalid = document.querySelector<HTMLElement>(
        '.ll-field--invalid input, .ll-field--invalid textarea',
      );
      firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInvalid?.focus();
      return;
    }
    this.formSubmit.emit(form.getRawValue());
  }

  protected reset(): void {
    this.form().reset(this.value() ?? {});
  }
}
