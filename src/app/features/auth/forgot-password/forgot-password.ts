import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from '@core/authentication/auth.service';
import { AutofocusDirective } from '@shared/directives/ui.directives';

/**
 * Password reset request.
 *
 * The response is intentionally identical whether or not the account exists —
 * disclosing which usernames are valid would be an account-enumeration hole.
 */
@Component({
  selector: 'll-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    AutofocusDirective,
  ],
  template: `
    <div class="forgot">
      @if (sentTo(); as target) {
        <div class="forgot__done">
          <span class="forgot__icon forgot__icon--success material-symbols-rounded" aria-hidden="true">
            mark_email_read
          </span>
          <h1 class="forgot__title">Check your inbox</h1>
          <p class="forgot__subtitle">
            If an account matches what you entered, reset instructions have been sent to
            <strong>{{ target }}</strong
            >.
          </p>
          <p class="forgot__note">The link is valid for 30 minutes. Remember to check your spam folder.</p>
          <a mat-flat-button routerLink="/auth/login" class="forgot__submit">Back to sign in</a>
          <button type="button" class="forgot__resend" (click)="reset()">Use a different account</button>
        </div>
      } @else {
        <header class="forgot__header">
          <span class="forgot__icon material-symbols-rounded" aria-hidden="true">lock_reset</span>
          <h1 class="forgot__title">Reset your password</h1>
          <p class="forgot__subtitle">
            Enter your username or email address and we will send you a reset link.
          </p>
        </header>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field appearance="outline">
            <mat-label>Username or email</mat-label>
            <input matInput llAutofocus formControlName="identifier" autocomplete="username" />
            <span matPrefix class="material-symbols-rounded forgot__affix" aria-hidden="true">person</span>
            @if (form.controls.identifier.touched && form.controls.identifier.invalid) {
              <mat-error>Enter your username or email address.</mat-error>
            }
          </mat-form-field>

          <div class="forgot__channel">
            <span class="forgot__channel-label">Send the link by</span>
            <mat-button-toggle-group formControlName="channel" aria-label="Delivery channel">
              <mat-button-toggle value="EMAIL">
                <span class="material-symbols-rounded" aria-hidden="true">mail</span>
                Email
              </mat-button-toggle>
              <mat-button-toggle value="SMS">
                <span class="material-symbols-rounded" aria-hidden="true">sms</span>
                SMS
              </mat-button-toggle>
            </mat-button-toggle-group>
          </div>

          <button mat-flat-button type="submit" class="forgot__submit" [disabled]="submitting()">
            @if (submitting()) {
              <span class="material-symbols-rounded ll-spin" aria-hidden="true">progress_activity</span>
              Sending…
            } @else {
              Send reset link
            }
          </button>
        </form>

        <a routerLink="/auth/login" class="forgot__back">
          <span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
          Back to sign in
        </a>
      }
    </div>
  `,
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly submitting = signal(false);
  protected readonly sentTo = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    identifier: ['', [Validators.required]],
    channel: ['EMAIL' as 'EMAIL' | 'SMS', [Validators.required]],
  });

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.auth.forgotPassword(this.form.getRawValue()).subscribe({
      next: (response) => {
        this.submitting.set(false);
        this.sentTo.set(response.target);
      },
      error: () => {
        this.submitting.set(false);
        // Even on failure we do not reveal whether the account exists.
        this.sentTo.set(this.form.controls.identifier.value);
      },
    });
  }

  protected reset(): void {
    this.sentTo.set(null);
    this.form.reset({ identifier: '', channel: 'EMAIL' });
  }
}
