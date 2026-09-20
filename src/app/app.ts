import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from '@core/authentication/auth.service';
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
  private readonly auth = inject(AuthService);

  constructor() {
    this.translation.initialise();
    this.linkLanguageToProfile();
    // Touching the palette forces the first projection onto :root.
    void this.theme.palette();
  }

  /**
   * Keeps the interface language and the profile's language in step. It lives
   * here because the two services cannot know each other: translations load
   * over HTTP, and the HTTP interceptors depend on {@link AuthService}.
   */
  private linkLanguageToProfile(): void {
    let signedInAs = this.auth.user()?.id ?? null;

    // Signing in adopts the language saved on the profile…
    effect(() => {
      const user = this.auth.user();
      if (user && user.id !== signedInAs) {
        untracked(() => this.translation.adoptProfileLanguage(user.language));
      }
      signedInAs = user?.id ?? null;
    });

    // …and a language picked in the portal is saved back to it.
    effect(() => {
      const language = this.translation.current();
      const user = this.auth.user();
      if (user && user.language !== language && untracked(() => this.auth.isAuthenticated())) {
        untracked(() => this.auth.saveLanguage(language));
      }
    });
  }
}
