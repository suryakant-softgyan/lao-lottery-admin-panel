import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { LANGUAGES, STORAGE_KEYS } from '@core/constants/app.constants';
import { environment } from '@env/environment';
import { StorageService } from '@core/services/storage.service';
import { ToastService } from '@core/services/toast.service';
import { TranslationService } from '@core/services/translation.service';
import { DynamicForm } from '@shared/components/dynamic-form/dynamic-form';
import type { FormSchema } from '@shared/components/dynamic-form/dynamic-form.model';
import { PageHeader } from '@shared/components/page-header/page-header';

/** Platform-level settings: identity, session policy, locale and operations. */
interface GeneralConfiguration {
  tenantId: string;
  defaultLanguage: string;
  sessionTimeoutMinutes: number;
  idleTimeoutMinutes: number;
  passwordExpiryDays: number;
  maxLoginAttempts: number;
  enforceTwoFactor: boolean;
  allowConcurrentSessions: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  supportHours: string;
  dataRetentionMonths: number;
}

const CONFIG_KEY = 'settings.general';

/**
 * General platform settings.
 *
 * Persisted locally for now; the schema is already the shape a
 * `PUT /settings/general` endpoint would accept.
 */
@Component({
  selector: 'll-general-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, DynamicForm],
  template: `
    <div class="ll-page">
      <ll-page-header
        title="General Settings"
        eyebrow="Settings"
        subtitle="Platform identity, session policy, security thresholds and operational controls."
        icon="tune"
        [compact]="true"
        [stats]="[
          { label: 'Environment', value: environmentName, icon: 'dns' },
          { label: 'Version', value: version, icon: 'sell' },
        ]"
        [actions]="[
          { id: 'appearance', label: 'Appearance', icon: 'palette', variant: 'secondary' },
          { id: 'flags', label: 'Feature flags', icon: 'toggle_on', variant: 'secondary' },
        ]"
        (actionSelected)="onHeaderAction($event)" />

      <div class="ll-card">
        <div class="ll-card__body">
          <ll-dynamic-form
            [schema]="schema"
            [value]="model()"
            [submitting]="saving()"
            submitLabel="Save settings"
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
export class GeneralSettings {
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);
  private readonly router = inject(Router);

  protected readonly version = environment.appVersion;
  protected readonly environmentName = environment.name;

  protected readonly saving = signal(false);

  private readonly defaults: GeneralConfiguration = {
    tenantId: environment.defaultTenantId,
    defaultLanguage: environment.defaultLanguage,
    sessionTimeoutMinutes: environment.session.sessionTimeoutSeconds / 60,
    idleTimeoutMinutes: environment.session.idleTimeoutSeconds / 60,
    passwordExpiryDays: 90,
    maxLoginAttempts: 5,
    enforceTwoFactor: false,
    allowConcurrentSessions: true,
    maintenanceMode: false,
    maintenanceMessage: 'The portal is undergoing scheduled maintenance. Please try again shortly.',
    supportHours: '08:00 – 20:00 (ICT), Monday to Saturday',
    dataRetentionMonths: 84,
  };

  private readonly stored = signal<GeneralConfiguration>(
    this.storage.get<GeneralConfiguration>(CONFIG_KEY, this.defaults),
  );

  protected readonly model = computed<Record<string, unknown>>(
    () => ({ ...this.stored() }) as unknown as Record<string, unknown>,
  );

  protected readonly schema: FormSchema = {
    sections: [
      {
        id: 'identity',
        title: 'Platform identity',
        description: 'Tenant and default language for new accounts.',
        icon: 'apartment',
        fields: [
          {
            key: 'tenantId',
            label: 'Tenant identifier',
            type: 'text',
            required: true,
            span: 6,
            readonly: true,
            hint: 'Set at deployment time; changing it requires a migration',
          },
          {
            key: 'defaultLanguage',
            label: 'Default language',
            type: 'select',
            required: true,
            span: 6,
            options: LANGUAGES.map((language) => ({ value: language.value, label: language.label })),
          },
        ],
      },
      {
        id: 'session',
        title: 'Session & security policy',
        description: 'These thresholds are enforced by the session watchdog and the authentication service.',
        icon: 'security',
        fields: [
          {
            key: 'sessionTimeoutMinutes',
            label: 'Session lifetime',
            type: 'number',
            required: true,
            span: 4,
            min: 5,
            max: 480,
            suffix: 'min',
          },
          {
            key: 'idleTimeoutMinutes',
            label: 'Idle timeout',
            type: 'number',
            required: true,
            span: 4,
            min: 1,
            max: 240,
            suffix: 'min',
            hint: 'Warning appears one minute before sign-out',
          },
          {
            key: 'passwordExpiryDays',
            label: 'Password expiry',
            type: 'number',
            span: 4,
            min: 0,
            max: 365,
            suffix: 'days',
            hint: '0 disables expiry',
          },
          {
            key: 'maxLoginAttempts',
            label: 'Maximum failed sign-ins',
            type: 'number',
            span: 6,
            min: 3,
            max: 10,
            hint: 'The account locks after this many consecutive failures',
          },
          {
            key: 'dataRetentionMonths',
            label: 'Audit retention',
            type: 'number',
            span: 6,
            min: 12,
            max: 120,
            suffix: 'months',
            hint: 'Regulatory minimum for lottery operations is 84 months',
          },
          {
            key: 'enforceTwoFactor',
            label: 'Require two-factor authentication for staff',
            type: 'toggle',
            span: 6,
            hint: 'Applies to every administrative role',
          },
          {
            key: 'allowConcurrentSessions',
            label: 'Allow concurrent sessions',
            type: 'toggle',
            span: 6,
            hint: 'When off, signing in elsewhere ends the earlier session',
          },
        ],
      },
      {
        id: 'operations',
        title: 'Operations',
        icon: 'engineering',
        fields: [
          { key: 'supportHours', label: 'Support hours', type: 'text', span: 12 },
          {
            key: 'maintenanceMode',
            label: 'Maintenance mode',
            type: 'toggle',
            span: 12,
            hint: 'Blocks non-administrator access and shows the maintenance notice',
          },
          {
            key: 'maintenanceMessage',
            label: 'Maintenance message',
            type: 'textarea',
            span: 12,
            rows: 2,
            visibleWhen: (value) => Boolean(value['maintenanceMode']),
          },
        ],
      },
    ],
  };

  protected save(value: Record<string, unknown>): void {
    this.saving.set(true);
    const configuration = value as unknown as GeneralConfiguration;

    this.stored.set(configuration);
    this.storage.set(CONFIG_KEY, configuration);

    // The language change takes effect immediately.
    if (configuration.defaultLanguage) {
      this.storage.set(STORAGE_KEYS.language, configuration.defaultLanguage);
      this.translation.use(configuration.defaultLanguage);
    }

    this.saving.set(false);
    this.toast.success('Settings saved', 'Platform settings have been updated.');
  }

  protected reset(): void {
    this.stored.set(this.defaults);
    this.storage.set(CONFIG_KEY, this.defaults);
    this.toast.info('Settings reset to defaults');
  }

  protected onHeaderAction(action: string): void {
    if (action === 'appearance') {
      void this.router.navigate(['/settings/appearance']);
    } else if (action === 'flags') {
      void this.router.navigate(['/settings/feature-flags']);
    }
  }
}
