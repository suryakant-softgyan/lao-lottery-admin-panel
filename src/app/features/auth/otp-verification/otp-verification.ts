import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from '@core/authentication/auth.service';
import { VALIDATION_LIMITS } from '@core/constants/app.constants';
import { environment } from '@env/environment';
import { ToastService } from '@core/services/toast.service';
import { AppValidators } from '@shared/validators/app.validators';
import { AutofocusDirective, NumericOnlyDirective } from '@shared/directives/ui.directives';

const RESEND_COOLDOWN_SECONDS = 45;

/**
 * Two-factor verification step.
 *
 * Reached only when the login response returns `MFA_REQUIRED`. The code is
 * entered as six single-character boxes, which is faster to key on a phone and
 * makes a mistyped digit obvious.
 */
@Component({
  selector: 'll-otp-verification',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    AutofocusDirective,
    NumericOnlyDirective,
  ],
  templateUrl: './otp-verification.html',
  styleUrl: './otp-verification.scss',
})
export class OtpVerification {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly codeLength = VALIDATION_LIMITS.otpLength;
  protected readonly boxes = Array.from({ length: VALIDATION_LIMITS.otpLength }, (_, index) => index);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly cooldown = signal(RESEND_COOLDOWN_SECONDS);

  /** The generated code, surfaced only because there is no SMS gateway here. */
  protected readonly demoCode = this.auth.demoOtp;
  protected readonly isMock = environment.useMockData;

  private readonly params = toSignal(this.route.queryParams, { initialValue: {} });

  protected readonly challengeId = computed(
    () => (this.params() as Record<string, string>)['challenge'] ?? '',
  );

  protected readonly target = computed(
    () => (this.params() as Record<string, string>)['target'] ?? 'your registered device',
  );

  protected readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, AppValidators.otp()]],
  });

  protected readonly digits = computed(() => {
    const value = this.form.controls.code.value;
    return this.boxes.map((index) => value.charAt(index) ?? '');
  });

  constructor() {
    // No challenge means the operator deep-linked here; send them back.
    if (!this.challengeId()) {
      void this.router.navigate(['/auth/login']);
    }

    const ticker = setInterval(() => {
      this.cooldown.update((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(ticker));
  }

  /** Keeps the boxed display in step with the single underlying control. */
  protected onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = input.value.replace(/\D/g, '').slice(0, this.codeLength);
    this.form.controls.code.setValue(cleaned);
    this.errorMessage.set(null);

    if (cleaned.length === this.codeLength) {
      this.submit();
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text') ?? '';
    const cleaned = pasted.replace(/\D/g, '').slice(0, this.codeLength);
    if (cleaned) {
      event.preventDefault();
      this.form.controls.code.setValue(cleaned);
      if (cleaned.length === this.codeLength) {
        this.submit();
      }
    }
  }

  protected resend(): void {
    if (this.cooldown() > 0) {
      return;
    }
    this.auth.resendOtp().subscribe({
      next: () => {
        this.cooldown.set(RESEND_COOLDOWN_SECONDS);
        this.toast.info('Verification code sent', `A new code is on its way to ${this.target()}.`);
      },
      error: () => this.errorMessage.set('The code could not be resent. Please sign in again.'),
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.auth.verifyOtp({ challengeId: this.challengeId(), code: this.form.controls.code.value }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Verification successful');
        void this.router.navigateByUrl(this.auth.consumeRedirectUrl());
      },
      error: (error: Error) => {
        this.submitting.set(false);
        this.form.controls.code.setValue('');
        this.errorMessage.set(error.message || 'The verification code is incorrect.');
      },
    });
  }
}
