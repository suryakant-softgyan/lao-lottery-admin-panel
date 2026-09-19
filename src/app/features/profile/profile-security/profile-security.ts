import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { AuthService } from '@core/authentication/auth.service';
import { VALIDATION_LIMITS } from '@core/constants/app.constants';
import { mockDataset } from '@core/mock/dataset';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import type { DeviceHistoryEntry } from '@core/models';
import { ConfirmService } from '@core/services/confirm.service';
import { ToastService } from '@core/services/toast.service';
import { PageHeader } from '@shared/components/page-header/page-header';
import { AppValidators } from '@shared/validators/app.validators';
import { RelativePipe } from '@shared/pipes/format.pipes';

/** Password change, two-factor and trusted-device management. */
@Component({
  selector: 'll-profile-security',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    PageHeader,
    RelativePipe,
  ],
  templateUrl: './profile-security.html',
  styleUrl: './profile-security.scss',
})
export class ProfileSecurity {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly minLength = VALIDATION_LIMITS.passwordMin;
  protected readonly submitting = signal(false);
  protected readonly showPasswords = signal(false);

  protected readonly user = computed(() => this.auth.user());

  protected readonly devices = signal<DeviceHistoryEntry[]>(
    environment.useMockData ? mockDataset.deviceHistory(this.auth.user()?.id ?? 'me') : [],
  );

  private readonly liveDevices = environment.useMockData
    ? null
    : inject(HttpClient)
        .get<Record<string, unknown>[]>(`${environment.apiBaseUrl}/me/devices`)
        .subscribe((rows) =>
          this.devices.set(
            rows.map((row) => ({
              id: String(row['id']),
              deviceId: String(row['deviceId']),
              deviceName: `${String(row['deviceName'] ?? row['deviceId'])}${row['current'] ? ' (this device)' : ''}`,
              deviceType: (row['deviceType'] ?? 'WEB') as DeviceHistoryEntry['deviceType'],
              os: String(row['os'] ?? '—'),
              appVersion: (row['appVersion'] as string | undefined) ?? undefined,
              firstSeenAt: String(row['firstSeenAt']),
              lastSeenAt: String(row['lastSeenAt']),
              trusted: Boolean(row['trusted']),
              active: Boolean(row['active']),
            })),
          ),
        );

  protected readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(VALIDATION_LIMITS.passwordMin),
          AppValidators.strongPassword(),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [AppValidators.matchFields('newPassword', 'confirmPassword')] },
  );

  private readonly newPassword = signal('');

  protected readonly strength = computed(() => AppValidators.passwordStrength(this.newPassword()));

  constructor() {
    this.form.controls.newPassword.valueChanges.subscribe((value) => this.newPassword.set(value));
  }

  protected toggleVisibility(): void {
    this.showPasswords.update((visible) => !visible);
  }

  protected changePassword(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.auth.changePassword(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.form.reset();
        this.newPassword.set('');
        this.toast.success('Password changed', 'Use your new password the next time you sign in.');
      },
      error: () => {
        this.submitting.set(false);
        this.toast.error('Change failed', 'Your current password was not accepted.');
      },
    });
  }

  protected toggleTwoFactor(enabled: boolean): void {
    if (!enabled) {
      this.confirm
        .ask({
          title: 'Disable two-factor authentication?',
          message:
            'Your account will be protected by a password alone. Two-factor authentication is strongly recommended for administrative roles.',
          confirmLabel: 'Disable two-factor',
          tone: 'danger',
          icon: 'gpp_maybe',
        })
        .subscribe((confirmed) => {
          if (confirmed) {
            this.auth.patchUser({ twoFactorEnabled: false });
            this.toast.warning('Two-factor authentication disabled');
          }
        });
      return;
    }

    this.auth.patchUser({ twoFactorEnabled: true });
    this.toast.success('Two-factor authentication enabled', 'A code will be required at each sign-in.');
  }

  protected revokeDevice(device: DeviceHistoryEntry): void {
    this.confirm
      .ask({
        title: `Revoke access for ${device.deviceName}?`,
        message: 'The device will be signed out and must authenticate again from scratch.',
        confirmLabel: 'Revoke device',
        tone: 'warning',
        icon: 'phonelink_erase',
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.devices.update((current) => current.filter((item) => item.id !== device.id));
          this.toast.success('Device revoked', device.deviceName);
        }
      });
  }

  protected signOutEverywhere(): void {
    this.confirm
      .ask({
        title: 'Sign out of every device?',
        message: 'All sessions, including this one, will end immediately.',
        confirmLabel: 'Sign out everywhere',
        tone: 'danger',
        icon: 'logout',
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.auth.logout('manual');
        }
      });
  }

  protected onHeaderAction(action: string): void {
    if (action === 'back') {
      void this.router.navigate(['/profile']);
    }
  }
}
