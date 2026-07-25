import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from '@core/authentication/auth.service';
import { PermissionService } from '@core/authentication/permission.service';
import { PERMISSIONS } from '@core/constants/permission.constants';
import {
  CLAIM_STATUS_MAP,
  TICKET_CHANNEL_MAP,
  TICKET_STATUS_MAP,
} from '@core/constants/status-maps.constants';
import { ConfirmService } from '@core/services/confirm.service';
import { ToastService } from '@core/services/toast.service';
import { PageHeader } from '@shared/components/page-header/page-header';
import { StatusBadge } from '@shared/components/status-badge/status-badge';
import { AutofocusDirective } from '@shared/directives/ui.directives';
import { CurrencyPipe, DatePipe } from '@shared/pipes/format.pipes';
import { TicketRepository, type ValidationResult } from '../data/ticket.repository';

/**
 * Counter validation terminal.
 *
 * Scan or key a ticket and get an unambiguous verdict: payable, with the exact
 * net amount, or not payable with the reason. The scanner is a placeholder for
 * the camera/hardware integration; the keyed path is fully functional.
 */
@Component({
  selector: 'll-ticket-validate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    PageHeader,
    StatusBadge,
    AutofocusDirective,
    CurrencyPipe,
    DatePipe,
  ],
  templateUrl: './ticket-validate.html',
  styleUrl: './ticket-validate.scss',
})
export class TicketValidate {
  private readonly repository = inject(TicketRepository);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  protected readonly permissions = inject(PermissionService);

  protected readonly PERMISSIONS = PERMISSIONS;
  protected readonly statusMap = TICKET_STATUS_MAP;
  protected readonly claimMap = CLAIM_STATUS_MAP;
  protected readonly channelMap = TICKET_CHANNEL_MAP;

  protected readonly code = signal('');
  protected readonly checking = signal(false);
  protected readonly paying = signal(false);
  protected readonly result = signal<ValidationResult | null>(null);

  /** Recently checked codes, so a busy counter can re-check quickly. */
  protected readonly history = signal<{ code: string; payable: boolean; at: number }[]>([]);

  protected validate(): void {
    const value = this.code().trim();
    if (!value || this.checking()) {
      return;
    }

    this.checking.set(true);
    this.repository.validate(value).subscribe({
      next: (result) => {
        this.checking.set(false);
        this.result.set(result);
        this.history.update((current) =>
          [{ code: value, payable: result.payable, at: Date.now() }, ...current].slice(0, 6),
        );
      },
      error: () => {
        this.checking.set(false);
        this.toast.error('Validation failed', 'The ticket could not be checked. Try again.');
      },
    });
  }

  protected reset(): void {
    this.code.set('');
    this.result.set(null);
  }

  protected recheck(code: string): void {
    this.code.set(code);
    this.validate();
  }

  /** Placeholder for the camera/scanner hardware integration. */
  protected scan(): void {
    this.toast.info(
      'Scanner not connected',
      'Connect a QR or barcode scanner, or key the ticket number manually.',
    );
  }

  protected payout(): void {
    const result = this.result();
    const ticket = result?.ticket;
    if (!ticket || !result?.payable) {
      return;
    }

    this.confirm
      .ask({
        title: 'Pay this prize?',
        message: `${ticket.customerName} will be paid ${result.netPayout.toLocaleString()} ₭.`,
        detail: `Gross ${result.grossPayout.toLocaleString()} ₭ less ${result.tax.toLocaleString()} ₭ tax. Verify the claimant's identity before paying.`,
        confirmLabel: 'Confirm payout',
        tone: 'success',
        icon: 'paid',
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.paying.set(true);
        this.repository.payout(ticket.id, this.auth.user()?.fullName ?? 'Counter').subscribe({
          next: () => {
            this.paying.set(false);
            this.toast.success('Prize paid', ticket.ticketNumber);
            this.validate();
          },
          error: () => {
            this.paying.set(false);
            this.toast.error('Payout failed', 'The prize could not be paid. Try again.');
          },
        });
      });
  }

  protected openTicket(): void {
    const ticket = this.result()?.ticket;
    if (ticket) {
      void this.router.navigate(['/tickets/details', ticket.id]);
    }
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/tickets']);
    }
  }
}
