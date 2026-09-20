import { DOCUMENT } from '@angular/common';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, NgZone, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';

/** Shape of `assets/i18n/phrases/<lang>.json`. */
interface PhraseBundle {
  /** Exact English text → translated text. */
  phrases: Record<string, string>;
  /** `[regex source, replacement]` pairs for text with embedded values. */
  patterns?: [string, string][];
}

interface CompiledPattern {
  expression: RegExp;
  replacement: string;
  /**
   * Patterns with little literal text ("All (.*)", "(.+) · (.+)") match almost
   * anything, so they only apply when a captured fragment translates too.
   */
  loose: boolean;
}

/** Attributes that carry user-visible text. */
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'] as const;

/** Elements whose text is never prose: icon ligatures, code, user input. */
const SKIPPED_SELECTOR =
  'script, style, noscript, code, pre, textarea, mat-icon, .mat-icon, .material-icons, ' +
  '.material-symbols-rounded, .material-symbols-outlined, [contenteditable], [data-no-translate]';

/** The language the screens are authored in. */
const SOURCE_LANGUAGE = 'en';

const HAS_LATIN_LETTER = /[A-Za-z]/;

/**
 * Phrase-level translation of the rendered page.
 *
 * The portal's screens are written with English copy in templates, column
 * definitions, status maps and toasts. Rather than keying every one of those
 * strings, this service translates what actually reaches the DOM: it looks each
 * text node and text attribute up in an English → target-language phrase bundle
 * and swaps it in place, watching for later changes with a MutationObserver.
 *
 * The English original of every translated node is remembered, so switching
 * back to English (or on to another language) is lossless. Text that is not in
 * the bundle is left in English.
 */
@Injectable({ providedIn: 'root' })
export class DomTranslatorService {
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  /** Bypasses the interceptor chain — the bundle is a static asset. */
  private readonly http = new HttpClient(inject(HttpBackend));

  private readonly bundles = new Map<string, PhraseBundle>();
  private phrases = new Map<string, string>();
  private patterns: CompiledPattern[] = [];
  private readonly cache = new Map<string, string | undefined>();
  private active = false;
  private requested = SOURCE_LANGUAGE;

  /** English source of every text node this service has rewritten. */
  private readonly textOriginals = new Map<Text, string>();
  /** What this service last wrote to a node, to recognise its own edits. */
  private readonly textWritten = new WeakMap<Text, string>();
  /** English source of every attribute this service has rewritten. */
  private readonly attributeOriginals = new Map<Element, Map<string, string>>();
  private readonly attributeWritten = new WeakMap<Element, Map<string, string>>();
  /** Untranslated text seen while a bundle was active; a development aid. */
  private readonly missing = new Set<string>();

  private observer?: MutationObserver;
  /** Bumped whenever the active bundle changes, so signal consumers re-run. */
  private readonly revision = signal(0);

  constructor() {
    // `__llMissingPhrases()` in the console lists copy the bundle lacks.
    (this.document.defaultView as unknown as Record<string, unknown>)['__llMissingPhrases'] = () =>
      [...this.missing].sort();
  }

  /** Switches the page to `language`; English restores the source copy. */
  use(language: string): void {
    this.requested = language;
    if (language === SOURCE_LANGUAGE) {
      this.deactivate();
      return;
    }
    const cached = this.bundles.get(language);
    if (cached) {
      this.activate(cached);
      return;
    }
    this.http
      .get<PhraseBundle>(`assets/i18n/phrases/${language}.json`)
      .pipe(catchError(() => of<PhraseBundle>({ phrases: {} })))
      .subscribe((bundle) => {
        this.bundles.set(language, bundle);
        // The user may have switched again while the bundle was loading.
        if (this.requested === language) {
          this.activate(bundle);
        }
      });
  }

  /**
   * Translates text that never reaches the DOM (canvas charts, exports).
   * Reactive: reading it inside an effect or computed tracks language changes.
   */
  text(value: string): string {
    this.revision();
    return this.active ? (this.translate(value) ?? value) : value;
  }

  private activate(bundle: PhraseBundle): void {
    this.restoreAll();
    this.phrases = new Map(Object.entries(bundle.phrases));
    this.patterns = (bundle.patterns ?? []).map(([source, replacement]) => ({
      expression: new RegExp(source),
      replacement,
      loose: source.replace(/\((?:\?:)?[^()]*\)[*+?]*|\\.|[\^$]/g, '').length < 8,
    }));
    this.active = true;
    this.cache.clear();
    this.missing.clear();
    this.revision.update((revision) => revision + 1);

    this.zone.runOutsideAngular(() => {
      this.translateTree(this.document.documentElement);
      this.observer ??= new MutationObserver((mutations) => this.onMutations(mutations));
      this.observer.observe(this.document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
      });
    });
  }

  private deactivate(): void {
    this.active = false;
    this.revision.update((revision) => revision + 1);
    this.observer?.disconnect();
    this.restoreAll();
  }

  private restoreAll(): void {
    // Drop pending records so our own restores are not re-processed.
    this.observer?.takeRecords();
    for (const [node, original] of this.textOriginals) {
      if (node.isConnected) {
        node.nodeValue = original;
      }
    }
    for (const [element, attributes] of this.attributeOriginals) {
      if (element.isConnected) {
        for (const [name, original] of attributes) {
          element.setAttribute(name, original);
        }
      }
    }
    this.textOriginals.clear();
    this.attributeOriginals.clear();
    this.observer?.takeRecords();
  }

  private onMutations(mutations: MutationRecord[]): void {
    if (!this.active) {
      return;
    }
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => this.translateTree(node));
      } else if (mutation.type === 'characterData') {
        this.translateText(mutation.target as Text);
      } else if (mutation.attributeName) {
        this.translateAttribute(mutation.target as Element, mutation.attributeName);
      }
    }
    // The writes above are our own; they need no second pass.
    this.observer?.takeRecords();
    this.prune();
  }

  private translateTree(root: Node): void {
    if (root.nodeType === Node.TEXT_NODE) {
      this.translateText(root as Text);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE || (root as Element).closest(SKIPPED_SELECTOR)) {
      return;
    }
    const walker = this.document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) =>
          node.nodeType === Node.ELEMENT_NODE && (node as Element).matches(SKIPPED_SELECTOR)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT,
      },
    );
    for (let node: Node | null = walker.currentNode; node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        this.translateText(node as Text, true);
      } else {
        for (const name of TRANSLATABLE_ATTRIBUTES) {
          if ((node as Element).hasAttribute(name)) {
            this.translateAttribute(node as Element, name);
          }
        }
      }
    }
  }

  private translateText(node: Text, parentChecked = false): void {
    const value = node.nodeValue ?? '';
    if (value === this.textWritten.get(node)) {
      return;
    }
    // Whatever was remembered for this node is stale once its text changes.
    this.textOriginals.delete(node);
    if (!HAS_LATIN_LETTER.test(value)) {
      return;
    }
    if (!parentChecked && node.parentElement?.closest(SKIPPED_SELECTOR)) {
      return;
    }
    const translated = this.translate(value);
    if (translated === null) {
      return;
    }
    this.textOriginals.set(node, value);
    this.textWritten.set(node, translated);
    node.nodeValue = translated;
  }

  private translateAttribute(element: Element, name: string): void {
    const value = element.getAttribute(name) ?? '';
    if (value === this.attributeWritten.get(element)?.get(name)) {
      return;
    }
    this.attributeOriginals.get(element)?.delete(name);
    if (!HAS_LATIN_LETTER.test(value)) {
      return;
    }
    const translated = this.translate(value);
    if (translated === null) {
      return;
    }
    let written = this.attributeWritten.get(element);
    if (!written) {
      written = new Map();
      this.attributeWritten.set(element, written);
    }
    written.set(name, translated);
    let originals = this.attributeOriginals.get(element);
    if (!originals) {
      originals = new Map();
      this.attributeOriginals.set(element, originals);
    }
    originals.set(name, value);
    element.setAttribute(name, translated);
  }

  /** Returns the translation with the source's outer whitespace kept, or `null`. */
  private translate(value: string): string | null {
    const key = value.replace(/\s+/g, ' ').trim();
    if (!key) {
      return null;
    }
    let result = this.cache.get(key);
    if (result === undefined && !this.cache.has(key)) {
      result = this.lookup(key, 0);
      // Table data repeats constantly; remember misses as well as hits.
      if (this.cache.size < 20000) {
        this.cache.set(key, result);
      }
    }
    if (result === undefined) {
      if (this.missing.size < 5000) {
        this.missing.add(key);
      }
      return null;
    }
    const leading = /^\s*/.exec(value)?.[0] ?? '';
    const trailing = /\s*$/.exec(value)?.[0] ?? '';
    return `${leading ? ' ' : ''}${result}${trailing ? ' ' : ''}`;
  }

  /** Exact phrase first, then patterns; captured fragments are translated in turn. */
  private lookup(key: string, depth: number): string | undefined {
    const phrase = this.phrases.get(key);
    if (phrase !== undefined || depth > 2 || !HAS_LATIN_LETTER.test(key)) {
      return phrase;
    }
    for (const { expression, replacement, loose } of this.patterns) {
      const match = expression.exec(key);
      if (!match) {
        continue;
      }
      let capturesTranslated = false;
      const result = replacement.replace(/\$(\d)/g, (_, index: string) => {
        const captured = match[Number(index)] ?? '';
        const translated = this.lookup(captured, depth + 1);
        // Numbers and codes without letters need no translation of their own.
        capturesTranslated ||= translated !== undefined || !HAS_LATIN_LETTER.test(captured);
        return translated ?? captured;
      });
      if (result !== key && (!loose || capturesTranslated)) {
        return result;
      }
    }
    return undefined;
  }

  /** Forgets nodes that have left the document so the maps cannot grow unbounded. */
  private prune(): void {
    if (this.textOriginals.size < 4000) {
      return;
    }
    for (const node of this.textOriginals.keys()) {
      if (!node.isConnected) {
        this.textOriginals.delete(node);
      }
    }
    for (const element of this.attributeOriginals.keys()) {
      if (!element.isConnected) {
        this.attributeOriginals.delete(element);
      }
    }
  }
}
