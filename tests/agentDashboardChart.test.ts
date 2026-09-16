import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

test('Agent Dashboard - chart scaling bounds collected and expected heights within 100%', () => {
  const weekData = [
    { date: '10 Sep', collected: 0, expected: 5000 },
    { date: '11 Sep', collected: 0, expected: 0 },
    { date: '12 Sep', collected: 12000, expected: 8000 },
    { date: '13 Sep', collected: 0, expected: 0 },
    { date: '14 Sep', collected: 0, expected: 0 },
    { date: '15 Sep', collected: 66855, expected: 1000 }, // huge lump sum collection vs tiny expected
    { date: '16 Sep', collected: 7700, expected: 5700 },
  ];

  // Mathematical formula used in AgentDashboardClient.tsx
  const maxVal = Math.max(1, ...weekData.flatMap(d => [d.expected, d.collected]));
  assert.equal(maxVal, 66855, 'maxVal must be the absolute maximum across both expected and collected');

  for (const day of weekData) {
    const expPct = Math.min(100, Math.round((day.expected / maxVal) * 100));
    const colPct = Math.min(100, Math.round((day.collected / maxVal) * 100));

    assert.ok(expPct >= 0 && expPct <= 100, `expected height percent ${expPct} must stay within [0, 100]`);
    assert.ok(colPct >= 0 && colPct <= 100, `collected height percent ${colPct} must stay within [0, 100]`);
  }

  // Specifically verify day 15 Sep (the case that originally broke the UI)
  const sep15 = weekData[5];
  const sep15ColPct = Math.min(100, Math.round((sep15.collected / maxVal) * 100));
  const sep15ExpPct = Math.min(100, Math.round((sep15.expected / maxVal) * 100));
  assert.equal(sep15ColPct, 100, 'highest collected bar must cap at exactly 100%');
  assert.equal(sep15ExpPct, 1, 'expected bar scales proportionally without skewing chart');
});

test('Agent Dashboard - component source code contains overflow protection and responsive grid', () => {
  const clientPath = join(root, 'app', '(dashboard)', '[module]', 'agent-dashboard', 'AgentDashboardClient.tsx');
  const clientCode = readFileSync(clientPath, 'utf8');

  // Must not have single maxExpected divisor bug
  assert.doesNotMatch(
    clientCode,
    /const expH\s*=\s*Math\.round\(\(day\.expected\s*\/\s*maxExpected\)\s*\*\s*80\)/,
    'must not use old unbounded pixel height formula'
  );
  assert.doesNotMatch(
    clientCode,
    /const colH\s*=\s*Math\.round\(\(day\.collected\s*\/\s*maxExpected\)\s*\*\s*80\)/,
    'must not scale collected by maxExpected only'
  );

  // Must have safe maxVal
  assert.match(
    clientCode,
    /const maxVal = Math\.max\(1, \.\.\.p\.weekData\.flatMap\(d => \[d\.expected, d\.collected\]\)\)/,
    'must scale with maxVal derived from both series'
  );

  // Must have overflow shield on the bar track
  assert.match(
    clientCode,
    /overflow:\s*'hidden'/,
    'must contain overflow: hidden shield on the bar track'
  );

  // Must have responsive auto-fit KPI grid
  assert.match(
    clientCode,
    /repeat\(auto-fit,\s*minmax\(130px,\s*1fr\)\)/,
    'KPI grid must use responsive auto-fit columns'
  );
});
