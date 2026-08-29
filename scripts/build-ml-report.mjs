#!/usr/bin/env node
/**
 * Joins the micro-lending test-case catalogue with the last Playwright run and
 * renders the tracker page.
 *
 *   in  tests/e2e/microlending/cases.ts        the catalogue (source of truth)
 *   in  test-report/microlending-results.json  Playwright JSON reporter output
 *   out test-report/microlending.html          the page you open / publish
 *
 * A case with no matching spec is reported "not automated yet" rather than
 * silently dropped — an untested case must stay visible.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASES_TS = path.join(ROOT, 'tests', 'e2e', 'microlending', 'cases.ts');
const RESULTS = path.join(ROOT, 'test-report', 'microlending-results.json');
const OUT = path.join(ROOT, 'test-report', 'microlending.html');
const LEDGER = path.join(ROOT, 'test-report', 'microlending-ledger.json');

// ── Catalogue ──────────────────────────────────────────────────────────────
// cases.ts is a plain data module; evaluating the array literal avoids adding a
// TS loader to this script's dependency chain.
function readCases() {
  const src = fs.readFileSync(CASES_TS, 'utf8');
  const start = src.indexOf('export const CASES');
  // The declaration is `export const CASES: MlCase[] = [` — anchor on the `=`
  // so the empty brackets of the type annotation are not mistaken for the array.
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
  if (end < 0) throw new Error('Could not locate the CASES array in cases.ts');
  const literal = src.slice(open, end);
  // eslint-disable-next-line no-new-func
  return new Function(`return (${literal});`)();
}

// ── Playwright results ─────────────────────────────────────────────────────
const ID_RE = /\[(ML-\d+)\]/;

function collectResults() {
  if (!fs.existsSync(RESULTS)) return { byId: new Map(), stats: null, orphans: [] };
  const report = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  const byId = new Map();
  const orphans = [];

  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      const match = ID_RE.exec(spec.title);
      const run = spec.tests?.[0]?.results?.[spec.tests[0].results.length - 1];
      const entry = {
        title: spec.title,
        file: suite.file ?? spec.file ?? '',
        line: spec.line ?? 0,
        status: run?.status ?? 'unknown',
        durationMs: run?.duration ?? 0,
        error: cleanError(run?.error?.message ?? run?.errors?.[0]?.message ?? ''),
        attachments: (run?.attachments ?? [])
          .filter((a) => a.name === 'screenshot' || a.name === 'trace')
          .map((a) => ({ name: a.name, path: relPath(a.path) })),
      };
      if (match) byId.set(match[1], entry);
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

  for (const [id, entry] of fresh.byId) {
    ledger.cases[id] = { ...entry, observedAt };
  }
  ledger.lastRunAt = observedAt;
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2), 'utf8');

  const byId = new Map(Object.entries(ledger.cases));
  return { ...fresh, byId, ledgerRunAt: ledger.lastRunAt };
}

const relPath = (p) => (p ? path.relative(ROOT, p).replace(/\\/g, '/') : '');

function cleanError(msg) {
  return String(msg || '')
    // strip ANSI colour codes the reporter embeds
    .replace(/\[[0-9;]*m/g, '')
    .split('\n')
    .slice(0, 14)
    .join('\n')
    .trim();
}

// ── Verdict per case ───────────────────────────────────────────────────────
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

// ── Render ─────────────────────────────────────────────────────────────────
function render(cases, results) {
  const rows = cases.map((c) => {
    const result = results.byId.get(c.id) ?? null;
    return { ...c, result, verdict: verdictFor(c, result) };
  });

  const counts = rows.reduce((acc, r) => {
    acc[r.verdict.key] = (acc[r.verdict.key] || 0) + 1;
    return acc;
  }, {});
  const executed = (counts.passed || 0) + (counts.failed || 0);
  const passRate = executed ? Math.round(((counts.passed || 0) / executed) * 100) : 0;

  const areas = [];
  for (const row of rows) {
    let area = areas.find((a) => a.name === row.area);
    if (!area) {
      area = { name: row.area, rows: [] };
      areas.push(area);
    }
    area.rows.push(row);
  }

  const generated = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const lastRun = results.ledgerRunAt ?? results.stats?.startTime ?? null;
  const runAt = lastRun ? new Date(lastRun).toISOString().replace('T', ' ').slice(0, 19) : null;

  const summaryCards = [
    { key: 'passed', label: 'Passed', value: counts.passed || 0 },
    { key: 'failed', label: 'Failed', value: counts.failed || 0 },
    { key: 'notrun', label: 'Not run', value: counts.notrun || 0 },
    { key: 'manual', label: 'Manual', value: counts.manual || 0 },
    { key: 'skipped', label: 'Skipped', value: counts.skipped || 0 },
  ];

  const areaSections = areas
    .map((area) => {
      const areaCounts = area.rows.reduce((acc, r) => {
        acc[r.verdict.key] = (acc[r.verdict.key] || 0) + 1;
        return acc;
      }, {});
      const chips = ['passed', 'failed', 'notrun', 'manual', 'skipped']
        .filter((k) => areaCounts[k])
        .map((k) => `<span class="chip chip-${k}">${areaCounts[k]} ${verdictLabel(k)}</span>`)
        .join('');

      const cards = area.rows.map(renderCase).join('\n');
      return `
      <section class="area" data-area="${esc(area.name)}">
        <h2>${esc(area.name)} <span class="area-chips">${chips}</span></h2>
        <div class="cases">${cards}</div>
      </section>`;
    })
    .join('\n');

  return `<title>Micro Lending Test Ledger</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>
  /* A lending ledger, read as a control panel: ink-blue rules on paper,
     verdict carried by an edge stripe so state reads before any word does. */
  :root {
    --paper: #f4f5f2; --sheet: #ffffff; --sheet-2: #eceee9;
    --ink: #14181f; --ink-soft: #5a6270; --rule: #d8dbd4;
    --accent: #1f4e79;
    --pass: #0f6b3f; --pass-bg: #e2efe6;
    --fail: #a52b1e; --fail-bg: #f8e7e4;
    --notrun: #63696f; --notrun-bg: #e8eae6;
    --manual: #8a5a12; --manual-bg: #f6eddc;
    --skip: #4f5762; --skip-bg: #e6e9e6;
    --sans: "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper: #0f1216; --sheet: #161a20; --sheet-2: #1c2129;
      --ink: #e6e9ee; --ink-soft: #99a2af; --rule: #2b323c;
      --accent: #7fb0e0;
      --pass: #5cc98d; --pass-bg: #10301f;
      --fail: #ff8b80; --fail-bg: #37191a;
      --notrun: #9aa3ae; --notrun-bg: #212730;
      --manual: #e2b45f; --manual-bg: #2e2617;
      --skip: #98a1ac; --skip-bg: #20262e;
    }
  }
  :root[data-theme="dark"] {
    --paper: #0f1216; --sheet: #161a20; --sheet-2: #1c2129;
    --ink: #e6e9ee; --ink-soft: #99a2af; --rule: #2b323c;
    --accent: #7fb0e0;
    --pass: #5cc98d; --pass-bg: #10301f;
    --fail: #ff8b80; --fail-bg: #37191a;
    --notrun: #9aa3ae; --notrun-bg: #212730;
    --manual: #e2b45f; --manual-bg: #2e2617;
    --skip: #98a1ac; --skip-bg: #20262e;
  }

  body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans); font-size: 15px; line-height: 1.55; }
  .wrap { max-width: 1120px; margin: 0 auto; padding: 40px 20px 90px; }

  .eyebrow { font-family: var(--mono); font-size: .72rem; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); margin: 0 0 10px; }
  header h1 { margin: 0 0 10px; font-size: 2.1rem; font-weight: 600; letter-spacing: -0.025em; text-wrap: balance; }
  .runmeta { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0 0 30px; padding: 0; list-style: none; color: var(--ink-soft); font-size: .84rem; }
  .runmeta code, .runmeta time { font-family: var(--mono); font-size: .95em; color: var(--ink); }

  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 1px; background: var(--rule); border: 1px solid var(--rule); border-radius: 4px; overflow: hidden; }
  .card { background: var(--sheet); padding: 16px 18px; }
  .card .n { font-family: var(--mono); font-size: 1.85rem; font-weight: 500; line-height: 1.05; font-variant-numeric: tabular-nums; }
  .card .l { color: var(--ink-soft); font-size: .72rem; text-transform: uppercase; letter-spacing: .1em; margin-top: 4px; }
  .card-passed .n { color: var(--pass); } .card-failed .n { color: var(--fail); }
  .card-manual .n { color: var(--manual); } .card-notrun .n { color: var(--notrun); } .card-skipped .n { color: var(--skip); }

  .bar { height: 8px; display: flex; margin: 20px 0 8px; background: var(--sheet-2); border-radius: 2px; overflow: hidden; }
  .bar i { display: block; height: 100%; }
  .bar .b-passed { background: var(--pass); } .bar .b-failed { background: var(--fail); }
  .bar .b-notrun { background: var(--notrun); } .bar .b-manual { background: var(--manual); }
  .bar .b-skipped { background: var(--skip); }
  .rate { color: var(--ink-soft); font-size: .85rem; margin: 0 0 28px; }
  .rate b { color: var(--ink); font-family: var(--mono); font-variant-numeric: tabular-nums; }

  .findings { border: 1px solid var(--fail); border-left-width: 3px; border-radius: 3px; background: var(--sheet); padding: 16px 20px 18px; margin-bottom: 28px; }
  .findings h2 { margin: 0 0 12px; font-size: .95rem; font-weight: 600; color: var(--fail); }
  .finding-list { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 12px; }
  .finding-list a { color: var(--ink); text-decoration: none; }
  .finding-list a:hover { text-decoration: underline; }
  .finding-why { color: var(--ink-soft); font-size: .85rem; margin-top: 2px; }
  .finding-list .rules { margin-top: 6px; }

  .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 26px; position: sticky; top: 0; padding: 14px 0; background: var(--paper); z-index: 5; border-bottom: 1px solid var(--rule); }
  .filters button {
    font: inherit; font-size: .82rem; cursor: pointer; padding: 5px 13px; border-radius: 3px;
    border: 1px solid var(--rule); background: var(--sheet); color: var(--ink-soft);
  }
  .filters button:hover { color: var(--ink); }
  .filters button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); font-weight: 600; }
  .filters button:focus-visible, .filters input:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .filters input {
    font: inherit; font-size: .82rem; padding: 5px 13px; border-radius: 3px; flex: 1; min-width: 190px;
    border: 1px solid var(--rule); background: var(--sheet); color: var(--ink);
  }

  .area { margin-bottom: 36px; }
  .area h2 { font-size: .95rem; font-weight: 600; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid var(--rule); display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .area-chips { display: inline-flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
  .chip { font-family: var(--mono); font-size: .68rem; font-weight: 500; padding: 2px 7px; border-radius: 2px; }
  .chip-passed { background: var(--pass-bg); color: var(--pass); }
  .chip-failed { background: var(--fail-bg); color: var(--fail); }
  .chip-notrun { background: var(--notrun-bg); color: var(--notrun); }
  .chip-manual { background: var(--manual-bg); color: var(--manual); }
  .chip-skipped { background: var(--skip-bg); color: var(--skip); }

  .cases { display: flex; flex-direction: column; gap: 6px; }
  details.tc { background: var(--sheet); border: 1px solid var(--rule); border-left: 3px solid var(--notrun); border-radius: 3px; overflow: hidden; }
  details.tc[data-verdict="passed"] { border-left-color: var(--pass); }
  details.tc[data-verdict="failed"] { border-left-color: var(--fail); }
  details.tc[data-verdict="manual"] { border-left-color: var(--manual); }
  details.tc[data-verdict="skipped"] { border-left-color: var(--skip); }
  summary { cursor: pointer; padding: 11px 14px; display: grid; grid-template-columns: 76px 1fr auto; gap: 14px; align-items: center; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  .tid { font-family: var(--mono); font-size: .78rem; color: var(--ink-soft); }
  .ttitle { font-weight: 400; }
  .meta { display: flex; gap: 10px; align-items: center; }
  .pri { font-family: var(--mono); font-size: .68rem; color: var(--ink-soft); }
  .verdict { font-family: var(--mono); font-size: .7rem; font-weight: 500; padding: 3px 9px; border-radius: 2px; white-space: nowrap; text-transform: uppercase; letter-spacing: .05em; }
  .v-passed { background: var(--pass-bg); color: var(--pass); }
  .v-failed { background: var(--fail-bg); color: var(--fail); }
  .v-notrun { background: var(--notrun-bg); color: var(--notrun); }
  .v-manual { background: var(--manual-bg); color: var(--manual); }
  .v-skipped { background: var(--skip-bg); color: var(--skip); }

  .body { padding: 2px 16px 18px; border-top: 1px solid var(--rule); background: var(--sheet-2); }
  .body h4 { margin: 15px 0 6px; font-family: var(--mono); font-size: .69rem; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-soft); font-weight: 500; }
  .body p { margin: 0; max-width: 68ch; }
  .body ol, .body ul { margin: 0; padding-left: 20px; max-width: 68ch; }
  .body li { margin: 3px 0; }
  .body code { font-family: var(--mono); font-size: .85em; }
  .rules { display: flex; gap: 6px; flex-wrap: wrap; }
  .rule { font-family: var(--mono); font-size: .71rem; background: var(--sheet); border: 1px solid var(--rule); border-radius: 2px; padding: 1px 6px; color: var(--accent); }
  pre.err { margin: 6px 0 0; padding: 11px 13px; background: var(--fail-bg); color: var(--fail); border-radius: 3px; font-family: var(--mono); font-size: .77rem; overflow-x: auto; white-space: pre-wrap; }
  .dur { font-family: var(--mono); font-size: .72rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
  footer { margin-top: 44px; color: var(--ink-soft); font-size: .8rem; border-top: 1px solid var(--rule); padding-top: 16px; }
  footer code { font-family: var(--mono); }
  @media (max-width: 640px) {
    summary { grid-template-columns: 66px 1fr; }
    .meta { grid-column: 1 / -1; }
    .area-chips { margin-left: 0; }
  }
</style>

<div class="wrap">
  <header>
    <p class="eyebrow">ZoloFund · Micro Lending</p>
    <h1>Micro Lending Test Ledger</h1>
    <ul class="runmeta">
      <li><code>${cases.length}</code> cases · <code>${areas.length}</code> areas</li>
      <li>Database <code>loantrack_qa</code></li>
      <li>Runner <code>Playwright</code></li>
      ${runAt ? `<li>Last run <time>${esc(runAt)}</time></li>` : ''}
      <li>Page built <time>${esc(generated)}</time></li>
    </ul>
  </header>

  <div class="summary">
    ${summaryCards
      .map((c) => `<div class="card card-${c.key}"><div class="n">${c.value}</div><div class="l">${c.label}</div></div>`)
      .join('\n    ')}
  </div>

  <div class="bar">
    ${summaryCards
      .filter((c) => c.value)
      .map((c) => `<i class="b-${c.key}" style="width:${((c.value / cases.length) * 100).toFixed(2)}%"></i>`)
      .join('')}
  </div>
  <p class="rate">Pass rate over executed cases: <b>${passRate}%</b> (${counts.passed || 0} of ${executed})</p>

  ${
    rows.some((r) => r.verdict.key === 'failed')
      ? `<section class="findings">
    <h2>What went wrong</h2>
    <ol class="finding-list">
      ${rows
        .filter((r) => r.verdict.key === 'failed')
        .map(
          (r) => `<li>
        <a href="#${esc(r.id)}"><span class="tid">${esc(r.id)}</span> ${esc(r.title)}</a>
        <div class="finding-why">${esc(firstLine(r.result?.error))}</div>
        ${(r.rules || []).length ? `<div class="rules">${r.rules.map((x) => `<span class="rule">${esc(x)}</span>`).join('')}</div>` : ''}
      </li>`,
        )
        .join('\n      ')}
    </ol>
  </section>`
      : ''
  }

  <div class="filters">
    <button data-filter="all" aria-pressed="true">All</button>
    <button data-filter="failed" aria-pressed="false">Failed</button>
    <button data-filter="passed" aria-pressed="false">Passed</button>
    <button data-filter="notrun" aria-pressed="false">Not run</button>
    <button data-filter="manual" aria-pressed="false">Manual</button>
    <input type="search" id="q" placeholder="Filter by id, title, rule…" />
  </div>

  ${areaSections}

  <footer>
    Catalogue: <code>tests/e2e/microlending/cases.ts</code> ·
    Specs: <code>tests/e2e/microlending/*.spec.ts</code> ·
    Regenerate: <code>npm run test:ml-report</code>
  </footer>
</div>

<script>
  (function () {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.filters button'));
    var search = document.getElementById('q');
    var cards = Array.prototype.slice.call(document.querySelectorAll('details.tc'));
    var active = 'all';

    function apply() {
      var q = (search.value || '').toLowerCase().trim();
      cards.forEach(function (card) {
        var okVerdict = active === 'all' || card.getAttribute('data-verdict') === active;
        var okText = !q || (card.getAttribute('data-search') || '').indexOf(q) >= 0;
        card.style.display = okVerdict && okText ? '' : 'none';
      });
      document.querySelectorAll('.area').forEach(function (area) {
        var any = Array.prototype.slice
          .call(area.querySelectorAll('details.tc'))
          .some(function (c) { return c.style.display !== 'none'; });
        area.style.display = any ? '' : 'none';
      });
    }

    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        active = b.getAttribute('data-filter');
        buttons.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        apply();
      });
    });
    search.addEventListener('input', apply);

    // Failures are what you came for — open them by default.
    cards.forEach(function (c) { if (c.getAttribute('data-verdict') === 'failed') c.open = true; });
  })();
</script>
`;
}

/** The assertion message — the sentence that says what the defect actually is. */
function firstLine(error) {
  const text = String(error || '').trim();
  if (!text) return 'No message captured.';
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const meaningful = lines.find((l) => !/^(Call log|-\s|at\s|expect\()/.test(l));
  return (meaningful || lines[0] || text).slice(0, 240);
}

function verdictLabel(key) {
  return { passed: 'passed', failed: 'failed', notrun: 'not run', manual: 'manual', skipped: 'skipped' }[key] || key;
}

function renderCase(row) {
  const searchBlob = [row.id, row.title, row.area, (row.rules || []).join(' ')].join(' ').toLowerCase();
  const dur = row.result?.durationMs ? `<span class="dur">${(row.result.durationMs / 1000).toFixed(1)}s</span>` : '';
  const rules = (row.rules || []).length
    ? `<h4>Invariants</h4><div class="rules">${row.rules.map((r) => `<span class="rule">${esc(r)}</span>`).join('')}</div>`
    : '';
  const pre = row.pre ? `<h4>Precondition</h4><p>${esc(row.pre)}</p>` : '';
  const err = row.result?.error
    ? `<h4>Failure</h4><pre class="err">${esc(row.result.error)}</pre>`
    : '';
  const observed = row.result?.observedAt
    ? `<h4>Observed</h4><p><time>${esc(String(row.result.observedAt).replace('T', ' ').slice(0, 19))}</time></p>`
    : '';
  const spec = row.result
    ? `<h4>Spec</h4><p><code>${esc(row.result.file)}</code>${row.result.line ? `:${row.result.line}` : ''}</p>`
    : row.automation === 'manual'
      ? '<h4>Spec</h4><p>Verified by hand — not automated in this suite.</p>'
      : '<h4>Spec</h4><p>No spec claims this id yet.</p>';

  return `<details class="tc" id="${esc(row.id)}" data-verdict="${row.verdict.key}" data-search="${esc(searchBlob)}">
    <summary>
      <span class="tid">${esc(row.id)}</span>
      <span class="ttitle">${esc(row.title)}</span>
      <span class="meta">${dur}<span class="pri">${esc(row.priority)}</span><span class="verdict v-${row.verdict.key}">${esc(row.verdict.label)}</span></span>
    </summary>
    <div class="body">
      ${pre}
      <h4>Steps</h4>
      <ol>${row.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <h4>Expected</h4>
      <ul>${row.expected.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      ${rules}
      ${spec}
      ${observed}
      ${err}
    </div>
  </details>`;
}

// ── Main ───────────────────────────────────────────────────────────────────
const cases = readCases();
const results = mergeIntoLedger(collectResults());
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, render(cases, results), 'utf8');

const summary = cases.reduce((acc, c) => {
  const v = verdictFor(c, results.byId.get(c.id) ?? null).key;
  acc[v] = (acc[v] || 0) + 1;
  return acc;
}, {});
console.log(
  `microlending report → ${path.relative(ROOT, OUT)}  ` +
    Object.entries(summary)
      .map(([k, v]) => `${k}:${v}`)
      .join('  '),
);
if (results.orphans.length) {
  console.log(`note: ${results.orphans.length} spec(s) ran without an [ML-xxx] id in the title`);
}
