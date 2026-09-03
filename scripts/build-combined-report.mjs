#!/usr/bin/env node
/**
 * Renders every module's test register into ONE page with a tab per module.
 *
 *   node scripts/build-combined-report.mjs
 *
 *   in  tests/e2e/<suite>/cases.ts        each catalogue
 *   in  test-report/<suite>-ledger.json   each suite's carried-forward verdicts
 *   out test-report/index.html            the combined page
 *
 * The per-suite pages stay as they are — this is an index over them, for the
 * reader who wants one link rather than five. It reads the same ledgers, so it
 * never disagrees with them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'test-report', 'index.html');

/** Module order is the order the business reads them in, not alphabetical. */
const SUITES = [
  { key: 'microlending', dir: 'microlending', prefix: 'ML', label: 'Micro Lending', accent: '#1f4e79' },
  { key: 'chitfunds', dir: 'chitfunds', prefix: 'CF', label: 'Chit Funds', accent: '#0f4f4a' },
  { key: 'autofinance', dir: 'autofinance', prefix: 'AUTO', label: 'Auto Finance', accent: '#4b3f8f' },
  { key: 'goldloan', dir: 'goldloan', prefix: 'GL', label: 'Gold Loan', accent: '#7a5312' },
  { key: 'securedloans', dir: 'securedloans', prefix: 'PPF', label: 'Property & Product', accent: '#2f5d50' },
];

// ── Readers ────────────────────────────────────────────────────────────────
function readArray(src, name) {
  const start = src.indexOf(`export const ${name}`);
  if (start < 0) return null;
  const open = src.indexOf('[', src.indexOf('=', start));
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) {
        // eslint-disable-next-line no-new-func
        return new Function(`return (${src.slice(open, i + 1)});`)();
      }
    }
  }
  return null;
}

function readSuite(suite) {
  const casesFile = path.join(ROOT, 'tests', 'e2e', suite.dir, 'cases.ts');
  if (!fs.existsSync(casesFile)) return null;
  const src = fs.readFileSync(casesFile, 'utf8');

  const ledgerFile = path.join(ROOT, 'test-report', `${suite.key}-ledger.json`);
  const ledger = fs.existsSync(ledgerFile)
    ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))
    : { cases: {}, lastRunAt: null };

  return {
    ...suite,
    cases: readArray(src, 'CASES') ?? [],
    areas: readArray(src, 'AREAS'),
    results: new Map(Object.entries(ledger.cases ?? {})),
    lastRunAt: ledger.lastRunAt ?? null,
  };
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
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const stamp = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().replace('T', ' ').slice(0, 16);
};

const duration = (ms) => (!ms ? '' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);
const firstLine = (err) => String(err || '').split('\n').find((l) => l.trim()) ?? '';

const VERDICTS = ['passed', 'failed', 'notrun', 'manual', 'skipped'];

// ── Case row ───────────────────────────────────────────────────────────────
function renderCase(row, suite) {
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
      <div><h4>Steps</h4><ol>${c.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>
      <div><h4>Expected</h4><ul>${c.expected.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    </div>
    ${c.rules?.length ? `<p class="rules">${c.rules.map((r) => `<span class="rule">${esc(r)}</span>`).join('')}</p>` : ''}
    ${result ? `<p class="where"><span class="tag">Spec</span><code>${esc(path.basename(result.file || ''))}</code>${result.line ? `:${result.line}` : ''} · ${esc(suite.label)}</p>` : ''}
    ${result?.error ? `<pre class="err">${esc(result.error)}</pre>` : ''}
  </div>
</details>`;
}

// ── Page ───────────────────────────────────────────────────────────────────
function render(suites) {
  const rowsOf = (s) =>
    s.cases.map((c) => {
      const result = s.results.get(c.id) ?? null;
      return { c, result, verdict: verdictFor(c, result), suite: s };
    });

  const bySuite = suites.map((s) => ({ suite: s, rows: rowsOf(s) }));
  const all = bySuite.flatMap((x) => x.rows);

  const tally = (rows) =>
    VERDICTS.reduce((acc, k) => ({ ...acc, [k]: rows.filter((r) => r.verdict.key === k).length }), {});

  const total = tally(all);
  const executed = total.passed + total.failed;
  const rate = executed ? Math.round((total.passed / executed) * 100) : 0;
  const pct = (n, of) => (of ? ((n / of) * 100).toFixed(2) : '0');

  const failures = all.filter((r) => r.verdict.key === 'failed');

  /**
   * A module tab carries its own pass/fail split; the failures tab carries only
   * a count, because a "0 passed" on a tab that lists nothing but failures
   * reads as a broken number rather than as information.
   */
  const tabButton = (id, label, accent, counts, failuresOnly = false) => `
    <button class="tab" data-tab="${id}" role="tab" aria-selected="false" style="--tab-accent:${accent}">
      <span class="tab-label">${esc(label)}</span>
      <span class="tab-nums">${
        failuresOnly
          ? `<span class="n-fail">${counts.failed} failing</span>`
          : `<span class="n-pass">${counts.passed}</span><span class="n-sep">/</span><span class="n-fail">${counts.failed}</span>`
      }</span>
    </button>`;

  const panelSummary = (counts, count) => `
    <div class="summary">
      ${VERDICTS.map(
        (k) => `<div class="tile t-${k}"><span class="n">${counts[k]}</span><span class="l">${
          k === 'notrun' ? 'Not run' : k[0].toUpperCase() + k.slice(1)
        }</span></div>`,
      ).join('')}
    </div>
    <div class="bar">${VERDICTS.map((k) => `<i class="b-${k}" style="width:${pct(counts[k], count)}%"></i>`).join('')}</div>`;

  const areaSections = ({ suite, rows }) => {
    const order = suite.areas ?? [...new Set(suite.cases.map((c) => c.area))];
    return order
      .map((area) => ({ area, items: rows.filter((r) => r.c.area === area) }))
      .filter((g) => g.items.length)
      .map(({ area, items }) => {
        const chips = VERDICTS.map((k) => ({ k, n: items.filter((i) => i.verdict.key === k).length }))
          .filter((x) => x.n)
          .map((x) => `<span class="areachip ac-${x.k}">${x.n} ${x.k === 'notrun' ? 'not run' : x.k}</span>`)
          .join('');
        return `<section class="area">
      <h3>${esc(area)} <span class="areachips">${chips}</span></h3>
      ${items.map((r) => renderCase(r, suite)).join('\n')}
    </section>`;
      })
      .join('\n');
  };

  return `<title>ZoloFund Test Register</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Public+Sans:wght@400;500;600;700&family=Zilla+Slab:wght@600;700&display=swap">
<style>
  :root {
    --ground: #eceee9; --sheet: #ffffff; --sheet-2: #e4e7e2;
    --ink: #141917; --ink-soft: #5b6662; --rule: #cdd4ce;
    --accent: #1f3d47;
    --pass: #1b6b3a; --pass-bg: #e0efe5;
    --fail: #a12a20; --fail-bg: #f8e6e3;
    --notrun: #59636b; --notrun-bg: #e6e9e6;
    --manual: #8a5b12; --manual-bg: #f5eddd;
    --skipped: #4e5a58; --skipped-bg: #e5e9e7;
    --display: "Zilla Slab", Georgia, serif;
    --body: "Public Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #0d1211; --sheet: #141a19; --sheet-2: #1a2220;
      --ink: #e4e9e6; --ink-soft: #93a09b; --rule: #293331;
      --accent: #8fc7d6;
      --pass: #54c98a; --pass-bg: #102c1d;
      --fail: #ff8b80; --fail-bg: #351a18;
      --notrun: #95a09f; --notrun-bg: #1f2827;
      --manual: #dfae5c; --manual-bg: #2c2516;
      --skipped: #93a09b; --skipped-bg: #1e2725;
    }
  }
  :root[data-theme="dark"] {
    --ground: #0d1211; --sheet: #141a19; --sheet-2: #1a2220;
    --ink: #e4e9e6; --ink-soft: #93a09b; --rule: #293331;
    --accent: #8fc7d6;
    --pass: #54c98a; --pass-bg: #102c1d;
    --fail: #ff8b80; --fail-bg: #351a18;
    --notrun: #95a09f; --notrun-bg: #1f2827;
    --manual: #dfae5c; --manual-bg: #2c2516;
    --skipped: #93a09b; --skipped-bg: #1e2725;
  }

  * { box-sizing: border-box; }
  /* Panels and sections are flex containers, and display:flex beats the
     hidden attribute's default display:none. Without this the tabs change
     colour and nothing else happens. */
  [hidden] { display: none !important; }
  body { background: var(--ground); color: var(--ink); font-family: var(--body); line-height: 1.5; }
  .wrap { max-width: 1120px; margin: 0 auto; padding: 36px 20px 80px; display: flex; flex-direction: column; gap: 22px; }

  header { display: flex; flex-direction: column; gap: 8px; }
  .eyebrow { margin: 0; font-size: .72rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); }
  h1 { margin: 0; font-family: var(--display); font-weight: 700; font-size: clamp(1.9rem, 4vw, 2.5rem); }
  .runmeta { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px 20px; font-size: .82rem; color: var(--ink-soft); }
  .runmeta code, .runmeta time { font-family: var(--mono); font-size: .78rem; color: var(--ink); }

  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
  .tile { background: var(--sheet); border: 1px solid var(--rule); border-radius: 3px; padding: 12px 14px; display: flex; flex-direction: column; }
  .tile .n { font-family: var(--mono); font-weight: 700; font-size: 1.6rem; font-variant-numeric: tabular-nums; }
  .tile .l { font-size: .72rem; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-soft); }
  .t-passed .n { color: var(--pass); } .t-failed .n { color: var(--fail); }
  .t-notrun .n { color: var(--notrun); } .t-manual .n { color: var(--manual); } .t-skipped .n { color: var(--skipped); }

  .bar { display: flex; height: 8px; border-radius: 2px; overflow: hidden; background: var(--sheet-2); }
  .bar i { display: block; height: 100%; }
  .b-passed { background: var(--pass); } .b-failed { background: var(--fail); }
  .b-manual { background: var(--manual); } .b-notrun { background: var(--notrun); } .b-skipped { background: var(--skipped); }
  .rate { margin: 0; font-size: .86rem; color: var(--ink-soft); }
  .rate b { font-family: var(--mono); color: var(--ink); }

  .tabs { display: flex; flex-wrap: wrap; gap: 6px; border-bottom: 1px solid var(--rule); padding-bottom: 0; }
  .tab { font: inherit; display: flex; flex-direction: column; gap: 2px; align-items: flex-start;
    padding: 9px 14px; cursor: pointer; background: transparent; color: var(--ink-soft);
    border: 1px solid transparent; border-bottom: 3px solid transparent; border-radius: 3px 3px 0 0; }
  .tab:hover { color: var(--ink); }
  .tab[aria-selected="true"] { color: var(--ink); background: var(--sheet);
    border-color: var(--rule); border-bottom-color: var(--tab-accent, var(--accent)); }
  .tab:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .tab-label { font-size: .88rem; font-weight: 600; }
  .tab-nums { font-family: var(--mono); font-size: .72rem; font-variant-numeric: tabular-nums; }
  .n-pass { color: var(--pass); } .n-fail { color: var(--fail); } .n-sep { color: var(--ink-soft); padding: 0 2px; }

  .filters { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
    background: var(--ground); padding: 10px 0; border-bottom: 1px solid var(--rule); }
  .filters input { flex: 1 1 220px; min-width: 180px; font: inherit; font-size: .86rem; padding: 7px 11px;
    background: var(--sheet); color: var(--ink); border: 1px solid var(--rule); border-radius: 3px; }
  .filters input:focus-visible, .chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .chip { font: inherit; font-size: .76rem; font-weight: 600; padding: 6px 11px; border-radius: 999px; cursor: pointer;
    background: var(--sheet); color: var(--ink-soft); border: 1px solid var(--rule); }
  .chip[aria-pressed="true"] { background: var(--ink); color: var(--ground); border-color: var(--ink); }

  .panel { display: flex; flex-direction: column; gap: 16px; }
  .panel-head { display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: baseline; }
  .panel-head h2 { margin: 0; font-family: var(--display); font-size: 1.25rem; }
  .panel-head .meta { font-size: .8rem; color: var(--ink-soft); }
  .panel-head .meta time { font-family: var(--mono); }

  section.area { display: flex; flex-direction: column; gap: 4px; }
  section.area > h3 { margin: 12px 0 2px; font-family: var(--display); font-size: 1rem; font-weight: 600;
    display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; }
  .areachips { display: inline-flex; gap: 6px; }
  .areachip { font-family: var(--mono); font-size: .68rem; padding: 2px 7px; border-radius: 2px; }
  .ac-passed { background: var(--pass-bg); color: var(--pass); }
  .ac-failed { background: var(--fail-bg); color: var(--fail); }
  .ac-manual { background: var(--manual-bg); color: var(--manual); }
  .ac-notrun { background: var(--notrun-bg); color: var(--notrun); }
  .ac-skipped { background: var(--skipped-bg); color: var(--skipped); }

  details.case { background: var(--sheet); border: 1px solid var(--rule); border-left: 3px solid var(--notrun); border-radius: 2px; }
  details.case[data-verdict="passed"] { border-left-color: var(--pass); }
  details.case[data-verdict="failed"] { border-left-color: var(--fail); }
  details.case[data-verdict="manual"] { border-left-color: var(--manual); }
  details.case[data-verdict="skipped"] { border-left-color: var(--skipped); }
  details.case + details.case { margin-top: 3px; }
  summary { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: baseline; padding: 9px 14px; cursor: pointer; }
  summary::-webkit-details-marker { display: none; }
  summary:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .cid { font-family: var(--mono); font-size: .74rem; font-weight: 700; color: var(--accent); }
  .ctitle { flex: 1 1 300px; font-size: .89rem; }
  .cmeta { display: inline-flex; gap: 8px; align-items: baseline; margin-left: auto; }
  .dur, .pri { font-family: var(--mono); font-size: .7rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
  .pri-P0 { color: var(--fail); font-weight: 700; }
  .verdict { font-size: .69rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; padding: 2px 8px; border-radius: 2px; }
  .v-passed { background: var(--pass-bg); color: var(--pass); }
  .v-failed { background: var(--fail-bg); color: var(--fail); }
  .v-manual { background: var(--manual-bg); color: var(--manual); }
  .v-notrun { background: var(--notrun-bg); color: var(--notrun); }
  .v-skipped { background: var(--skipped-bg); color: var(--skipped); }

  .cbody { padding: 4px 16px 16px; border-top: 1px solid var(--rule); display: flex; flex-direction: column; gap: 10px; }
  .cbody h4 { margin: 10px 0 4px; font-size: .71rem; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-soft); }
  .cbody ol, .cbody ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; font-size: .85rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 4px 28px; }
  .tag { font-size: .65rem; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--ink-soft); margin-right: 8px; }
  .pre, .where { margin: 0; font-size: .81rem; color: var(--ink-soft); }
  .where code { font-family: var(--mono); font-size: .75rem; color: var(--ink); }
  .rules { margin: 0; display: flex; flex-wrap: wrap; gap: 5px; }
  .rule { font-family: var(--mono); font-size: .67rem; padding: 2px 7px; border: 1px solid var(--rule); border-radius: 2px; color: var(--ink-soft); }
  pre.err { margin: 0; padding: 12px 14px; background: var(--fail-bg); color: var(--fail); border-radius: 2px;
    font-family: var(--mono); font-size: .75rem; line-height: 1.45; white-space: pre-wrap; overflow-x: auto; }

  .failgroup { display: flex; flex-direction: column; gap: 4px; }
  .failgroup > h3 { margin: 14px 0 2px; font-family: var(--display); font-size: 1rem;
    display: flex; gap: 10px; align-items: baseline; }
  .failgroup > h3 .badge { font-family: var(--mono); font-size: .68rem; padding: 2px 7px; border-radius: 2px;
    background: var(--fail-bg); color: var(--fail); }
  .why { margin: 2px 0 0; font-family: var(--mono); font-size: .74rem; color: var(--fail); overflow-wrap: anywhere; }

  .empty { display: none; padding: 40px 0; text-align: center; color: var(--ink-soft); font-size: .9rem; }
  body.filtering .empty { display: block; }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>

<div class="wrap">
  <header>
    <p class="eyebrow">ZoloFund · every module</p>
    <h1>ZoloFund Test Register</h1>
    <ul class="runmeta">
      <li><code>${all.length}</code> cases · <code>${suites.length}</code> modules</li>
      <li>Database <code>loantrack_qa</code></li>
      <li>Runner <code>Playwright</code></li>
      <li>Page built <time>${stamp(new Date().toISOString())}</time></li>
    </ul>
  </header>

  ${panelSummary(total, all.length)}
  <p class="rate">Pass rate over executed cases: <b>${rate}%</b> (${total.passed} of ${executed}) · <b>${total.failed}</b> failing · <b>${total.notrun}</b> with no spec yet</p>

  <div class="tabs" role="tablist">
    ${tabButton('failures', 'All failures', 'var(--fail)', { passed: 0, failed: failures.length }, true)}
    ${bySuite.map((x) => tabButton(x.suite.key, x.suite.label, x.suite.accent, tally(x.rows))).join('')}
  </div>

  <div class="filters">
    <input id="q" type="search" placeholder="Filter by id, title, area or rule…" aria-label="Filter cases">
    ${['all', 'failed', 'passed', 'notrun', 'manual']
      .map(
        (v, i) =>
          `<button class="chip" data-v="${v}" aria-pressed="${i === 0}">${
            v === 'all' ? 'All' : v === 'notrun' ? 'Not run' : v[0].toUpperCase() + v.slice(1)
          }</button>`,
      )
      .join('')}
  </div>

  <main>
    <div class="panel" data-panel="failures" role="tabpanel">
      <div class="panel-head">
        <h2>Everything that failed</h2>
        <span class="meta">${failures.length} across ${new Set(failures.map((f) => f.suite.key)).size} modules</span>
      </div>
      ${bySuite
        .filter((x) => x.rows.some((r) => r.verdict.key === 'failed'))
        .map(
          (x) => `<div class="failgroup">
        <h3>${esc(x.suite.label)} <span class="badge">${x.rows.filter((r) => r.verdict.key === 'failed').length} failing</span></h3>
        ${x.rows
          .filter((r) => r.verdict.key === 'failed')
          .map(
            (r) => `${renderCase(r, x.suite)}
        <p class="why">${esc(firstLine(r.result?.error))}</p>`,
          )
          .join('\n')}
      </div>`,
        )
        .join('\n')}
    </div>

    ${bySuite
      .map(
        (x) => `<div class="panel" data-panel="${x.suite.key}" role="tabpanel" hidden>
      <div class="panel-head">
        <h2>${esc(x.suite.label)}</h2>
        <span class="meta">${x.rows.length} cases · last run <time>${stamp(x.suite.lastRunAt)}</time></span>
      </div>
      ${panelSummary(tally(x.rows), x.rows.length)}
      ${areaSections(x)}
    </div>`,
      )
      .join('\n')}

    <p class="empty">No case matches this filter.</p>
  </main>
</div>

<script>
(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.panel'));
  var q = document.getElementById('q');
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var verdict = 'all';

  function activePanel() {
    return panels.filter(function (p) { return !p.hidden; })[0] || panels[0];
  }

  function apply() {
    var term = q.value.trim().toLowerCase();
    var panel = activePanel();
    var shown = 0;

    Array.prototype.forEach.call(panel.querySelectorAll('details.case'), function (el) {
      var okV = verdict === 'all' || el.dataset.verdict === verdict;
      var okQ = !term || el.dataset.search.indexOf(term) !== -1;
      var show = okV && okQ;
      el.hidden = !show;
      // The failures panel prints the error line as a sibling of the case.
      var why = el.nextElementSibling;
      if (why && why.classList.contains('why')) why.hidden = !show;
      if (show) shown++;
    });

    Array.prototype.forEach.call(panel.querySelectorAll('section.area, .failgroup'), function (s) {
      var any = Array.prototype.some.call(s.querySelectorAll('details.case'), function (el) { return !el.hidden; });
      s.hidden = !any;
    });

    document.body.classList.toggle('filtering', shown === 0);
  }

  function select(id) {
    tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === id)); });
    panels.forEach(function (p) { p.hidden = p.dataset.panel !== id; });
    apply();
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* file:// */ }
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () { select(t.dataset.tab); });
  });

  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      verdict = c.dataset.v;
      chips.forEach(function (o) { o.setAttribute('aria-pressed', String(o === c)); });
      apply();
    });
  });

  q.addEventListener('input', apply);

  var fromHash = (location.hash || '').slice(1);
  select(tabs.some(function (t) { return t.dataset.tab === fromHash; }) ? fromHash : 'failures');
})();
</script>`;
}

// ── Main ───────────────────────────────────────────────────────────────────
const suites = SUITES.map(readSuite).filter(Boolean);
if (!suites.length) {
  console.error('No suite catalogues found under tests/e2e/*/cases.ts');
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, render(suites), 'utf8');

const totals = suites.map((s) => {
  const counts = s.cases.reduce((acc, c) => {
    const v = verdictFor(c, s.results.get(c.id) ?? null).key;
    acc[v] = (acc[v] || 0) + 1;
    return acc;
  }, {});
  return `${s.key} ${counts.passed || 0}p/${counts.failed || 0}f`;
});

console.log(`combined report → ${path.relative(ROOT, OUT)}  ${totals.join('  ')}`);
