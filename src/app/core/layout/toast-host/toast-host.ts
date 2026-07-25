import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { ToastService, type Toast } from '@core/services/toast.service';

/**
 * Floating toast stack.
 *
 * Rendered once by the shell; anything in the application raises feedback
 * through {@link ToastService} without needing a UI reference.
 */
@Component({
  selector: 'll-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule],
  template: `
    <div class="toast-host ll-no-print" role="region" aria-label="Notifications" aria-live="polite">
      @for (toast of toasts(); track toast.id) {
        <div class="toast" [class]="'toast toast--' + toast.tone" role="alert">
          <span class="toast__icon material-symbols-rounded" aria-hidden="true">{{ toast.icon }}</span>

          <div class="toast__body">
            <p class="toast__title">{{ toast.title }}</p>
            @if (toast.message) {
              <p class="toast__message">{{ toast.message }}</p>
            }
          </div>

          @if (toast.action; as action) {
            <button mat-button type="button" class="toast__action" (click)="run(toast, action.run)">
              {{ action.label }}
            </button>
          }

          <button
            type="button"
            class="toast__close"
            aria-label="Dismiss notification"
            (click)="dismiss(toast.id)">
            <span class="material-symbols-rounded" aria-hidden="true">close</span>
          </button>

          @if (toast.duration > 0) {
            <span class="toast__timer" [style.animation-duration.ms]="toast.duration"></span>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './toast-host.scss',
})
export class ToastHost {
  private readonly toastService = inject(ToastService);

  protected readonly toasts = this.toastService.toasts;

  protected dismiss(id: string): void {
    this.toastService.dismiss(id);
  }

  protected run(toast: Toast, action: () => void): void {
    action();
    this.toastService.dismiss(toast.id);
  }
}
