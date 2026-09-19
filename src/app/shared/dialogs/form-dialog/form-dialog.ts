import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

import { DynamicForm } from '../../components/dynamic-form/dynamic-form';
import type { FormSchema } from '../../components/dynamic-form/dynamic-form.model';

export interface FormDialogData {
  title: string;
  subtitle?: string;
  icon?: string;
  schema: FormSchema;
  value?: Record<string, unknown> | null;
  submitLabel?: string;
  /** Renders in a wider panel — used for multi-column schemas. */
  wide?: boolean;
}

/**
 * Generic create/edit dialog.
 *
 * Pairs the schema-driven {@link DynamicForm} with a standard dialog chrome, so
 * a feature module adds a create screen by declaring a schema — no bespoke
 * dialog component per entity.
 */
@Component({
  selector: 'll-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, DynamicForm],
  template: `
    <header class="form-dialog__header">
      <div class="form-dialog__title-row">
        @if (data.icon) {
          <span class="form-dialog__icon material-symbols-rounded" aria-hidden="true">{{ data.icon }}</span>
        }
        <div>
          <h2 class="form-dialog__title">{{ data.title }}</h2>
          @if (data.subtitle) {
            <p class="form-dialog__subtitle">{{ data.subtitle }}</p>
          }
        </div>
      </div>
      <button mat-icon-button type="button" aria-label="Close dialog" (click)="close()">
        <span class="material-symbols-rounded" aria-hidden="true">close</span>
      </button>
    </header>

    <mat-dialog-content class="form-dialog__content">
      <ll-dynamic-form
        [schema]="data.schema"
        [value]="data.value ?? null"
        [submitting]="submitting()"
        [submitLabel]="data.submitLabel ?? 'Save'"
        (formSubmit)="submit($event)"
        (cancelled)="close()" />
    </mat-dialog-content>
  `,
  styles: `
    :host {
      display: block;
    }

    .form-dialog {
      &__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        padding: 18px 20px 14px;
        border-bottom: 1px solid var(--ll-border);
      }

      &__title-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      &__icon {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 11px;
        background: var(--ll-primary-soft);
        color: var(--ll-primary);
        font-size: 21px;
      }

      &__title {
        margin: 0;
        font-size: 1.06rem;
        font-weight: 680;
        letter-spacing: -0.02em;
      }

      &__subtitle {
        margin: 2px 0 0;
        font-size: 0.79rem;
        color: var(--ll-text-muted);
      }

      &__content {
        padding: 20px !important;
        max-height: 72vh;
      }
    }
  `,
})
export class FormDialog {
  private readonly dialogRef = inject<MatDialogRef<FormDialog, Record<string, unknown> | null>>(MatDialogRef);
  protected readonly data = inject<FormDialogData>(MAT_DIALOG_DATA);

  protected readonly submitting = signal(false);

  protected submit(value: Record<string, unknown>): void {
    this.submitting.set(true);
    // The caller owns persistence; closing with the payload hands it back.
    this.dialogRef.close(value);
  }

  protected close(): void {
    this.dialogRef.close(null);
  }
}
