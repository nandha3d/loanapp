#!/usr/bin/env node
/**
 * Literal-English scanner (I18N-3).
 *
 * `i18n-diff.ts` proves every dictionary key exists in every locale. It cannot
 * see the other half of the problem: copy that never became a key at all — an
 * English literal sitting in JSX, which no locale can translate.
 *
 *   npm run i18n:scan                 # summary + worst files
 *   npm run i18n:scan -- --file=app/(dashboard)/[module]/loans/new/LoanForm.tsx
 *   npm run i18n:scan -- --all        # every finding, not just the top files
 *   npm run i18n:scan -- --max=120    # exit 1 if the debt exceeds this
 *
 * Heuristic by nature: it reports candidates, not certainties. The number is a
 * debt figure to drive down, so a false positive costs a glance and a miss costs
 * a tenant an untranslated screen — it is tuned to over-report slightly.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['app', 'components'];

/** Attributes whose string value is read by a person. */
const COPY_ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'label', 'aria-description'];

/**
 * Literals that look like copy but are not. Icon ligatures are the big one:
 * `<span className="material-icons-outlined">autorenew</span>` is a glyph name,
 * not a word anyone reads.
 */
const MATERIAL_ICON_LINE = /material-icons/;
const NOT_COPY = new Set([
  'true', 'false', 'null', 'undefined', 'none', 'auto', 'flex', 'grid', 'block', 'inline',
  'center', 'left', 'right', 'top', 'bottom', 'row', 'column', 'wrap', 'nowrap', 'pointer',
  'bold', 'normal', 'hidden', 'visible', 'absolute', 'relative', 'fixed', 'sticky',
  'button', 'submit', 'reset', 'text', 'number', 'date', 'email', 'password', 'checkbox',
  'radio', 'file', 'hidden', 'search', 'tel', 'url', 'month', 'week', 'time',
  'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'application/json',
]);

/** A run of words that reads like a sentence or a label, not an identifier. */
function looksLikeCopy(raw) {
  const text = raw.trim();
  if (text.length < 3) return false;
  if (NOT_COPY.has(text)) return false;
  if (!/[A-Za-z]{2}/.test(text)) return false;                 // needs real letters
  if (/^[a-z0-9_]+$/.test(text) && !text.includes(' ')) return false; // identifier / css value
  if (/^[a-z]+(-[a-z0-9]+)+$/.test(text)) return false;        // kebab token
  if (/^(https?:|\/|\.\/|#|@|\$)/.test(text)) return false;    // url, path, selector
  if (/^\{.*\}$/.test(text)) return false;                     // an expression, not text
  if (/^[A-Z_]{3,}$/.test(text)) return false;                 // CONSTANT
  if (/^\d/.test(text) && !/[A-Za-z]{3}/.test(text)) return false;
  // Needs at least one word of 3+ letters — filters "px", "%s", "OK" style tokens
  return /[A-Za-z]{3}/.test(text);
}

function scanFile(absolute) {
  const relative = path.relative(ROOT, absolute).replace(/\\/g, '/');
  const source = fs.readFileSync(absolute, 'utf8');
  const lines = source.split(/\r?\n/);
  const findings = [];

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const trimmed = line.trim();

    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    if (MATERIAL_ICON_LINE.test(line)) return;

    // 1. JSX text between tags: >Some words<
    for (const m of line.matchAll(/>([^<>{}\n]{3,120})</g)) {
      const text = m[1];
      if (!looksLikeCopy(text)) continue;
      findings.push({ file: relative, line: lineNo, kind: 'jsx-text', text: text.trim() });
    }

    // 2. Copy-bearing attributes with a literal value
    for (const attr of COPY_ATTRS) {
      const re = new RegExp(`${attr}\\s*=\\s*(?:"([^"]{3,120})"|'([^']{3,120})')`, 'g');
      for (const m of line.matchAll(re)) {
        const text = m[1] ?? m[2];
        if (!looksLikeCopy(text)) continue;
        findings.push({ file: relative, line: lineNo, kind: attr, text });
      }
    }

    // 3. JSX prose that spans lines — a bare text line with no tag or expression
    //    on it. The single-line >text< rule above cannot see these, and they are
    //    usually the longest copy on the screen.
    if (
      !/[<>{}=()\[\];]/.test(trimmed) &&
      !trimmed.includes('//') &&
      !/^[)\]},;:]/.test(trimmed) &&
      !/[,;:'`"]$/.test(trimmed) &&
      trimmed.split(/\s+/).filter((w) => /^[A-Za-z][A-Za-z'-]{2,}$/.test(w)).length >= 3
    ) {
      findings.push({ file: relative, line: lineNo, kind: 'jsx-prose', text: trimmed.slice(0, 100) });
    }

    // 4. A dictionary fallback that hardcodes English: {d.foo || 'Interest-Only'}
    //    The fallback is what a locale missing the key actually shows.
    for (const m of line.matchAll(/\|\|\s*'([^']{3,80})'/g)) {
      const text = m[1];
      if (!looksLikeCopy(text)) continue;
      findings.push({ file: relative, line: lineNo, kind: 'dict-fallback', text });
    }
  });

  return findings;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, out);
    } else if (/\.tsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

const only = arg('file');
const showAll = process.argv.includes('--all');
const max = arg('max') ? Number(arg('max')) : null;

const files = only
  ? [path.resolve(ROOT, only)]
  : SCAN_DIRS.flatMap((d) => (fs.existsSync(path.join(ROOT, d)) ? walk(path.join(ROOT, d)) : []));

const all = files.flatMap(scanFile);

const byFile = new Map();
for (const f of all) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}
const ranked = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);

if (only || showAll) {
  for (const [file, findings] of ranked) {
    console.log(`\n${file}  (${findings.length})`);
    for (const f of findings) console.log(`  ${String(f.line).padStart(5)}  ${f.kind.padEnd(14)} ${f.text}`);
  }
} else {
  console.log('Files carrying the most untranslated literals:\n');
  for (const [file, findings] of ranked.slice(0, 25)) {
    console.log(`  ${String(findings.length).padStart(4)}  ${file}`);
  }
  console.log('\n  (--all for every finding, --file=<path> for one file)');
}

const byKind = new Map();
for (const f of all) byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);

console.log(`\nScanned ${files.length} .tsx files in ${SCAN_DIRS.join(', ')}`);
console.log(`Literal English candidates: ${all.length} across ${byFile.size} files`);
for (const [kind, count] of [...byKind].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(5)}  ${kind}`);
}

if (max != null && all.length > max) {
  console.error(`\ni18n scan FAILED — ${all.length} literals exceeds the agreed ceiling of ${max}`);
  process.exit(1);
}
