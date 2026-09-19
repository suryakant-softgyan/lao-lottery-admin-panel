import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { environment } from '@env/environment';
import { STORAGE_KEYS } from '../constants/app.constants';
import { StorageService } from './storage.service';
import { ThemeService } from './theme.service';

/** Languages that render right-to-left; drives the automatic RTL switch. */
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

/**
 * Language management on top of ngx-translate.
 *
 * Owns the persisted language choice, sets `<html lang>` and flips the layout
 * direction for RTL locales — the portal is RTL-ready even though the shipped
 * languages (English and Lao) are both LTR.
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly translate = inject(TranslateService);
  private readonly storage = inject(StorageService);
  private readonly theme = inject(ThemeService);
  private readonly document = inject(DOCUMENT);

  private readonly language = signal<string>(
    this.storage.get<string>(STORAGE_KEYS.language, environment.defaultLanguage),
  );

  readonly current = this.language.asReadonly();
  readonly supported = environment.supportedLanguages;
  readonly isRtl = computed(() => RTL_LANGUAGES.has(this.language()));

  /** Called once during application initialisation. */
  initialise(): void {
    this.translate.addLangs([...environment.supportedLanguages]);
    this.translate.setFallbackLang(environment.defaultLanguage);
    this.use(this.language());
  }

  use(language: string): void {
    if (!environment.supportedLanguages.includes(language)) {
      return;
    }
    this.language.set(language);
    this.translate.use(language);
    this.storage.set(STORAGE_KEYS.language, language);

    this.document.documentElement.lang = language;
    // Keep the theme's direction in step so CSS logical properties resolve.
    this.theme.setDirection(RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr');
  }

  /** Synchronous lookup, for places a pipe cannot be used. */
  instant(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
