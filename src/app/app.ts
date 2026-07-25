import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ThemeService } from '@core/services/theme.service';
import { TranslationService } from '@core/services/translation.service';

/**
 * Application root.
 *
 * Intentionally thin: the authenticated shell lives in `MainLayout` and the
 * unauthenticated screens in `AuthLayout`, both reached through the router.
 * Injecting {@link ThemeService} here guarantees the CSS variables are applied
 * before the first route renders, so there is no flash of unstyled content.
 */
@Component({
  selector: 'll-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }
  `,
})
export class App {
  private readonly theme = inject(ThemeService);
  private readonly translation = inject(TranslationService);

  constructor() {
    this.translation.initialise();
    // Touching the palette forces the first projection onto :root.
    void this.theme.palette();
  }
}
