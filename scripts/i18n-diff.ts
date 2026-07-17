// i18n completeness gate (audit 04). Compares every language's key set
// against the en baseline for BOTH platforms:
//   - web:    i18n/{en,ta,hi,te,kn,ml}.ts (recursive leaf keys)
//   - mobile: mobile/lib/core/l10n/app_strings.dart (per-key language maps)
// Exits non-zero listing missing keys. Run: npm run i18n:check
import { en } from '../i18n/en';
import { ta } from '../i18n/ta';
import { hi } from '../i18n/hi';
import { te } from '../i18n/te';
import { kn } from '../i18n/kn';
import { ml } from '../i18n/ml';
import { readFileSync } from 'fs';
import { join } from 'path';

type Dict = Record<string, unknown>;

function leafKeys(obj: Dict, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') keys.push(...leafKeys(v as Dict, path));
    else keys.push(path);
  }
  return keys;
}

let failed = false;

// ── Web ──────────────────────────────────────────────────────────────
const webDicts: Record<string, Dict> = { ta, hi, te, kn, ml };
const enKeys = leafKeys(en as Dict);
console.log(`web: en baseline = ${enKeys.length} keys`);
for (const [lang, dict] of Object.entries(webDicts)) {
  const have = new Set(leafKeys(dict));
  const missing = enKeys.filter((k) => !have.has(k));
  if (missing.length) {
    failed = true;
    console.error(`web:${lang} MISSING ${missing.length} keys:`);
    for (const k of missing) console.error(`  - ${k}`);
  } else {
    console.log(`web:${lang} complete (${have.size} keys)`);
  }
}

// ── Mobile ───────────────────────────────────────────────────────────
const dart = readFileSync(
  join(__dirname, '..', 'mobile', 'lib', 'core', 'l10n', 'app_strings.dart'),
  'utf8',
);
const LANGS = ['en', 'ta', 'hi', 'te', 'kn', 'ml'] as const;
// Blocks look like: 'group.key': { 'en': '...', 'ta': '...', ... }, and may
// be single-line ('lt.product': { 'en': 'Product Finance' },) — the exact
// shape that tends to be missing translations, so it MUST be matched.
const blockRe = /'([^']+)'\s*:\s*\{([^{}]*)\}/g;
const missingByLang: Record<string, string[]> = Object.fromEntries(LANGS.map((l) => [l, []]));
let blocks = 0;
for (const m of dart.matchAll(blockRe)) {
  const key = m[1];
  const body = m[2];
  if (!/'(en|ta|hi|te|kn|ml)'\s*:/.test(body)) continue; // not a language block
  blocks++;
  for (const lang of LANGS) {
    if (!new RegExp(`'${lang}'\\s*:`).test(body)) missingByLang[lang].push(key);
  }
}
console.log(`mobile: ${blocks} key blocks`);
for (const lang of LANGS) {
  const missing = missingByLang[lang];
  if (missing.length) {
    failed = true;
    console.error(`mobile:${lang} MISSING ${missing.length} keys:`);
    for (const k of missing) console.error(`  - ${k}`);
  } else {
    console.log(`mobile:${lang} complete`);
  }
}

if (failed) {
  console.error('\ni18n check FAILED');
  process.exit(1);
}
console.log('\ni18n check passed');
