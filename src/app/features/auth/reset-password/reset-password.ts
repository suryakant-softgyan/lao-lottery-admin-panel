import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from '@core/authentication/auth.service';
import { VALIDATION_LIMITS } from '@core/constants/app.constants';
import { ToastService } from '@core/services/toast.service';
import { AppValidators } from '@shared/validators/app.validators';
import { AutofocusDirective } from '@shared/directives/ui.directives';

/** Sets a new password from a reset link, with a live strength meter. */
@Component({
  selector: 'll-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    AutofocusDirective,
  ],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly minLength = VALIDATION_LIMITS.passwordMin;

  private readonly params = toSignal(this.route.queryParams, { initialValue: {} });

  protected readonly token = computed(
    () => (this.params() as Record<string, string>)['token'] ?? 'demo-reset-token',
  );

  protected readonly form = this.fb.nonNullable.group(
    {
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(VALIDATION_LIMITS.passwordMin),
          AppValidators.strongPassword(),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [AppValidators.matchFields('password', 'confirmPassword')] },
  );

  protected readonly strength = computed(() => AppValidators.passwordStrength(this.passwordValue()));

  /** Mirrors the control value into a signal so the meter stays reactive. */
  private readonly passwordSignal = signal('');

  protected passwordValue(): string {
    return this.passwordSignal();
  }

  constructor() {
    this.form.controls.password.valueChanges.subscribe((value) => this.passwordSignal.set(value));
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.auth
      .resetPassword({
        token: this.token(),
        password: this.form.controls.password.value,
        confirmPassword: this.form.controls.confirmPassword.value,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.toast.success('Password updated', 'You can now sign in with your new password.');
          void this.router.navigate(['/auth/login']);
        },
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set('This reset link is no longer valid. Please request a new one.');
        },
      });
  }
}
