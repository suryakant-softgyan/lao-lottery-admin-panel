import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { MAT_TOOLTIP_DEFAULT_OPTIONS } from '@angular/material/tooltip';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withPreloading,
  withRouterConfig,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { environment } from '@env/environment';
import { HTTP_INTERCEPTORS_CHAIN } from '@core/interceptors';
import { FeatureFlagService } from '@core/services/feature-flag.service';
import { GlobalErrorHandler } from '@core/services/global-error-handler';
import { AppTitleStrategy } from '@core/services/page-title.strategy';
import { SelectivePreloadingStrategy } from '@core/services/preloading.strategy';
import { ThemeService } from '@core/services/theme.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Event coalescing keeps change detection cheap on data-dense screens.
    provideZoneChangeDetection({ eventCoalescing: true, runCoalescing: true }),

    provideRouter(
      routes,
      withComponentInputBinding(),
      withPreloading(SelectivePreloadingStrategy),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      withRouterConfig({ onSameUrlNavigation: 'reload', paramsInheritanceStrategy: 'always' }),
    ),

    provideHttpClient(withFetch(), withInterceptors(HTTP_INTERCEPTORS_CHAIN)),

    // Async animations keep the animation package out of the initial bundle.
    provideAnimationsAsync(),

    // JSON bundles are served from `assets/i18n/<lang>.json`.
    provideTranslateService({
      fallbackLang: environment.defaultLanguage,
      lang: environment.defaultLanguage,
    }),
    provideTranslateHttpLoader({ prefix: 'assets/i18n/', suffix: '.json' }),

    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000',
    }),

    { provide: TitleStrategy, useClass: AppTitleStrategy },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },

    // Application-wide Material defaults, so no component repeats them.
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline', subscriptSizing: 'dynamic' },
    },
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        panelClass: 'll-dialog-panel',
        maxWidth: '96vw',
        autoFocus: 'dialog',
        restoreFocus: true,
        hasBackdrop: true,
      },
    },
    {
      provide: MAT_TOOLTIP_DEFAULT_OPTIONS,
      useValue: { showDelay: 400, hideDelay: 0, touchendHideDelay: 1200, position: 'below' },
    },

    /*
     * Bootstrap-time initialisation. Theme and feature flags must be resolved
     * before the first route renders: the theme to avoid a flash of unstyled
     * content, the flags because guards consult them during navigation.
     */
    provideAppInitializer(() => {
      const theme = inject(ThemeService);
      const featureFlags = inject(FeatureFlagService);
      void theme.settings();
      void featureFlags.all();
    }),
  ],
};
