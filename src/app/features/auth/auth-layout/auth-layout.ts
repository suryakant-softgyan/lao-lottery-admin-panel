import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { LANGUAGES } from '@core/constants/app.constants';
import { ThemeService } from '@core/services/theme.service';
import { TranslationService } from '@core/services/translation.service';

/**
 * Chrome for the unauthenticated screens.
 *
 * Honours the `loginTheme` appearance setting: `split` shows a branded panel
 * beside the form, `image` and `glass` layer the form over the background,
 * `minimal` and `corporate` centre it on a plain surface.
 */
@Component({
  selector: 'll-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, MatButtonModule, MatMenuModule, MatTooltipModule],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
})
export class AuthLayout {
  protected readonly theme = inject(ThemeService);
  protected readonly translation = inject(TranslationService);

  protected readonly languages = LANGUAGES;
  protected readonly branding = computed(() => this.theme.branding());
  protected readonly loginTheme = computed(() => this.theme.settings().loginTheme);

  protected readonly showcase = computed(() => ['split', 'banking', 'corporate'].includes(this.loginTheme()));

  protected readonly backgroundImage = computed(() => {
    const theme = this.loginTheme();
    if (theme === 'minimal' || theme === 'corporate') {
      return '';
    }
    return this.branding().loginBackgroundUrl;
  });

  /** Trust signals shown on the branded panel. */
  protected readonly highlights = [
    {
      icon: 'verified_user',
      title: 'Regulated operations',
      text: 'Draw execution, verification and publication with a full audit trail.',
    },
    {
      icon: 'insights',
      title: 'Live financial control',
      text: 'Wallets, settlements and gateway reconciliation in one place.',
    },
    {
      icon: 'lan',
      title: 'Nationwide network',
      text: 'Agents, retailers and POS terminals across all 18 provinces.',
    },
  ];

  protected readonly modeIcon = computed(() => (this.theme.isDark() ? 'light_mode' : 'dark_mode'));

  protected toggleMode(): void {
    this.theme.toggleDarkMode();
  }
}
