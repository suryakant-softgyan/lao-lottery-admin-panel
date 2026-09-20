#!/usr/bin/env node
/**
 * Lists the English copy of the portal so it can be translated into
 * `src/assets/i18n/phrases/<lang>.json` (see DomTranslatorService).
 *
 *   node tools/extract-phrases.mjs            → every phrase, as JSON
 *   node tools/extract-phrases.mjs --missing lo → only phrases `lo.json` lacks
 *
 * Extraction is heuristic: template text, text-bearing attributes and the
 * string properties (label, title, hint …) that reach the screen through the
 * shared components. Text with embedded values is reported under `composite`
 * and needs a `patterns` entry instead of a phrase.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('../src/app', import.meta.url).pathname;
const SKIP_DIRS = new Set(['mock']);

const TEXT_ATTRIBUTES =
  'title|subtitle|eyebrow|label|placeholder|aria-label|alt|matTooltip|hint|heading|caption|' +
  'emptyTitle|emptyMessage|searchPlaceholder|description|message|confirmLabel|cancelLabel|' +
  'text|header|prefix|suffix|unit|tooltip|ariaLabel';
const TEXT_PROPERTIES =
  TEXT_ATTRIBUTES.replace(/-/g, '') +
  '|breadcrumb|reasonLabel|detail|body|scope|group|section|category|name|summary|' +
  'loginWelcomeTitle|loginWelcomeMessage|footerText|maintenanceMessage|keys|shortcut';

const phrases = new Set();
const composite = new Set();

const clean = (value) => value.replace(/\s+/g, ' ').trim();
const looksLikeCopy = (value) =>
  /[A-Za-z]{2}/.test(value) &&
  !/^[a-z0-9_.:/#-]+$/.test(value) && // identifiers, routes, icon names
  !/^(https?:|\/|#|\.|@)/.test(value);

/** Code that the template heuristics occasionally mistake for text. */
const looksLikeCode = (value) =>
  /\?\?|=>|===|!==|&&|\|\||\) \{|^track |\(\)|^\W*$|[{}]|\$event|;$/.test(value);

/** Replaces each `${…}` / `{{ … }}` with `{1}`, `{2}` …; `null` when unbalanced. */
function placeholders(value) {
  let output = '';
  let index = 0;
  for (let i = 0; i < value.length; i++) {
    const open = value.startsWith('${', i) ? 1 : value.startsWith('{{', i) ? 2 : 0;
    if (!open) {
      output += value[i];
      continue;
    }
    let depth = 0;
    let j = i;
    for (; j < value.length; j++) {
      if (value[j] === '{') depth++;
      else if (value[j] === '}' && --depth === 0) break;
    }
    if (j === value.length) return null;
    output += `{${++index}}`;
    i = j;
  }
  return output;
}

function add(raw) {
  const value = clean(raw.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'));
  if (!value || !looksLikeCopy(value)) return;
  if (/\{\{|\$\{/.test(value)) {
    const template = placeholders(value);
    if (template && looksLikeCopy(template.replace(/\{\d+\}/g, '')) && !looksLikeCode(template.replace(/\{\d+\}/g, ''))) {
      composite.add(template);
    }
  } else if (!looksLikeCode(value)) {
    phrases.add(value);
  }
}

function fromTemplate(source) {
  const html = source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Control-flow block headers and braces are not text.
    .replace(/@(if|else if|for|switch|case|defer|let)\b[^{;\n]*(\{|;)/g, '<x>')
    .replace(/@(else|empty|default|placeholder|loading|error)\s*\{/g, '<x>')
    .replace(/^\s*\}\s*$/gm, '<x>');

  // Quoted literals inside interpolations and bindings: {{ ok ? 'Yes' : 'No' }}.
  for (const [, literal] of html.matchAll(/'((?:[^'\\\n]|\\.)*[A-Za-z]{2}(?:[^'\\\n]|\\.)*)'/g)) {
    if (/^[A-Z]/.test(literal) || / /.test(literal)) add(literal.replace(/\\'/g, "'"));
  }
  for (const [, , value] of html.matchAll(
    new RegExp(`\\s(${TEXT_ATTRIBUTES})="([^"]*)"`, 'g'),
  )) {
    add(value);
  }
  for (const text of html.replace(/<[^>]*>/gs, '\u0000').split('\u0000')) {
    // A node that is purely an interpolation carries no copy of its own.
    if (!clean(text.replace(/\{\{[\s\S]*?\}\}/g, ''))) continue;
    add(text);
  }
}

function fromTypeScript(source) {
  const property = new RegExp(
    `\\b(?:${TEXT_PROPERTIES})\\??:\\s*(?:'((?:[^'\\\\\\n]|\\\\.)*)'|\`((?:[^\`\\\\]|\\\\.)*)\`)`,
    'g',
  );
  for (const [, single, template] of source.matchAll(property)) {
    add((single ?? template).replace(/\\'/g, "'"));
  }
  // toast.success('Title', 'Message'), confirm.open(…) and thrown messages.
  for (const [, args] of source.matchAll(
    /\.(?:success|error|info|warning|danger)\(\s*((?:'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|\s|,)+)/g,
  )) {
    for (const [, single, template] of args.matchAll(
      /'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g,
    )) {
      add((single ?? template).replace(/\\'/g, "'"));
    }
  }
  // Sentence-like literals anywhere else: ternaries, arguments, returned messages.
  const code = source.replace(/template:\s*`(?:[^`\\]|\\.)*`/g, '').replace(/^import .*$/gm, '');
  for (const [, single, template] of code.matchAll(
    /'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g,
  )) {
    const literal = (single ?? template).replace(/\\'/g, "'");
    if (/^[A-Z][a-z]+[a-z,]*( [^ ]+)+$/.test(literal.replace(/\$\{[^}]*\}/g, 'x')) && !/[<>=;]|\bll-/.test(literal)) {
      add(literal);
    }
  }
  for (const [, template] of source.matchAll(/template:\s*`((?:[^`\\]|\\.)*)`/g)) {
    fromTemplate(template);
  }
}

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(path);
    } else if (extname(path) === '.html') {
      fromTemplate(readFileSync(path, 'utf8'));
    } else if (extname(path) === '.ts' && !path.endsWith('.spec.ts')) {
      fromTypeScript(readFileSync(path, 'utf8'));
    }
  }
}

walk(ROOT);

let result = [...phrases].sort();
const missingIndex = process.argv.indexOf('--missing');
if (missingIndex > -1) {
  const bundlePath = new URL(
    `../src/assets/i18n/phrases/${process.argv[missingIndex + 1]}.json`,
    import.meta.url,
  ).pathname;
  const known = existsSync(bundlePath) ? JSON.parse(readFileSync(bundlePath, 'utf8')).phrases : {};
  result = result.filter((phrase) => !(phrase in known));
}
console.log(JSON.stringify({ phrases: result, composite: [...composite].sort() }, null, 1));
