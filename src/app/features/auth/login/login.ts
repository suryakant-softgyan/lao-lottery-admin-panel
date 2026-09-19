import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '@core/authentication/auth.service';
import { DEMO_CREDENTIAL_HINTS } from '@core/authentication/demo-accounts.constants';
import { LoginResult } from '@core/enums';
import { ThemeService } from '@core/services/theme.service';
import { ToastService } from '@core/services/toast.service';
import { AutofocusDirective } from '@shared/directives/ui.directives';

/**
 * Sign-in screen.
 *
 * Handles the three outcomes the auth contract defines: success, MFA challenge
 * (which routes to the OTP screen) and rejection. "Remember me" controls token
 * persistence, and the demo credential panel exists only while the mock backend
 * is in use.
 */
@Component({
  selector: 'll-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    AutofocusDirective,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly theme = inject(ThemeService);

  protected readonly demoAccounts = DEMO_CREDENTIAL_HINTS;
  protected readonly branding = computed(() => this.theme.branding());

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly showDemoPanel = signal(false);

  private readonly queryParams = toSignal(this.route.queryParams, { initialValue: {} });

  /** Explains why the previous session ended, when the router says so. */
  protected readonly sessionNotice = computed(() => {
    const reason = (this.queryParams() as Record<string, string>)['reason'];
    switch (reason) {
      case 'expired':
        return 'Your session expired. Please sign in again.';
      case 'idle':
        return 'You were signed out after a period of inactivity.';
      case 'unauthorised':
        return 'Your session is no longer valid. Please sign in again.';
      default:
        return null;
    }
  });

  protected readonly form = this.fb.nonNullable.group({
    username: [this.auth.rememberedUsername(), [Validators.required]],
    password: ['', [Validators.required]],
    rememberMe: [Boolean(this.auth.rememberedUsername())],
  });

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  /** Fills the form from the demo panel so reviewers can switch roles fast. */
  protected useDemoAccount(username: string): void {
    this.form.patchValue({ username, password: 'Lottery@2026' });
    this.errorMessage.set(null);
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (response) => {
        this.submitting.set(false);

        if (response.result === LoginResult.MfaRequired) {
          void this.router.navigate(['/auth/verify'], {
            queryParams: { challenge: response.challengeId, target: response.challengeTarget },
          });
          return;
        }

        if (response.result === LoginResult.Success) {
          this.toast.success(`Welcome back, ${response.user?.fullName.split(' ')[0]}`);
          void this.router.navigateByUrl(this.auth.consumeRedirectUrl());
        }
      },
      error: (error: Error) => {
        this.submitting.set(false);
        this.errorMessage.set(error.message || 'Unable to sign in. Please try again.');
      },
    });
  }
}
