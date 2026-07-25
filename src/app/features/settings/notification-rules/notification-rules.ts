import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { StorageService } from '@core/services/storage.service';
import { ToastService } from '@core/services/toast.service';
import { DynamicForm } from '@shared/components/dynamic-form/dynamic-form';
import type { FormSchema } from '@shared/components/dynamic-form/dynamic-form.model';
import { PageHeader } from '@shared/components/page-header/page-header';
import { AppValidators } from '@shared/validators/app.validators';

interface NotificationConfiguration {
  smsProvider: string;
  smsSenderId: string;
  smsEnabled: boolean;
  emailFromName: string;
  emailFromAddress: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  pushProvider: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  respectQuietHours: boolean;
  retryAttempts: number;
  retryDelayMinutes: number;
  dailySendCap: number;
  alertOnFailedPayments: boolean;
  alertOnDrawVerification: boolean;
  alertOnLargePayout: boolean;
  largePayoutThreshold: number;
}

const CONFIG_KEY = 'settings.notifications';

/** Delivery-channel configuration and operational alert triggers. */
@Component({
  selector: 'll-notification-rules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, DynamicForm],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="Notification Rules"
        eyebrow="Settings"
        subtitle="Delivery providers, quiet hours, retry policy and the operational events that raise an alert."
        icon="edit_notifications"
        [compact]="true" />

      <div class="ll-card">
        <div class="ll-card__body">
          <ll-dynamic-form
            [schema]="schema"
            [value]="model()"
            [submitting]="saving()"
            submitLabel="Save notification rules"
            cancelLabel="Reset"
            (formSubmit)="save($event)"
            (cancelled)="reset()" />
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class NotificationRules {
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);

  protected readonly saving = signal(false);

  private readonly defaults: NotificationConfiguration = {
    smsProvider: 'UNITEL',
    smsSenderId: 'LAOLOTTERY',
    smsEnabled: true,
    emailFromName: 'Lao National Lottery',
    emailFromAddress: 'noreply@laolottery.la',
    emailEnabled: true,
    pushEnabled: true,
    pushProvider: 'FIREBASE',
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    respectQuietHours: true,
    retryAttempts: 3,
    retryDelayMinutes: 5,
    dailySendCap: 200_000,
    alertOnFailedPayments: true,
    alertOnDrawVerification: true,
    alertOnLargePayout: true,
    largePayoutThreshold: 500_000_000,
  };

  private readonly stored = signal<NotificationConfiguration>(
    this.storage.get<NotificationConfiguration>(CONFIG_KEY, this.defaults),
  );

  protected readonly model = computed<Record<string, unknown>>(
    () => ({ ...this.stored() }) as unknown as Record<string, unknown>,
  );

  protected readonly schema: FormSchema = {
    sections: [
      {
        id: 'sms',
        title: 'SMS',
        icon: 'sms',
        fields: [
          { key: 'smsEnabled', label: 'SMS delivery enabled', type: 'toggle', span: 12 },
          {
            key: 'smsProvider',
            label: 'Provider',
            type: 'select',
            span: 6,
            options: [
              { value: 'UNITEL', label: 'Unitel' },
              { value: 'LTC', label: 'Lao Telecom' },
              { value: 'ETL', label: 'ETL' },
              { value: 'TWILIO', label: 'Twilio' },
            ],
            visibleWhen: (value) => Boolean(value['smsEnabled']),
          },
          {
            key: 'smsSenderId',
            label: 'Sender ID',
            type: 'text',
            span: 6,
            maxLength: 11,
            hint: 'Maximum 11 characters, as registered with the operator',
            visibleWhen: (value) => Boolean(value['smsEnabled']),
          },
        ],
      },
      {
        id: 'email',
        title: 'Email',
        icon: 'mail',
        fields: [
          { key: 'emailEnabled', label: 'Email delivery enabled', type: 'toggle', span: 12 },
          {
            key: 'emailFromName',
            label: 'From name',
            type: 'text',
            span: 6,
            visibleWhen: (value) => Boolean(value['emailEnabled']),
          },
          {
            key: 'emailFromAddress',
            label: 'From address',
            type: 'email',
            span: 6,
            validators: [AppValidators.email()],
            visibleWhen: (value) => Boolean(value['emailEnabled']),
          },
        ],
      },
      {
        id: 'push',
        title: 'Push notifications',
        icon: 'notifications_active',
        fields: [
          { key: 'pushEnabled', label: 'Push delivery enabled', type: 'toggle', span: 12 },
          {
            key: 'pushProvider',
            label: 'Provider',
            type: 'select',
            span: 6,
            options: [
              { value: 'FIREBASE', label: 'Firebase Cloud Messaging' },
              { value: 'ONESIGNAL', label: 'OneSignal' },
              { value: 'APNS', label: 'Apple Push Notification service' },
            ],
            visibleWhen: (value) => Boolean(value['pushEnabled']),
          },
        ],
      },
      {
        id: 'policy',
        title: 'Delivery policy',
        description:
          'Quiet hours and retry behaviour apply to marketing messages only — security and transactional messages always send.',
        icon: 'policy',
        fields: [
          { key: 'respectQuietHours', label: 'Respect quiet hours', type: 'toggle', span: 12 },
          {
            key: 'quietHoursStart',
            label: 'Quiet hours start',
            type: 'time',
            span: 6,
            visibleWhen: (value) => Boolean(value['respectQuietHours']),
          },
          {
            key: 'quietHoursEnd',
            label: 'Quiet hours end',
            type: 'time',
            span: 6,
            visibleWhen: (value) => Boolean(value['respectQuietHours']),
          },
          { key: 'retryAttempts', label: 'Retry attempts', type: 'number', span: 4, min: 0, max: 10 },
          {
            key: 'retryDelayMinutes',
            label: 'Retry delay',
            type: 'number',
            span: 4,
            min: 1,
            max: 60,
            suffix: 'min',
          },
          {
            key: 'dailySendCap',
            label: 'Daily send cap',
            type: 'number',
            span: 4,
            min: 0,
            hint: 'Across all channels',
          },
        ],
      },
      {
        id: 'alerts',
        title: 'Operational alerts',
        description: 'Events that raise a notification for the operations team.',
        icon: 'crisis_alert',
        fields: [
          {
            key: 'alertOnFailedPayments',
            label: 'Alert on failed payment batches',
            type: 'toggle',
            span: 12,
          },
          {
            key: 'alertOnDrawVerification',
            label: 'Alert when a draw is awaiting verification',
            type: 'toggle',
            span: 12,
          },
          { key: 'alertOnLargePayout', label: 'Alert on large prize payouts', type: 'toggle', span: 12 },
          {
            key: 'largePayoutThreshold',
            label: 'Large payout threshold',
            type: 'currency',
            span: 6,
            min: 0,
            prefix: '₭',
            visibleWhen: (value) => Boolean(value['alertOnLargePayout']),
          },
        ],
      },
    ],
  };

  protected save(value: Record<string, unknown>): void {
    this.saving.set(true);
    const configuration = value as unknown as NotificationConfiguration;
    this.stored.set(configuration);
    this.storage.set(CONFIG_KEY, configuration);
    this.saving.set(false);
    this.toast.success('Notification rules saved');
  }

  protected reset(): void {
    this.stored.set(this.defaults);
    this.storage.set(CONFIG_KEY, this.defaults);
    this.toast.info('Notification rules reset to defaults');
  }
}
