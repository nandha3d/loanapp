#!/usr/bin/env node
/**
 * Mobile i18n completeness check (U3).
 *
 * Parses mobile/lib/core/l10n/app_strings.dart and verifies every key in
 * kStrings carries all six language variants (en/ta/hi/te/kn/ml).
 * Exits 1 with a report when translations are missing, so CI can gate PRs.
 *
 * Usage: node scripts/check-mobile-i18n.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'mobile', 'lib', 'core', 'l10n', 'app_strings.dart');
const LANGS = ['en', 'ta', 'hi', 'te', 'kn', 'ml'];

const src = readFileSync(FILE, 'utf8');

// Take the body of `const Map<String, Map<String, String>> kStrings = { ... };`
const start = src.indexOf('kStrings = {');
if (start === -1) {
  console.error('kStrings table not found in app_strings.dart');
  process.exit(2);
}
const body = src.slice(start);

// Match each top-level entry: 'key': { ...inner... }
const entryRe = /'([^']+)'\s*:\s*\{([^}]*)\}/g;
const missing = new Map(); // key -> [langs]
let total = 0;

for (const match of body.matchAll(entryRe)) {
  const [, key, inner] = match;
  // Skip inner-language pairs that the regex may catch (their "inner" has no quotes-colon-quotes runs with lang codes)
  const langsPresent = LANGS.filter((l) => new RegExp(`'${l}'\\s*:`).test(inner));
  if (langsPresent.length === 0) continue; // not a string entry
  total += 1;
  const absent = LANGS.filter((l) => !langsPresent.includes(l));
  if (absent.length > 0) missing.set(key, absent);
}

if (total === 0) {
  console.error('No string entries parsed — check the regex against app_strings.dart format.');
  process.exit(2);
}

if (missing.size === 0) {
  console.log(`i18n OK — ${total} keys × ${LANGS.length} languages complete.`);
  process.exit(0);
}

console.error(`i18n INCOMPLETE — ${missing.size}/${total} keys missing translations:\n`);
for (const [key, langs] of missing) {
  console.error(`  ${key} → missing: ${langs.join(', ')}`);
}
process.exit(1);
