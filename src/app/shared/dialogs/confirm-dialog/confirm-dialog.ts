import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import type { ConfirmOptions, ConfirmResult } from '@core/services/confirm.service';
import { AutofocusDirective } from '../../directives/ui.directives';

const TONE_ICON: Record<string, string> = {
  primary: 'help',
  success: 'check_circle',
  warning: 'warning',
  danger: 'report',
  info: 'info',
};

/**
 * Confirmation dialog used for every destructive or irreversible action.
 *
 * Two escalations are supported for high-risk operations:
 *  - `requireTypedConfirmation` forces the operator to type a word (used for
 *    draw rollbacks and wallet adjustments);
 *  - `requireReason` captures a mandatory justification that the caller writes
 *    into the audit trail.
 */
@Component({
  selector: 'll-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    AutofocusDirective,
  ],
  template: `
    <div class="confirm" [style.--tone]="'var(--ll-' + tone() + ')'">
      <div class="confirm__icon">
        <span class="material-symbols-rounded" aria-hidden="true">{{ icon() }}</span>
      </div>

      <h2 mat-dialog-title class="confirm__title">{{ data.title }}</h2>

      <mat-dialog-content class="confirm__content">
        <p class="confirm__message">{{ data.message }}</p>

        @if (data.detail; as detail) {
          <p class="confirm__detail">
            <span class="material-symbols-rounded" aria-hidden="true">info</span>
            {{ detail }}
          </p>
        }

        @if (data.requireTypedConfirmation; as phrase) {
          <p class="confirm__prompt">
            Type <code>{{ phrase }}</code> to continue.
          </p>
          <mat-form-field appearance="outline" class="ll-dense-field">
            <mat-label>Confirmation</mat-label>
            <input matInput llAutofocus [(ngModel)]="typed" [placeholder]="phrase" autocomplete="off" />
          </mat-form-field>
        }

        @if (data.requireReason) {
          <mat-form-field appearance="outline">
            <mat-label>{{ data.reasonLabel ?? 'Reason' }}</mat-label>
            <textarea
              matInput
              rows="3"
              llAutofocus
              [(ngModel)]="reason"
              placeholder="Recorded in the audit trail"></textarea>
          </mat-form-field>
        }
      </mat-dialog-content>

      <mat-dialog-actions class="confirm__actions">
        <button mat-button type="button" (click)="cancel()">
          {{ data.cancelLabel ?? 'Cancel' }}
        </button>
        <button
          mat-flat-button
          type="button"
          class="confirm__accept"
          [disabled]="!canConfirm()"
          (click)="accept()">
          {{ data.confirmLabel ?? 'Confirm' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: `
    .confirm {
      display: block;
      padding: 8px 4px 0;

      &__icon {
        display: grid;
        place-items: center;
        width: 52px;
        height: 52px;
        margin: 12px auto 6px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--tone) 14%, transparent);
        color: var(--tone);

        .material-symbols-rounded {
          font-size: 27px;
          width: 27px;
          height: 27px;
        }
      }

      &__title {
        text-align: center;
        font-size: 1.08rem !important;
        font-weight: 680 !important;
        padding-bottom: 4px !important;
      }

      &__content {
        padding-top: 4px !important;
      }

      &__message {
        margin: 0;
        text-align: center;
        color: var(--ll-text-secondary);
        font-size: 0.88rem;
        line-height: 1.62;
      }

      &__detail {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin: 14px 0 0;
        padding: 10px 12px;
        border-radius: var(--ll-radius-sm);
        background: color-mix(in srgb, var(--tone) 9%, transparent);
        border: 1px solid color-mix(in srgb, var(--tone) 24%, transparent);
        color: var(--ll-text-secondary);
        font-size: 0.79rem;
        line-height: 1.55;

        .material-symbols-rounded {
          font-size: 17px;
          width: 17px;
          height: 17px;
          color: var(--tone);
          flex: 0 0 auto;
          margin-top: 1px;
        }
      }

      &__prompt {
        margin: 16px 0 8px;
        font-size: 0.82rem;
        color: var(--ll-text-secondary);

        code {
          padding: 2px 7px;
          border-radius: 5px;
          background: var(--ll-surface-hover);
          font-family: ui-monospace, monospace;
          font-weight: 700;
          color: var(--tone);
        }
      }

      &__actions {
        justify-content: flex-end !important;
        gap: 8px;
        padding: 8px 0 12px !important;
      }

      &__accept {
        --mdc-filled-button-container-color: var(--tone);
        --mdc-filled-button-label-text-color: #fff;
        min-width: 118px;
      }
    }
  `,
})
export class ConfirmDialog {
  private readonly dialogRef = inject<MatDialogRef<ConfirmDialog, ConfirmResult>>(MatDialogRef);
  protected readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA);

  protected readonly typed = signal('');
  protected readonly reason = signal('');

  protected readonly tone = computed(() => this.data.tone ?? 'primary');
  protected readonly icon = computed(() => this.data.icon ?? TONE_ICON[this.tone()] ?? 'help');

  protected readonly canConfirm = computed(() => {
    const phrase = this.data.requireTypedConfirmation;
    if (phrase && this.typed().trim().toLowerCase() !== phrase.toLowerCase()) {
      return false;
    }
    if (this.data.requireReason && this.data.reasonLabel?.toLowerCase().includes('optional') !== true) {
      return this.reason().trim().length > 0;
    }
    return true;
  });

  protected accept(): void {
    this.dialogRef.close({ confirmed: true, reason: this.reason().trim() || undefined });
  }

  protected cancel(): void {
    this.dialogRef.close({ confirmed: false });
  }
}
