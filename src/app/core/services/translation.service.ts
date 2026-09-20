import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { environment } from '@env/environment';
import { STORAGE_KEYS } from '../constants/app.constants';
import { DomTranslatorService } from './dom-translator.service';
import { StorageService } from './storage.service';
import { ThemeService } from './theme.service';

/** Calendar locale per interface language. */
const DATE_LOCALES: Record<string, string> = { lo: 'lo-LA' };

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
  private readonly domTranslator = inject(DomTranslatorService);
  private readonly document = inject(DOCUMENT);

  private readonly language = signal<string>(
    this.storage.get<string>(STORAGE_KEYS.language, environment.defaultLanguage),
  );

  readonly current = this.language.asReadonly();
  /** True once someone picks a language by hand in this page session. */
  private chosenByHand = false;
  readonly supported = environment.supportedLanguages;
  readonly isRtl = computed(() => RTL_LANGUAGES.has(this.language()));
  /** BCP 47 tag for calendar widgets: the language wins over the regional default. */
  readonly dateLocale = computed(() =>
    this.language() === environment.defaultLanguage
      ? this.theme.regional().locale
      : (DATE_LOCALES[this.language()] ?? this.language()),
  );

  /** Called once during application initialisation. */
  initialise(): void {
    this.translate.addLangs([...environment.supportedLanguages]);
    this.translate.setFallbackLang(environment.defaultLanguage);
    this.apply(this.language());
  }

  use(language: string): void {
    if (!environment.supportedLanguages.includes(language)) {
      return;
    }
    this.chosenByHand = true;
    this.apply(language);
  }

  /**
   * Applies the language saved on a profile at sign-in. A language picked on
   * the login screen moments earlier is the fresher intent, so it is kept.
   */
  adoptProfileLanguage(language: string | null | undefined): void {
    if (language && !this.chosenByHand && environment.supportedLanguages.includes(language)) {
      this.apply(language);
    }
  }

  private apply(language: string): void {
    this.language.set(language);
    this.translate.use(language);
    // Screen copy is authored in English; the phrase bundle covers the rest.
    this.domTranslator.use(language);
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
