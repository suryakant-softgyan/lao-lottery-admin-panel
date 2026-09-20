#!/usr/bin/env node
/**
 * Merges translated `{ "English": "Translation" }` maps into a phrase bundle.
 *
 *   node tools/merge-phrases.mjs lo translated-1.json translated-2.json …
 *
 * Keys holding `{1}`, `{2}` … placeholders (the `composite` list printed by
 * extract-phrases.mjs) become regular-expression patterns; everything else is
 * an exact phrase. Existing bundle entries are kept unless a file overrides them.
 * Hand-written `rawPatterns` (`[regex, replacement]`) in the bundle are preserved
 * and tried before the generated ones; `lastPatterns` are tried after them.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [language, ...files] = process.argv.slice(2);
if (!language || !files.length) {
  console.error('usage: merge-phrases.mjs <lang> <translated.json>…');
  process.exit(1);
}

const bundlePath = new URL(`../src/assets/i18n/phrases/${language}.json`, import.meta.url).pathname;
const bundle = existsSync(bundlePath)
  ? JSON.parse(readFileSync(bundlePath, 'utf8'))
  : { phrases: {}, templates: {} };
bundle.templates ??= {};

const normalise = (value) => value.replace(/\s+/g, ' ').trim();

for (const file of files) {
  for (const [source, translation] of Object.entries(JSON.parse(readFileSync(file, 'utf8')))) {
    const key = normalise(source);
    const value = normalise(String(translation));
    if (!value) continue;
    // An unchanged template still matters: its captured values get translated.
    if (/\{\d\}/.test(key)) bundle.templates[key] = value;
    else if (value !== key) bundle.phrases[key] = value;
  }
}

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const literalLength = (template) => template.replace(/\{\d\}/g, '').length;

// Most specific template first, so "{1} rows exported to CSV." beats "{1} rows".
bundle.rawPatterns ??= [];
bundle.patterns = Object.entries(bundle.templates)
  .sort(([a], [b]) => literalLength(b) - literalLength(a))
  .map(([template, translation]) => [
    `^${template
      .split(/(\{\d\})/)
      .map((part) => (/^\{\d\}$/.test(part) ? '(.*?)' : escape(part)))
      .join('')}$`,
    // Placeholders may be reordered by the translator: map by their number.
    translation.replace(/\{(\d)\}/g, (_, number) => {
      const order = [...template.matchAll(/\{(\d)\}/g)].map((match) => match[1]);
      return `$${order.indexOf(number) + 1}`;
    }),
  ]);
bundle.patterns.unshift(...bundle.rawPatterns);
// Generic splitters ("A · B") go last so specific templates win.
bundle.lastPatterns ??= [];
bundle.patterns.push(...bundle.lastPatterns);

const sorted = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(
  bundlePath,
  `${JSON.stringify({ phrases: sorted(bundle.phrases), templates: sorted(bundle.templates), rawPatterns: bundle.rawPatterns, lastPatterns: bundle.lastPatterns, patterns: bundle.patterns }, null, 1)}\n`,
);
console.log(
  `${language}: ${Object.keys(bundle.phrases).length} phrases, ${bundle.patterns.length} patterns`,
);
