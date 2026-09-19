import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';

import { LANGUAGES } from '@core/constants/app.constants';
import type { BrandingSettings, RegionalSettings } from '@core/models/theme.model';
import { ConfirmService } from '@core/services/confirm.service';
import { ThemeService } from '@core/services/theme.service';
import { ToastService } from '@core/services/toast.service';
import { DynamicForm } from '@shared/components/dynamic-form/dynamic-form';
import type { FormSchema } from '@shared/components/dynamic-form/dynamic-form.model';
import { PageHeader } from '@shared/components/page-header/page-header';

/**
 * Branding and white labelling.
 *
 * Everything an operator needs to rebrand the deployment without touching code:
 * names, logos, imagery, login copy, support details and regional formats. A
 * live preview sits beside the form so the effect is obvious before saving.
 */
@Component({
  selector: 'll-branding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatTabsModule, PageHeader, DynamicForm],
  templateUrl: './branding.html',
  styleUrl: './branding.scss',
})
export class Branding {
  protected readonly theme = inject(ThemeService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly saving = signal(false);

  /** Live draft so the preview updates while the operator types. */
  protected readonly draft = signal<Record<string, unknown>>({ ...this.theme.branding() });

  protected readonly brandingModel = computed<Record<string, unknown>>(() => ({
    ...this.theme.branding(),
  }));

  protected readonly regionalModel = computed<Record<string, unknown>>(() => ({
    ...this.theme.regional(),
    // The picker works in strings; it is converted back on save.
    firstDayOfWeek: String(this.theme.regional().firstDayOfWeek),
  }));

  protected readonly preview = computed(() => ({
    applicationName: String(this.draft()['applicationName'] ?? ''),
    applicationShortName: String(this.draft()['applicationShortName'] ?? ''),
    companyName: String(this.draft()['companyName'] ?? ''),
    loginWelcomeTitle: String(this.draft()['loginWelcomeTitle'] ?? ''),
    loginWelcomeMessage: String(this.draft()['loginWelcomeMessage'] ?? ''),
    footerText: String(this.draft()['footerText'] ?? ''),
    copyright: String(this.draft()['copyright'] ?? ''),
    dashboardBannerUrl: String(this.draft()['dashboardBannerUrl'] ?? ''),
    loginBackgroundUrl: String(this.draft()['loginBackgroundUrl'] ?? ''),
  }));

  protected readonly brandingSchema: FormSchema = {
    sections: [
      {
        id: 'identity',
        title: 'Identity',
        description: 'Names shown in the browser tab, sidebar, emails and exports.',
        icon: 'badge',
        fields: [
          { key: 'applicationName', label: 'Application name', type: 'text', required: true, span: 6 },
          {
            key: 'applicationShortName',
            label: 'Short name',
            type: 'text',
            required: true,
            span: 6,
            hint: 'Used in the sidebar and browser tab',
          },
          { key: 'companyName', label: 'Operator name', type: 'text', required: true, span: 6 },
          {
            key: 'primaryDomain',
            label: 'Primary domain',
            type: 'text',
            span: 6,
            hint: 'Used in emails and deep links',
          },
        ],
      },
      {
        id: 'imagery',
        title: 'Imagery',
        description: 'Paths or URLs. Placeholder assets ship with the build and can be replaced by uploads.',
        icon: 'image',
        fields: [
          { key: 'logoUrl', label: 'Logo (light)', type: 'text', span: 6, icon: 'image' },
          { key: 'logoDarkUrl', label: 'Logo (dark)', type: 'text', span: 6, icon: 'image' },
          { key: 'loginLogoUrl', label: 'Login logo', type: 'text', span: 6, icon: 'image' },
          { key: 'faviconUrl', label: 'Favicon', type: 'text', span: 6, icon: 'star' },
          {
            key: 'dashboardBannerUrl',
            label: 'Dashboard banner',
            type: 'text',
            span: 12,
            icon: 'panorama',
          },
          {
            key: 'loginBackgroundUrl',
            label: 'Login background',
            type: 'text',
            span: 12,
            icon: 'wallpaper',
          },
          {
            key: 'loginVideoUrl',
            label: 'Login background video',
            type: 'text',
            span: 12,
            icon: 'movie',
            hint: 'Optional — used by the video login theme',
          },
          {
            key: 'loadingAnimationUrl',
            label: 'Loading animation',
            type: 'text',
            span: 12,
            icon: 'animation',
          },
        ],
      },
      {
        id: 'copy',
        title: 'Copy',
        description: 'Text shown on the login page and in the footer.',
        icon: 'edit_note',
        fields: [
          { key: 'loginWelcomeTitle', label: 'Login welcome title', type: 'text', span: 6 },
          { key: 'loginWelcomeMessage', label: 'Login welcome message', type: 'text', span: 6 },
          { key: 'footerText', label: 'Footer text', type: 'text', span: 6 },
          { key: 'copyright', label: 'Copyright notice', type: 'text', span: 6 },
        ],
      },
      {
        id: 'support',
        title: 'Support contacts',
        icon: 'support_agent',
        fields: [
          { key: 'supportEmail', label: 'Support email', type: 'email', span: 6, icon: 'mail' },
          { key: 'supportPhone', label: 'Support phone', type: 'text', span: 6, icon: 'phone' },
        ],
      },
    ],
  };

  protected readonly regionalSchema: FormSchema = {
    sections: [
      {
        id: 'regional',
        title: 'Regional formats',
        description:
          'Applied to every date, number and currency in the portal, including exports and printed reports.',
        icon: 'public',
        fields: [
          {
            key: 'locale',
            label: 'Locale',
            type: 'select',
            required: true,
            span: 4,
            options: [
              { value: 'en-GB', label: 'English (United Kingdom)' },
              { value: 'en-US', label: 'English (United States)' },
              { value: 'lo-LA', label: 'Lao (Laos)' },
              { value: 'th-TH', label: 'Thai (Thailand)' },
            ],
          },
          {
            key: 'currency',
            label: 'Currency',
            type: 'select',
            required: true,
            span: 4,
            options: [
              { value: 'LAK', label: 'Lao Kip (LAK)' },
              { value: 'USD', label: 'US Dollar (USD)' },
              { value: 'THB', label: 'Thai Baht (THB)' },
            ],
          },
          { key: 'currencySymbol', label: 'Currency symbol', type: 'text', span: 4, maxLength: 4 },
          {
            key: 'currencyPosition',
            label: 'Symbol position',
            type: 'radio',
            span: 6,
            options: [
              { value: 'prefix', label: 'Before the amount' },
              { value: 'suffix', label: 'After the amount' },
            ],
          },
          {
            key: 'timeFormat',
            label: 'Time format',
            type: 'radio',
            span: 6,
            options: [
              { value: '24h', label: '24-hour' },
              { value: '12h', label: '12-hour' },
            ],
          },
          {
            key: 'timezone',
            label: 'Time zone',
            type: 'select',
            span: 6,
            options: [
              { value: 'Asia/Vientiane', label: 'Asia/Vientiane (ICT)' },
              { value: 'Asia/Bangkok', label: 'Asia/Bangkok (ICT)' },
              { value: 'UTC', label: 'UTC' },
            ],
          },
          {
            key: 'firstDayOfWeek',
            label: 'First day of the week',
            type: 'select',
            span: 6,
            options: [
              { value: '1', label: 'Monday' },
              { value: '0', label: 'Sunday' },
              { value: '6', label: 'Saturday' },
            ],
          },
          {
            key: 'numberGrouping',
            label: 'Group thousands',
            type: 'toggle',
            span: 12,
            hint: 'Renders 1,234,567 rather than 1234567',
          },
        ],
      },
    ],
  };

  protected readonly languages = LANGUAGES;

  protected onBrandingChange(value: Record<string, unknown>): void {
    this.draft.set(value);
  }

  protected saveBranding(value: Record<string, unknown>): void {
    this.saving.set(true);
    this.theme.updateBranding(value as unknown as Partial<BrandingSettings>);
    this.saving.set(false);
    this.toast.success('Branding updated', 'The new identity is live across the portal.');
  }

  protected saveRegional(value: Record<string, unknown>): void {
    this.saving.set(true);
    this.theme.updateRegional({
      ...(value as unknown as Partial<RegionalSettings>),
      // The select yields a string; the model expects the numeric day index.
      firstDayOfWeek: Number(value['firstDayOfWeek']) as RegionalSettings['firstDayOfWeek'],
    });
    this.saving.set(false);
    this.toast.success('Regional settings updated', 'Dates, numbers and currency reformatted.');
  }

  protected reset(): void {
    this.confirm
      .ask({
        title: 'Reset branding to defaults?',
        message: 'Names, imagery, copy and support contacts return to the shipped defaults.',
        confirmLabel: 'Reset branding',
        tone: 'warning',
        icon: 'restart_alt',
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.theme.resetBranding();
          this.draft.set({ ...this.theme.branding() });
          this.toast.success('Branding reset');
        }
      });
  }
}
