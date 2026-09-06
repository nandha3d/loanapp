#!/usr/bin/env node
/**
 * Joins a module test-case catalogue with the last Playwright run and renders
 * its tracker page.
 *
 *   node scripts/build-suite-report.mjs chitfunds
 *
 *   in  tests/e2e/<suite>/cases.ts          the catalogue (source of truth)
 *   in  test-report/<suite>-results.json    Playwright JSON reporter output
 *   out test-report/<suite>.html            the page you open / publish
 *
 * A case with no matching spec is reported "not automated yet" rather than
 * silently dropped — an untested case must stay visible.
 *
 * This builder is shared by every module suite added after micro-lending.
 * scripts/build-ml-report.mjs stays as it is: its output is already published
 * and frozen, and re-pointing it here would change a shipped page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Per-suite identity. Each module gets its own accent so two tabs open side by
 * side are told apart at a glance — the chit register is registrar teal, auto
 * finance will be something else.
 */
const SUITES = {
  chitfunds: {
    dir: 'chitfunds',
    prefix: 'CF',
    label: 'Chit Funds Test Register',
    eyebrow: 'ZoloFund · Chit Funds',
    blurb: 'Auction, security gate and subscription coverage',
    accent: { light: '#0f4f4a', dark: '#5fbdb2' },
  },
  autofinance: {
    dir: 'autofinance',
    prefix: 'AUTO',
    label: 'Auto Finance Test Register',
    eyebrow: 'ZoloFund · Auto Finance',
    blurb: 'Hire-purchase, vehicle registry and field-operations coverage',
    // Violet-slate: distinct from the chit register's teal, and clear of the
    // green/red/amber the verdicts already own.
    accent: { light: '#4b3f8f', dark: '#a99bf0' },
  },
  goldloan: {
    dir: 'goldloan',
    prefix: 'GL',
    label: 'Gold Loan Test Register',
    eyebrow: 'ZoloFund · Gold Loan',
    blurb: 'Valuation, RBI loan-to-value ceilings and pledge servicing coverage',
    // Deep bronze — the metal, kept dark enough to stay clear of the amber
    // the manual verdict already owns.
    accent: { light: '#7a5312', dark: '#d8a34a' },
  },
  securedloans: {
    dir: 'securedloans',
    prefix: 'PPF',
    label: 'Secured Lending Test Register',
    eyebrow: 'ZoloFund · Property & Product Finance',
    blurb: 'Collateral capture, custody and release across both secured modules',
    // Slate green — clear of the other suites and of the verdict colours.
    accent: { light: '#2f5d50', dark: '#7fc4ad' },
  },
};

const suiteKey = process.argv[2];
const SUITE = SUITES[suiteKey];
if (!SUITE) {
  console.error(`Unknown suite "${suiteKey ?? ''}". Known: ${Object.keys(SUITES).join(', ')}`);
  process.exit(1);
}

const CASES_TS = path.join(ROOT, 'tests', 'e2e', SUITE.dir, 'cases.ts');
const RESULTS = path.join(ROOT, 'test-report', `${suiteKey}-results.json`);
const OUT = path.join(ROOT, 'test-report', `${suiteKey}.html`);
const LEDGER = path.join(ROOT, 'test-report', `${suiteKey}-ledger.json`);

// ── Catalogue ──────────────────────────────────────────────────────────────
// cases.ts is a plain data module; evaluating the array literal avoids adding a
// TS loader to this script's dependency chain.
function readCases() {
  const src = fs.readFileSync(CASES_TS, 'utf8');
  const start = src.indexOf('export const CASES');
  const eq = src.indexOf('=', start);
  const open = src.indexOf('[', eq);
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error(`Could not locate the CASES array in ${path.relative(ROOT, CASES_TS)}`);
  // eslint-disable-next-line no-new-func
  return new Function(`return (${src.slice(open, end)});`)();
}

function readAreas() {
  const src = fs.readFileSync(CASES_TS, 'utf8');
  const start = src.indexOf('export const AREAS');
  if (start < 0) return null;
  const open = src.indexOf('[', start);
  const close = src.indexOf(']', open);
  // eslint-disable-next-line no-new-func
  return new Function(`return (${src.slice(open, close + 1)});`)();
}

// ── Playwright results ─────────────────────────────────────────────────────
// A spec may claim more than one case when a single run proves several of them
// — one confirmed auction settles the whole worked calculation, and splitting
// it into four runs would re-do the same setup four times to assert four fields
// of the same row. Every id in the title gets the run's verdict.
const ID_RE = new RegExp(`\\[(${SUITE.prefix}-\\d+)\\]`, 'g');

function collectResults() {
  if (!fs.existsSync(RESULTS)) return { byId: new Map(), stats: null, orphans: [] };
  const report = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  const byId = new Map();
  const orphans = [];

  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      const ids = [...String(spec.title).matchAll(ID_RE)].map((m) => m[1]);
      const run = spec.tests?.[0]?.results?.[spec.tests[0].results.length - 1];
      const entry = {
        title: spec.title,
        file: suite.file ?? spec.file ?? '',
        line: spec.line ?? 0,
        status: run?.status ?? 'unknown',
        durationMs: run?.duration ?? 0,
        error: cleanError(run?.error?.message ?? run?.errors?.[0]?.message ?? ''),
      };
      if (ids.length) for (const id of ids) byId.set(id, entry);
      else orphans.push(entry);
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);

  return { byId, stats: report.stats ?? null, orphans };
}

/**
 * Carry verdicts forward across runs.
 *
 * A targeted re-run of one spec file produces a JSON containing only that file,
 * which would otherwise blank every other case back to "not run". The ledger
 * keeps the last known verdict per case and stamps when it was observed, so a
 * partial run updates exactly the cases it covered and the page stays honest
 * about the age of the rest.
 */
function mergeIntoLedger(fresh) {
  const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : { cases: {} };
  const observedAt = fresh.stats?.startTime ?? new Date().toISOString();

  for (const [id, entry] of fresh.byId) ledger.cases[id] = { ...entry, observedAt };
  ledger.lastRunAt = observedAt;
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2), 'utf8');

  return { ...fresh, byId: new Map(Object.entries(ledger.cases)), ledgerRunAt: ledger.lastRunAt };
}

function cleanError(msg) {
  return String(msg || '')
    .replace(/?\[[0-9;]*m/g, '')
    .split('\n')
    .slice(0, 14)
    .join('\n')
    .trim();
}

function verdictFor(testCase, result) {
  if (!result) {
    return testCase.automation === 'manual'
      ? { key: 'manual', label: 'Manual' }
      : { key: 'notrun', label: 'Not run' };
  }
  if (result.status === 'passed') return { key: 'passed', label: 'Passed' };
  if (result.status === 'failed' || result.status === 'timedOut') return { key: 'failed', label: 'Failed' };
  if (result.status === 'skipped') return { key: 'skipped', label: 'Skipped' };
  return { key: 'notrun', label: result.status || 'Not run' };
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const stamp = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().replace('T', ' ').slice(0, 19);
};

const duration = (ms) => (!ms ? '' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

const firstLine = (err) => String(err || '').split('\n').find((l) => l.trim()) ?? '';

// ── Render ─────────────────────────────────────────────────────────────────
function renderCase(row) {
  const { c, verdict, result } = row;
  const search = [c.id, c.title, c.area, ...(c.rules ?? [])].join(' ').toLowerCase();

  return `<details class="case" id="${esc(c.id)}" data-verdict="${verdict.key}" data-search="${esc(search)}">
  <summary>
    <span class="cid">${esc(c.id)}</span>
    <span class="ctitle">${esc(c.title)}</span>
    <span class="cmeta">
      ${result?.durationMs ? `<span class="dur">${duration(result.durationMs)}</span>` : ''}
      <span class="pri pri-${esc(c.priority)}">${esc(c.priority)}</span>
      <span class="verdict v-${verdict.key}">${esc(verdict.label)}</span>
    </span>
  </summary>
  <div class="cbody">
    ${c.pre ? `<p class="pre"><span class="tag">Pre</span>${esc(c.pre)}</p>` : ''}
    <div class="grid">
      <div>
        <h4>Steps</h4>
        <ol>${c.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      </div>
      <div>
        <h4>Expected</h4>
        <ul>${c.expected.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
      </div>
    </div>
    ${c.rules?.length ? `<p class="rules">${c.rules.map((r) => `<span class="rule">${esc(r)}</span>`).join('')}</p>` : ''}
    ${result ? `<p class="where"><span class="tag">Spec</span><code>${esc(path.basename(result.file || ''))}</code>${result.line ? `:${result.line}` : ''} · observed ${stamp(result.observedAt)}</p>` : ''}
    ${result?.error ? `<pre class="err">${esc(result.error)}</pre>` : ''}
  </div>
</details>`;
}

function render(cases, areas, results) {
  const rows = cases.map((c) => {
    const result = results.byId.get(c.id) ?? null;
    return { c, result, verdict: verdictFor(c, result) };
  });

  const count = (key) => rows.filter((r) => r.verdict.key === key).length;
  const passed = count('passed');
  const failed = count('failed');
  const notrun = count('notrun');
  const manual = count('manual');
  const skipped = count('skipped');
  const executed = passed + failed;
  const rate = executed ? Math.round((passed / executed) * 100) : 0;
  const total = rows.length;
  const pct = (n) => (total ? ((n / total) * 100).toFixed(2) : '0');

  const order = areas ?? [...new Set(cases.map((c) => c.area))];
  const byArea = order
    .map((area) => ({ area, items: rows.filter((r) => r.c.area === area) }))
    .filter((g) => g.items.length);

  const failures = rows.filter((r) => r.verdict.key === 'failed');

  return `<title>${esc(SUITE.label)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Public+Sans:wght@400;500;600;700&family=Zilla+Slab:wght@600;700&display=swap">
<style>
  /* A statutory register, read as a control panel: the verdict is carried by an
     edge stripe and a chip, so state reads before any word does. */
  :root {
    --ground: #eceee9; --sheet: #ffffff; --sheet-2: #e4e7e2;
    --ink: #141917; --ink-soft: #5b6662; --rule: #cdd4ce;
    --accent: ${SUITE.accent.light};
    --pass: #1b6b3a; --pass-bg: #e0efe5;
    --fail: #a12a20; --fail-bg: #f8e6e3;
    --notrun: #59636b; --notrun-bg: #e6e9e6;
    --manual: #8a5b12; --manual-bg: #f5eddd;
    --skip: #4e5a58; --skip-bg: #e5e9e7;
    --display: "Zilla Slab", Georgia, serif;
    --body: "Public Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #0d1211; --sheet: #141a19; --sheet-2: #1a2220;
      --ink: #e4e9e6; --ink-soft: #93a09b; --rule: #293331;
      --accent: ${SUITE.accent.dark};
      --pass: #54c98a; --pass-bg: #102c1d;
      --fail: #ff8b80; --fail-bg: #351a18;
      --notrun: #95a09f; --notrun-bg: #1f2827;
      --manual: #dfae5c; --manual-bg: #2c2516;
      --skip: #93a09b; --skip-bg: #1e2725;
    }
  }
  :root[data-theme="dark"] {
    --ground: #0d1211; --sheet: #141a19; --sheet-2: #1a2220;
    --ink: #e4e9e6; --ink-soft: #93a09b; --rule: #293331;
    --accent: ${SUITE.accent.dark};
    --pass: #54c98a; --pass-bg: #102c1d;
    --fail: #ff8b80; --fail-bg: #351a18;
    --notrun: #95a09f; --notrun-bg: #1f2827;
    --manual: #dfae5c; --manual-bg: #2c2516;
    --skip: #93a09b; --skip-bg: #1e2725;
  }

  * { box-sizing: border-box; }
  body { background: var(--ground); color: var(--ink); font-family: var(--body); line-height: 1.5; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 40px 20px 80px; display: flex; flex-direction: column; gap: 28px; }

  header { display: flex; flex-direction: column; gap: 10px; }
  .eyebrow { margin: 0; font-size: .72rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); }
  h1 { margin: 0; font-family: var(--display); font-weight: 700; font-size: clamp(1.9rem, 4vw, 2.6rem); text-wrap: balance; }
  .runmeta { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: .82rem; color: var(--ink-soft); }
  .runmeta code, .runmeta time { font-family: var(--mono); font-size: .78rem; color: var(--ink); }

  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
  .tile { background: var(--sheet); border: 1px solid var(--rule); border-radius: 3px; padding: 14px 16px; display: flex; flex-direction: column; gap: 2px; }
  .tile .n { font-family: var(--mono); font-weight: 700; font-size: 1.7rem; font-variant-numeric: tabular-nums; }
  .tile .l { font-size: .74rem; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-soft); }
  .t-passed .n { color: var(--pass); } .t-failed .n { color: var(--fail); }
  .t-notrun .n { color: var(--notrun); } .t-manual .n { color: var(--manual); } .t-skipped .n { color: var(--skip); }

  .bar { display: flex; height: 8px; border-radius: 2px; overflow: hidden; background: var(--sheet-2); }
  .bar i { display: block; height: 100%; }
  .b-passed { background: var(--pass); } .b-failed { background: var(--fail); }
  .b-manual { background: var(--manual); } .b-notrun { background: var(--notrun); } .b-skipped { background: var(--skip); }
  .rate { margin: -18px 0 0; font-size: .86rem; color: var(--ink-soft); }
  .rate b { font-family: var(--mono); color: var(--ink); }

  .failures { background: var(--sheet); border: 1px solid var(--rule); border-left: 3px solid var(--fail); border-radius: 3px; padding: 18px 22px; }
  .failures h2 { margin: 0 0 12px; font-family: var(--display); font-size: 1.15rem; }
  .failures ol { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 12px; }
  .failures a { color: var(--ink); text-decoration: none; font-weight: 600; }
  .failures a:hover { color: var(--accent); }
  .failures .why { margin: 2px 0 0; font-family: var(--mono); font-size: .76rem; color: var(--fail); overflow-wrap: anywhere; }

  .filters { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
    background: var(--ground); padding: 10px 0; border-bottom: 1px solid var(--rule); }
  .filters input { flex: 1 1 220px; min-width: 180px; font: inherit; font-size: .86rem; padding: 7px 11px;
    background: var(--sheet); color: var(--ink); border: 1px solid var(--rule); border-radius: 3px; }
  .filters input:focus-visible, .chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .chip { font: inherit; font-size: .76rem; font-weight: 600; padding: 6px 11px; border-radius: 999px; cursor: pointer;
    background: var(--sheet); color: var(--ink-soft); border: 1px solid var(--rule); }
  .chip[aria-pressed="true"] { background: var(--ink); color: var(--ground); border-color: var(--ink); }

  section.area { display: flex; flex-direction: column; gap: 6px; }
  section.area > h2 { margin: 14px 0 2px; font-family: var(--display); font-size: 1.05rem; display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; }
  .areachips { display: inline-flex; gap: 6px; }
  .areachip { font-family: var(--mono); font-size: .68rem; font-weight: 500; padding: 2px 7px; border-radius: 2px; }
  .ac-passed { background: var(--pass-bg); color: var(--pass); }
  .ac-failed { background: var(--fail-bg); color: var(--fail); }
  .ac-manual { background: var(--manual-bg); color: var(--manual); }
  .ac-notrun { background: var(--notrun-bg); color: var(--notrun); }
  .ac-skipped { background: var(--skip-bg); color: var(--skip); }

  details.case { background: var(--sheet); border: 1px solid var(--rule); border-left: 3px solid var(--notrun); border-radius: 2px; }
  details.case[data-verdict="passed"] { border-left-color: var(--pass); }
  details.case[data-verdict="failed"] { border-left-color: var(--fail); }
  details.case[data-verdict="manual"] { border-left-color: var(--manual); }
  details.case[data-verdict="skipped"] { border-left-color: var(--skip); }
  details.case + details.case { margin-top: 4px; }
  summary { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: baseline; padding: 9px 14px; cursor: pointer; }
  summary::-webkit-details-marker { display: none; }
  summary:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .cid { font-family: var(--mono); font-size: .76rem; font-weight: 700; color: var(--accent); }
  .ctitle { flex: 1 1 320px; font-size: .9rem; }
  .cmeta { display: inline-flex; gap: 8px; align-items: baseline; margin-left: auto; }
  .dur, .pri { font-family: var(--mono); font-size: .7rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
  .pri-P0 { color: var(--fail); font-weight: 700; }
  .verdict { font-size: .7rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; padding: 2px 8px; border-radius: 2px; }
  .v-passed { background: var(--pass-bg); color: var(--pass); }
  .v-failed { background: var(--fail-bg); color: var(--fail); }
  .v-manual { background: var(--manual-bg); color: var(--manual); }
  .v-notrun { background: var(--notrun-bg); color: var(--notrun); }
  .v-skipped { background: var(--skip-bg); color: var(--skip); }

  .cbody { padding: 4px 16px 16px; border-top: 1px solid var(--rule); display: flex; flex-direction: column; gap: 12px; }
  .cbody h4 { margin: 12px 0 4px; font-size: .72rem; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-soft); }
  .cbody ol, .cbody ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; font-size: .86rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 4px 28px; }
  .tag { font-size: .66rem; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--ink-soft); margin-right: 8px; }
  .pre, .where { margin: 0; font-size: .82rem; color: var(--ink-soft); }
  .where code { font-family: var(--mono); font-size: .76rem; color: var(--ink); }
  .rules { margin: 0; display: flex; flex-wrap: wrap; gap: 5px; }
  .rule { font-family: var(--mono); font-size: .68rem; padding: 2px 7px; border: 1px solid var(--rule); border-radius: 2px; color: var(--ink-soft); }
  pre.err { margin: 0; padding: 12px 14px; background: var(--fail-bg); color: var(--fail); border-radius: 2px;
    font-family: var(--mono); font-size: .76rem; line-height: 1.45; white-space: pre-wrap; overflow-x: auto; }

  .empty { display: none; padding: 40px 0; text-align: center; color: var(--ink-soft); font-size: .9rem; }
  body.filtering .empty.on { display: block; }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>

<div class="wrap">
  <header>
    <p class="eyebrow">${esc(SUITE.eyebrow)}</p>
    <h1>${esc(SUITE.label)}</h1>
    <ul class="runmeta">
      <li><code>${total}</code> cases · <code>${byArea.length}</code> areas</li>
      <li>${esc(SUITE.blurb)}</li>
      <li>Database <code>${esc(process.env.QA_DB_LABEL || 'loantrack_qa')}</code></li>
      <li>Runner <code>Playwright</code></li>
      <li>Last run <time>${stamp(results.ledgerRunAt)}</time></li>
      <li>Page built <time>${stamp(new Date().toISOString())}</time></li>
    </ul>
  </header>

  <div class="summary">
    <div class="tile t-passed"><span class="n">${passed}</span><span class="l">Passed</span></div>
    <div class="tile t-failed"><span class="n">${failed}</span><span class="l">Failed</span></div>
    <div class="tile t-notrun"><span class="n">${notrun}</span><span class="l">Not run</span></div>
    <div class="tile t-manual"><span class="n">${manual}</span><span class="l">Manual</span></div>
    <div class="tile t-skipped"><span class="n">${skipped}</span><span class="l">Skipped</span></div>
  </div>

  <div class="bar">
    <i class="b-passed" style="width:${pct(passed)}%"></i><i class="b-failed" style="width:${pct(failed)}%"></i><i class="b-notrun" style="width:${pct(notrun)}%"></i><i class="b-manual" style="width:${pct(manual)}%"></i><i class="b-skipped" style="width:${pct(skipped)}%"></i>
  </div>
  <p class="rate">Pass rate over executed cases: <b>${rate}%</b> (${passed} of ${executed})</p>

  ${failures.length ? `<section class="failures">
    <h2>What went wrong</h2>
    <ol>
      ${failures
        .map(
          (r) => `<li>
        <a href="#${esc(r.c.id)}"><span class="cid">${esc(r.c.id)}</span> ${esc(r.c.title)}</a>
        <p class="why">${esc(firstLine(r.result?.error))}</p>
        ${r.c.rules?.length ? `<p class="rules">${r.c.rules.map((x) => `<span class="rule">${esc(x)}</span>`).join('')}</p>` : ''}
      </li>`,
        )
        .join('')}
    </ol>
  </section>` : ''}

  <div class="filters">
    <input id="q" type="search" placeholder="Filter by id, title, area or rule…" aria-label="Filter cases">
    <button class="chip" data-v="all" aria-pressed="true">All</button>
    <button class="chip" data-v="failed" aria-pressed="false">Failed</button>
    <button class="chip" data-v="passed" aria-pressed="false">Passed</button>
    <button class="chip" data-v="notrun" aria-pressed="false">Not run</button>
    <button class="chip" data-v="manual" aria-pressed="false">Manual</button>
  </div>

  <main>
    ${byArea
      .map(({ area, items }) => {
        const chips = ['passed', 'failed', 'notrun', 'manual', 'skipped']
          .map((k) => ({ k, n: items.filter((i) => i.verdict.key === k).length }))
          .filter((x) => x.n)
          .map((x) => `<span class="areachip ac-${x.k}">${x.n} ${x.k === 'notrun' ? 'not run' : x.k}</span>`)
          .join('');
        return `<section class="area" data-area="${esc(area)}">
      <h2>${esc(area)} <span class="areachips">${chips}</span></h2>
      ${items.map(renderCase).join('\n')}
    </section>`;
      })
      .join('\n')}
    <p class="empty on">No case matches this filter.</p>
  </main>
</div>

<script>
(function () {
  var q = document.getElementById('q');
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var cases = Array.prototype.slice.call(document.querySelectorAll('details.case'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('section.area'));
  var verdict = 'all';

  function apply() {
    var term = q.value.trim().toLowerCase();
    var shown = 0;
    cases.forEach(function (el) {
      var okV = verdict === 'all' || el.dataset.verdict === verdict;
      var okQ = !term || el.dataset.search.indexOf(term) !== -1;
      var show = okV && okQ;
      el.hidden = !show;
      if (show) shown++;
    });
    sections.forEach(function (s) {
      var any = Array.prototype.some.call(s.querySelectorAll('details.case'), function (el) { return !el.hidden; });
      s.hidden = !any;
    });
    document.body.classList.toggle('filtering', shown === 0);
  }

  q.addEventListener('input', apply);
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      verdict = c.dataset.v;
      chips.forEach(function (o) { o.setAttribute('aria-pressed', String(o === c)); });
      apply();
    });
  });
  apply();
})();
</script>`;
}

// ── Main ───────────────────────────────────────────────────────────────────
const cases = readCases();
const areas = readAreas();
const results = mergeIntoLedger(collectResults());

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, render(cases, areas, results), 'utf8');

const summary = cases.reduce((acc, c) => {
  const v = verdictFor(c, results.byId.get(c.id) ?? null).key;
  acc[v] = (acc[v] || 0) + 1;
  return acc;
}, {});
console.log(
  `${suiteKey} report → ${path.relative(ROOT, OUT)}  ` +
    Object.entries(summary).map(([k, v]) => `${k}:${v}`).join('  '),
);
if (results.orphans.length) {
  console.log(`note: ${results.orphans.length} spec(s) ran without a [${SUITE.prefix}-xxx] id in the title`);
}
