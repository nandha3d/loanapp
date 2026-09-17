#!/usr/bin/env node
/**
 * Renders the calculation-logic page: the formulas the micro-lending module runs
 * on, each followed by the cases that pin it and the verdict from the last run.
 *
 *   node scripts/build-calc-report.mjs
 *
 * Inputs:  tests/calc/cases.json            (the catalogue — source of truth)
 *          test-report/calc-results.json    (the last run, optional)
 * Output:  test-report/calculation-logic.html
 *
 * A case with no result renders as "not run" rather than vanishing, so the page
 * never implies coverage the run did not produce.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASES = path.join(ROOT, 'tests/calc/cases.json');
const RESULTS = path.join(ROOT, 'test-report/calc-results.json');
const OUT = path.join(ROOT, 'test-report/calculation-logic.html');

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const json = (value) => esc(JSON.stringify(value, null, 2));

/** Group header copy: what the group computes, stated as the formula itself. */
const GROUPS = {
  origination: {
    label: 'Loan pricing',
    blurb: 'Five interest models. <code>rate</code> means something different in each — that is the largest source of confusion in this module.',
    formula: `upfront_fixed        deduction = rate (₹)          disbursed = P − rate        payable = P
upfront_percentage   deduction = round(P × rate/100) disbursed = P − deduction   payable = P
emi_flat             interest  = P × rate/100        disbursed = P               payable = P + interest
emi_floating         i = (rate/100)/periodsPerYear   EMI = P·i(1+i)^n / ((1+i)^n − 1)
                     payable   = round(EMI) × n      periodsPerYear: 365 / 52 / 26 / 12
interest_only        monthly   = round(P × rate/100) disbursed = P               payable = P + monthly × n
                     APR = rate × 12                 principal is a bullet, OUTSIDE the schedule

split                base = floor(payable / n); the remainder lands on the LAST row`,
  },
  validation: {
    label: 'Origination guards',
    blurb: 'What the calculator refuses, and in which words. The wording is part of the contract — the UI surfaces it verbatim.',
    formula: `principal ≤ 0 or not finite   → "Principal must be greater than zero."
rate < 0 or not finite        → "Deduction or interest rate cannot be negative."
tenure not a positive integer → "Tenure must be a positive whole number."
penaltyRate < 0               → "Penalty rate cannot be negative."
unparseable start date        → "Invalid start date."
interest_only + non-monthly   → "Interest-Only loans must use a monthly frequency."`,
  },
  schedule: {
    label: 'Instalment dates',
    blurb: 'Two paths: with a chosen due day, and without one.',
    formula: `no dueDay   daily +i days · weekly +7i · biweekly +14i
            monthly  same day-of-month, CLAMPED to the month end (31 Jan → 28 Feb)

with dueDay weekly/biweekly  dueDay 0–6 (Sun–Sat); the first due rolls FORWARD
            monthly          dueDay 1–28, clamped to 28; a day already past
                             moves the first due to next month

maturity    calculateEndDate = start + tenure × step (NOT the last due date)`,
  },
  allocation: {
    label: 'Repayment allocation',
    blurb: 'Fill order is a business decision, not a sort accident. Statuses are derived, never hand-set.',
    formula: `fill order   1. today's due   2. overdue, oldest first   3. future, soonest first

status       received ≥ due → paid · received > 0 → partial
             past due       → missed · otherwise  → upcoming · waived is preserved
outstanding  max(0, due − received)          overdue counts only when dueDate < today

loan status  settled = paidCount + waivedCount = totalInstalments
             closed  ⟸ settled AND NOT principalOutstanding > 0
             overdue ⟸ overdueAmount > 0        active ⟸ otherwise`,
  },
  penalty: {
    label: 'Penalties',
    blurb: 'The accrual the cron runs. A second, divergent formula also writes these rows — see the divergences below.',
    formula: `chargeableDays = Σ max(0, daysOverdue − grace)        ← per instalment, not per loan
grossPenalty   = chargeableDays × penaltyPerDay
if maxCap > 0:   grossPenalty = min(grossPenalty, maxCap)   ← cap 0 means UNCAPPED

recorded gross only ever increases; a reduction is a waiver (waivedAmount)
netPenaltyDue  = max(0, Σ gross − Σ settled − Σ waived)`,
  },
  foreclosure: {
    label: 'Foreclosure settlement',
    blurb: 'What the borrower hands over to close today.',
    formula: `principalOutstanding = interest_only ? outstandingPrincipal
                                     : max(0, principal − totalCollected)
maxDiscount          = principalOutstanding + netPenaltyDue
safeDiscount         = min(max(0, discount), maxDiscount)     ← clamped both ends
totalSettlement      = max(0, maxDiscount − safeDiscount)

only active and overdue loans can be foreclosed`,
  },
  'interest-only': {
    label: 'Interest-only servicing',
    blurb: 'Monthly interest on the outstanding principal; the principal itself is settled at closure.',
    formula: `monthlyInterest   = round(max(P,0) × max(rate,0) / 100)
aprPercent        = rate × 12
interestDueNow    = Σ outstanding over instalments in {missed, partial}   ← billed only
totalDueToClose   = outstandingPrincipal + interestDueNow

a null outstandingPrincipal means the FULL principal is still owed`,
  },
  npa: {
    label: 'NPA classification',
    blurb: 'RBI IRACP ladder. The clock starts at the oldest unpaid due date; the sub-category is driven by time since first classification.',
    formula: `daysOverdue   0 → standard · 1–30 → sma_0 · 31–60 → sma_1 · 61–90 → sma_2
              91+ → NPA, sub-category by days since npaClassifiedAt:
              ≤365 sub_standard · ≤730 doubtful_d1 · ≤1095 doubtful_d2 · else d3

unpaid means receivedAmount < dueAmount — a partial row still counts
npaClassifiedAt is stamped ONCE; restamping resets a 3-year-old doubtful asset`,
  },
  provisioning: {
    label: 'Provisioning',
    blurb: 'The only figure in the module that carries paise.',
    formula: `amount = round(outstanding × rate / 100, 2dp)

standard, sma_0/1/2   0.40%  /  0.40%          (secured / unsecured)
sub_standard            15%  /    15%
doubtful_d1             25%  /   100%
doubtful_d2             40%  /   100%
doubtful_d3, loss      100%  /   100%

isSecured defaults to FALSE — the conservative direction`,
  },
  float: {
    label: 'Cash float',
    blurb: 'Physical cash in an agent&rsquo;s hand or a branch drawer.',
    formula: `next = available + delta
if hardBlock and next < 0 → throw InsufficientFloatError(available, −delta)

hardBlock is OPT-IN PER CALL SITE. Only cash legs move float —
bank, UPI, cheque and DD hit the cash book and GL but not physical cash.`,
  },
  collection: {
    label: 'Collection policy',
    blurb: 'When a loan surfaces in an agent&rsquo;s worklist, when money may be taken, and how a retry is de-duplicated.',
    formula: `collection day   daily → always · diff ≤ 0 → always
                 weekly → diff % 7 = 0 · biweekly → diff % 14 = 0
                 monthly → same day-of-month, or the month-end clamp

collectible      active, overdue only
                 pending_review → "Loan is pending approval"
                 closed/foreclosed/settled → "Loan is closed"

idempotency key  tenant : agent : instalment : amount(2dp) : mode(lower) : YYYY-MM-DD`,
  },
  credit: {
    label: 'Credit score',
    blurb: 'Punctuality 55%, completion 35%, volume 10%, mapped onto a 300–850 band.',
    formula: `onTime     = Σ max(0, paid − 1.5×missed − 0.5×partial)
points     = (onTime / Σ tenure)×55 + (closed / loans)×35 + min(10, borrowed/50000 × 10)
score      = 300 + round(points × 5.5)

≥780 Excellent · ≥680 Good · ≥560 Fair · ≥440 Poor · else Very Poor
no loans, or no repayment activity at all → score 0, grade "N/A"`,
  },
};

const DIVERGENCES = [
  {
    title: 'Two penalty formulas write the same rows',
    severity: 'money',
    body: `The cron accrues <code>Σ max(0, daysOverdue − grace) × default_penalty_per_day</code>, capped by <code>penalty_max_cap</code>. <code>ensurePendingPenaltiesForMissedLoans</code> — which runs on <strong>every dashboard load</strong>, the penalties page and <code>GET /api/penalties</code> — accrues <code>count(missed instalments) × Loan.penaltyRate</code>, with no grace and no cap. Both write <code>Penalty.grossPenalty</code>, and reconciliation takes the larger. So opening the penalties page can raise a borrower's penalty above the tenant's configured cap, and can charge inside the grace window. <code>MONEY-14</code> documents only the cron formula.`,
  },
  {
    title: 'The pure allocator does not skip waived rows',
    severity: 'trap',
    body: `<code>allocatePaymentsAcrossInstalments</code> keeps a waived instalment in the fill order, so it absorbs payment that then never lands on a payable row. The persistence path filters waived rows out first. No production caller today — a trap, not a live defect. Pinned by <code>CALC-ALO-007</code>.`,
  },
  {
    title: '<code>hardBlock</code> is opt-in, not a property of the account',
    severity: 'money',
    body: `Every call site that moves cash out must pass it. Defect <code>ML-122</code> (the v1 wallet release route) is what happens when one does not — a branch pool driven to −₹10,00,000. Pinned by <code>CALC-FLT-005</code>.`,
  },
  {
    title: 'The credit-score doc comment is stale',
    severity: 'doc',
    body: `<code>lib/creditScore.ts:2</code> still says &ldquo;from 0 to 100&rdquo;. It returns 300–850. Pinned by <code>CALC-CRS-005</code>.`,
  },
  {
    title: '<code>Loan.deduction</code> stores the amount, not the rate',
    severity: 'doc',
    body: `The column name reads like a rate; it holds rupees. Any report dividing by it is wrong.`,
  },
  {
    title: 'One schedule branch reads local date parts',
    severity: 'env',
    body: `The monthly, no-<code>dueDay</code> branch reads local date parts from a Date built at UTC midnight. Verified identical under IST and UTC; unverified west of UTC. Run under <code>TZ=UTC</code> when comparing across machines.`,
  },
];

function main() {
  const cases = JSON.parse(fs.readFileSync(CASES, 'utf8'));

  let run = null;
  try {
    run = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  } catch {
    // No run yet — the page still renders the catalogue, every case "not run".
  }

  const byId = new Map((run?.results ?? []).map((r) => [r.id, r]));
  const verdictOf = (id) => byId.get(id)?.status ?? 'notrun';

  const counts = { passed: 0, failed: 0, notrun: 0 };
  for (const c of cases) counts[verdictOf(c.id)] = (counts[verdictOf(c.id)] ?? 0) + 1;

  const order = Object.keys(GROUPS).filter((g) => cases.some((c) => c.group === g));
  for (const g of [...new Set(cases.map((c) => c.group))]) if (!order.includes(g)) order.push(g);

  const sections = order
    .map((group) => {
      const meta = GROUPS[group] ?? { label: group, blurb: '', formula: '' };
      const rows = cases.filter((c) => c.group === group);
      const failed = rows.filter((c) => verdictOf(c.id) === 'failed').length;

      const cards = rows
        .map((c) => {
          const result = byId.get(c.id);
          const verdict = verdictOf(c.id);
          const rules = (c.rules ?? []).map((r) => `<span class="rule">${esc(r)}</span>`).join(' ');
          const failures = (result?.failures ?? [])
            .map((f) => `<pre class="err">${esc(f)}</pre>`)
            .join('');

          return `<details class="tc v-${verdict}" id="${esc(c.id)}" data-verdict="${verdict}">
  <summary>
    <span class="tid">${esc(c.id)}</span>
    <span class="ttl">${esc(c.title)}</span>
    <span class="spacer"></span>
    ${rules}
    <span class="verdict verdict-${verdict}">${verdict === 'notrun' ? 'not run' : verdict}</span>
  </summary>
  <div class="body">
    ${c.why ? `<h4>Why</h4><p class="why">${esc(c.why)}</p>` : ''}
    <h4>Op</h4><p><code>${esc(c.op)}</code></p>
    <h4>Input</h4><pre class="code">${json(c.input)}</pre>
    <h4>${c.expectError ? 'Expected throw' : 'Expected'}</h4>
    <pre class="code">${c.expectError ? esc(c.expectError) : json(c.expect ?? {})}</pre>
    ${failures ? `<h4>What went wrong</h4>${failures}` : ''}
    ${
      verdict === 'failed' && result?.facts
        ? `<h4>Observed</h4><pre class="code">${json(result.facts)}</pre>`
        : ''
    }
  </div>
</details>`;
        })
        .join('\n');

      return `<section class="grp" data-group="${esc(group)}">
  <h2>${esc(meta.label)} <span class="gcount">${rows.length} case${rows.length === 1 ? '' : 's'}${
    failed ? ` · <b class="bad">${failed} failing</b>` : ''
  }</span></h2>
  ${meta.blurb ? `<p class="blurb">${meta.blurb}</p>` : ''}
  ${meta.formula ? `<pre class="formula">${esc(meta.formula)}</pre>` : ''}
  <div class="cases">${cards}</div>
</section>`;
    })
    .join('\n');

  const env = run?.environment;
  const html = `<title>Loan Calculation Logic</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>
  /* Same ledger-paper family as the micro-lending test page: ink-blue rules on
     paper, verdict carried by an edge stripe so state reads before any word. */
  :root {
    --paper: #f4f5f2; --sheet: #ffffff; --sheet-2: #eceee9;
    --ink: #14181f; --ink-soft: #5a6270; --rule: #d8dbd4;
    --accent: #1f4e79;
    --pass: #0f6b3f; --pass-bg: #e2efe6;
    --fail: #a52b1e; --fail-bg: #f8e7e4;
    --notrun: #63696f; --notrun-bg: #e8eae6;
    --warn: #8a5a12; --warn-bg: #f6eddc;
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
      --warn: #e2b45f; --warn-bg: #2e2617;
    }
  }
  :root[data-theme="dark"] {
    --paper: #0f1216; --sheet: #161a20; --sheet-2: #1c2129;
    --ink: #e6e9ee; --ink-soft: #99a2af; --rule: #2b323c;
    --accent: #7fb0e0;
    --pass: #5cc98d; --pass-bg: #10301f;
    --fail: #ff8b80; --fail-bg: #37191a;
    --notrun: #9aa3ae; --notrun-bg: #212730;
    --warn: #e2b45f; --warn-bg: #2e2617;
  }

  body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans); font-size: 15px; line-height: 1.55; }
  .wrap { max-width: 1120px; margin: 0 auto; padding: 40px 20px 90px; }
  h1, h2 { text-wrap: balance; }
  h1 { font-size: 1.6rem; margin: 0 0 6px; letter-spacing: -.01em; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 2px; }
  .eyebrow { font-family: var(--mono); font-size: .72rem; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); margin: 0 0 10px; }
  .lede { color: var(--ink-soft); margin: 0 0 22px; max-width: 62ch; }
  .runmeta { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0 0 30px; padding: 0; list-style: none; color: var(--ink-soft); font-size: .84rem; }
  .runmeta code, .runmeta time { font-family: var(--mono); font-size: .95em; color: var(--ink); }

  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 1px; background: var(--rule); border: 1px solid var(--rule); border-radius: 4px; overflow: hidden; margin-bottom: 10px; }
  .card { background: var(--sheet); padding: 16px 18px; }
  .card .n { font-family: var(--mono); font-size: 1.85rem; font-weight: 500; line-height: 1.05; font-variant-numeric: tabular-nums; }
  .card .l { color: var(--ink-soft); font-size: .72rem; text-transform: uppercase; letter-spacing: .1em; margin-top: 4px; }
  .card.pass .n { color: var(--pass); } .card.fail .n { color: var(--fail); } .card.notrun .n { color: var(--notrun); }
  .rate { color: var(--ink-soft); font-size: .85rem; margin: 0 0 30px; }
  .rate b { color: var(--ink); font-family: var(--mono); font-variant-numeric: tabular-nums; }

  .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 26px; position: sticky; top: 0; padding: 14px 0; background: var(--paper); z-index: 5; border-bottom: 1px solid var(--rule); }
  .filters button { font-family: var(--mono); font-size: .72rem; letter-spacing: .04em; text-transform: uppercase; padding: 6px 11px; border-radius: 2px; cursor: pointer; border: 1px solid var(--rule); background: var(--sheet); color: var(--ink-soft); }
  .filters button:hover { color: var(--ink); }
  .filters button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--paper); }

  .grp { margin-bottom: 40px; }
  .grp h2 { font-size: 1.05rem; font-weight: 600; margin: 0 0 8px; padding-bottom: 8px; border-bottom: 1px solid var(--rule); display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .gcount { font-family: var(--mono); font-size: .72rem; font-weight: 400; color: var(--ink-soft); }
  .bad { color: var(--fail); }
  .blurb { color: var(--ink-soft); font-size: .9rem; margin: 0 0 12px; max-width: 74ch; }
  .blurb code, .dv code { font-family: var(--mono); font-size: .88em; color: var(--ink); }

  pre.formula { font-family: var(--mono); font-size: .78rem; line-height: 1.7; background: var(--sheet); border: 1px solid var(--rule); border-left: 3px solid var(--accent); border-radius: 3px; padding: 14px 16px; overflow-x: auto; margin: 0 0 16px; }

  .cases { display: flex; flex-direction: column; gap: 5px; }
  details.tc { background: var(--sheet); border: 1px solid var(--rule); border-left: 3px solid var(--notrun); border-radius: 3px; overflow: hidden; }
  details.tc.v-passed { border-left-color: var(--pass); }
  details.tc.v-failed { border-left-color: var(--fail); }
  summary { display: flex; align-items: center; gap: 11px; padding: 10px 14px; cursor: pointer; list-style: none; flex-wrap: wrap; }
  summary::-webkit-details-marker { display: none; }
  .tid { font-family: var(--mono); font-size: .78rem; color: var(--ink-soft); }
  .ttl { flex: 1 1 340px; font-size: .92rem; }
  .spacer { flex: 1 1 auto; }
  .verdict { font-family: var(--mono); font-size: .7rem; font-weight: 500; padding: 3px 9px; border-radius: 2px; white-space: nowrap; text-transform: uppercase; letter-spacing: .05em; }
  .verdict-passed { background: var(--pass-bg); color: var(--pass); }
  .verdict-failed { background: var(--fail-bg); color: var(--fail); }
  .verdict-notrun { background: var(--notrun-bg); color: var(--notrun); }
  .rule { font-family: var(--mono); font-size: .71rem; background: var(--sheet-2); border: 1px solid var(--rule); border-radius: 2px; padding: 1px 6px; color: var(--accent); }

  .body { padding: 2px 16px 18px; border-top: 1px solid var(--rule); background: var(--sheet-2); }
  .body h4 { margin: 15px 0 6px; font-family: var(--mono); font-size: .69rem; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-soft); font-weight: 500; }
  .body p { margin: 0; }
  .why { color: var(--ink-soft); font-size: .9rem; max-width: 76ch; }
  pre.code { margin: 0; padding: 11px 13px; background: var(--sheet); border: 1px solid var(--rule); border-radius: 3px; font-family: var(--mono); font-size: .77rem; overflow-x: auto; }
  pre.err { margin: 6px 0 0; padding: 11px 13px; background: var(--fail-bg); color: var(--fail); border-radius: 3px; font-family: var(--mono); font-size: .77rem; overflow-x: auto; white-space: pre-wrap; }

  .dv { background: var(--sheet); border: 1px solid var(--rule); border-radius: 4px; padding: 4px 18px 18px; margin-bottom: 40px; }
  .dv h2 { font-size: 1.05rem; border: 0; }
  .dv li { margin-bottom: 14px; }
  .dv .t { font-weight: 600; }
  .sev { font-family: var(--mono); font-size: .66rem; text-transform: uppercase; letter-spacing: .08em; padding: 2px 7px; border-radius: 2px; margin-left: 8px; }
  .sev-money { background: var(--fail-bg); color: var(--fail); }
  .sev-trap { background: var(--warn-bg); color: var(--warn); }
  .sev-doc, .sev-env { background: var(--notrun-bg); color: var(--notrun); }
  .dv p { margin: 4px 0 0; color: var(--ink-soft); font-size: .9rem; max-width: 82ch; }

  footer { margin-top: 44px; color: var(--ink-soft); font-size: .8rem; border-top: 1px solid var(--rule); padding-top: 16px; }
  footer code { font-family: var(--mono); }
  @media (max-width: 640px) { .ttl { flex-basis: 100%; } .filters { position: static; } }
</style>

<div class="wrap">
  <p class="eyebrow">ZoloFund · micro-lending</p>
  <h1>Loan calculation logic</h1>
  <p class="lede">Every figure the module puts in front of a borrower, an agent or an auditor — the formula, and the cases that pin it. Pure arithmetic: no database, no server.</p>

  <ul class="runmeta">
    <li>Cases <code>${cases.length}</code></li>
    ${run ? `<li>Last run <time>${esc(run.runAt)}</time></li>` : '<li>Not yet run</li>'}
    ${env ? `<li>Node <code>${esc(env.node)}</code></li><li>TZ <code>${esc(env.timeZone)}</code> (UTC${env.utcOffsetMinutes >= 0 ? '+' : ''}${esc(env.utcOffsetMinutes)}m)</li>` : ''}
    <li>Run with <code>npm run test:calc</code></li>
  </ul>

  <div class="summary">
    <div class="card"><div class="n">${cases.length}</div><div class="l">Cases</div></div>
    <div class="card pass"><div class="n">${counts.passed ?? 0}</div><div class="l">Passed</div></div>
    <div class="card fail"><div class="n">${counts.failed ?? 0}</div><div class="l">Failed</div></div>
    <div class="card notrun"><div class="n">${counts.notrun ?? 0}</div><div class="l">Not run</div></div>
    <div class="card"><div class="n">${order.length}</div><div class="l">Areas</div></div>
  </div>
  <p class="rate">Pass rate <b>${cases.length ? Math.round(((counts.passed ?? 0) / cases.length) * 100) : 0}%</b> of the catalogue.</p>

  <div class="filters">
    <button data-f="all" aria-pressed="true">All</button>
    <button data-f="failed" aria-pressed="false">Failing</button>
    <button data-f="passed" aria-pressed="false">Passing</button>
    <button data-f="notrun" aria-pressed="false">Not run</button>
    <button data-x="expand" aria-pressed="false">Expand all</button>
  </div>

  <section class="dv">
    <h2>Known divergences</h2>
    <ul>
      ${DIVERGENCES.map(
        (d) =>
          `<li><span class="t">${d.title}</span><span class="sev sev-${d.severity}">${d.severity}</span><p>${d.body}</p></li>`,
      ).join('\n      ')}
    </ul>
  </section>

  ${sections}

  <footer>
    Catalogue <code>tests/calc/cases.json</code> · runner <code>tests/calc/run.ts</code> ·
    formulas <code>docs/CALCULATION_LOGIC.md</code> · for another agent <code>tests/calc/AGENT_RUNBOOK.md</code>.
    Rebuild this page with <code>node scripts/build-calc-report.mjs</code>.
  </footer>
</div>

<script>
  const buttons = [...document.querySelectorAll('.filters button[data-f]')];
  buttons.forEach((btn) => btn.addEventListener('click', () => {
    const filter = btn.dataset.f;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    document.querySelectorAll('details.tc').forEach((el) => {
      el.style.display = filter === 'all' || el.dataset.verdict === filter ? '' : 'none';
    });
    // Hide a group whose every case is filtered out, so the page has no empty headings.
    document.querySelectorAll('section.grp').forEach((grp) => {
      const visible = [...grp.querySelectorAll('details.tc')].some((el) => el.style.display !== 'none');
      grp.style.display = visible ? '' : 'none';
    });
  }));

  const expand = document.querySelector('.filters button[data-x="expand"]');
  expand.addEventListener('click', () => {
    const open = expand.getAttribute('aria-pressed') !== 'true';
    expand.setAttribute('aria-pressed', String(open));
    expand.textContent = open ? 'Collapse all' : 'Expand all';
    document.querySelectorAll('details.tc').forEach((el) => { el.open = open; });
  });
</script>
`;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  console.log(
    `calculation report → ${path.relative(ROOT, OUT)}  cases:${cases.length}  passed:${counts.passed ?? 0}  failed:${counts.failed ?? 0}  notrun:${counts.notrun ?? 0}`,
  );
}

main();
