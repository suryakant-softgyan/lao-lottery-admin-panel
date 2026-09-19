import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { Observable, of } from 'rxjs';

import { ConfirmService } from '../services/confirm.service';

/** Implemented by any component that owns a dirty form. */
export interface HasUnsavedChanges {
  /** Return true when it is safe to leave. */
  hasUnsavedChanges(): boolean;
}

/**
 * Prompts before discarding an edited form. Components opt in by implementing
 * {@link HasUnsavedChanges} and attaching `canDeactivate: [unsavedChangesGuard]`.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (
  component,
): Observable<boolean> | boolean => {
  if (!component?.hasUnsavedChanges?.()) {
    return true;
  }

  const confirm = inject(ConfirmService);
  return (
    confirm.ask({
      title: 'Discard unsaved changes?',
      message: 'You have edits that have not been saved. Leaving this page will discard them.',
      confirmLabel: 'Discard changes',
      cancelLabel: 'Stay on page',
      tone: 'warning',
      icon: 'edit_off',
    }) ?? of(true)
  );
};
