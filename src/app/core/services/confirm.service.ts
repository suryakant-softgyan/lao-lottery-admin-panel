import { Injectable, inject } from '@angular/core';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { Observable, from, of, switchMap } from 'rxjs';

export type ConfirmTone = 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Extra detail rendered under the message, e.g. the affected record. */
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: string;
  /** Requires the operator to type this word before confirming. */
  requireTypedConfirmation?: string;
  /** Shows a mandatory reason box; the reason is returned on confirmation. */
  requireReason?: boolean;
  reasonLabel?: string;
}

export interface ConfirmResult {
  confirmed: boolean;
  reason?: string;
}

/**
 * Application-wide confirmation prompts.
 *
 * The dialog component is loaded with a dynamic `import()` so that `core` keeps
 * no static dependency on `shared` — the layering stays one-directional while
 * guards and services can still raise a dialog.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  /** Resolves to true when the operator confirms. */
  ask(options: ConfirmOptions): Observable<boolean> {
    return this.open(options).pipe(switchMap((result) => of(result.confirmed)));
  }

  /** Full result, including the typed reason when one was requested. */
  open(options: ConfirmOptions): Observable<ConfirmResult> {
    const loaded = import('@shared/dialogs/confirm-dialog/confirm-dialog').then(({ ConfirmDialog }) => {
      const reference: MatDialogRef<unknown, ConfirmResult> = this.dialog.open(ConfirmDialog, {
        data: options,
        width: '480px',
        maxWidth: '94vw',
        autoFocus: options.requireTypedConfirmation || options.requireReason ? 'first-tabbable' : 'dialog',
        restoreFocus: true,
        panelClass: 'll-dialog-panel',
      });
      return reference.afterClosed();
    });

    return from(loaded).pipe(
      switchMap((afterClosed) => afterClosed),
      switchMap((result) => of(result ?? { confirmed: false })),
    );
  }

  /** Shorthand for destructive actions. */
  confirmDelete(entity: string, name?: string): Observable<boolean> {
    return this.ask({
      title: `Delete ${entity}?`,
      message: `This will permanently remove ${name ? `“${name}”` : `the selected ${entity}`}.`,
      detail: 'This action is recorded in the audit trail and cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
      icon: 'delete_forever',
    });
  }

  /** Shorthand for approvals, which capture an optional remark. */
  confirmApproval(entity: string, name?: string): Observable<ConfirmResult> {
    return this.open({
      title: `Approve ${entity}?`,
      message: `${name ? `“${name}”` : `The selected ${entity}`} will be approved and activated immediately.`,
      confirmLabel: 'Approve',
      cancelLabel: 'Cancel',
      tone: 'success',
      icon: 'verified',
      requireReason: true,
      reasonLabel: 'Approval remarks (optional)',
    });
  }

  /** Shorthand for rejections, which require a reason for the audit trail. */
  confirmRejection(entity: string, name?: string): Observable<ConfirmResult> {
    return this.open({
      title: `Reject ${entity}?`,
      message: `${name ? `“${name}”` : `The selected ${entity}`} will be rejected and the requester notified.`,
      confirmLabel: 'Reject',
      cancelLabel: 'Cancel',
      tone: 'danger',
      icon: 'block',
      requireReason: true,
      reasonLabel: 'Reason for rejection',
    });
  }
}
