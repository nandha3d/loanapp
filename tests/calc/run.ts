/**
 * Runner for the calculation-logic suite.
 *
 *   npx tsx tests/calc/run.ts                 # everything
 *   npx tsx tests/calc/run.ts --group=penalty # one group
 *   npx tsx tests/calc/run.ts --id=CALC-SCH-004
 *
 * Reads `tests/calc/cases.json`, calls the matching op in `harness.ts`, and
 * compares the returned facts against the case's `expect` block. Writes
 * `test-report/calc-results.json` and exits non-zero when anything fails, so a
 * CI step or another agent can branch on the exit code alone.
 */

import fs from 'node:fs';
import path from 'node:path';
import { buildOps } from './harness';

type Matcher = unknown;

type CalcCase = {
  id: string;
  group: string;
  title: string;
  rules?: string[];
  why?: string;
  op: string;
  input: unknown;
  expect?: Record<string, Matcher>;
  expectError?: string;
};

type CaseResult = {
  id: string;
  group: string;
  title: string;
  rules: string[];
  op: string;
  status: 'passed' | 'failed';
  failures: string[];
  facts?: Record<string, unknown>;
  error?: string;
  durationMs: number;
};

const ROOT = path.resolve(__dirname, '../..');
const CASES_FILE = path.join(ROOT, 'tests/calc/cases.json');
const OUT_FILE = path.join(ROOT, 'test-report/calc-results.json');

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

/** `a.b[0].c` → value. Returns the sentinel when any hop is missing. */
const MISSING = Symbol('missing');
function readPath(source: unknown, dotted: string): unknown {
  const parts = dotted.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current: any = source;
  for (const part of parts) {
    if (current == null || !(part in Object(current))) return MISSING;
    current = current[part];
  }
  return current;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

const OPERATORS = ['approx', 'gte', 'lte', 'gt', 'lt', 'contains', 'oneOf', 'not', 'length'];

/**
 * A matcher is a literal value unless it is an object carrying exactly one
 * operator key — which is why every operator name is reserved and none of them
 * is a fact name.
 */
function match(actual: unknown, matcher: Matcher): { ok: boolean; describe: string } {
  if (isPlainObject(matcher)) {
    const key = Object.keys(matcher).find((k) => OPERATORS.includes(k));
    if (key) {
      const target = (matcher as Record<string, any>)[key];
      switch (key) {
        case 'approx': {
          const tol = Number((matcher as any).tol ?? 0.01);
          const ok = typeof actual === 'number' && Math.abs(actual - Number(target)) <= tol;
          return { ok, describe: `≈ ${target} (±${tol})` };
        }
        case 'gte':
          return { ok: Number(actual) >= Number(target), describe: `>= ${target}` };
        case 'lte':
          return { ok: Number(actual) <= Number(target), describe: `<= ${target}` };
        case 'gt':
          return { ok: Number(actual) > Number(target), describe: `> ${target}` };
        case 'lt':
          return { ok: Number(actual) < Number(target), describe: `< ${target}` };
        case 'contains': {
          const ok = Array.isArray(actual)
            ? actual.some((item) => deepEqual(item, target))
            : String(actual).includes(String(target));
          return { ok, describe: `contains ${JSON.stringify(target)}` };
        }
        case 'oneOf':
          return {
            ok: Array.isArray(target) && target.some((option) => deepEqual(actual, option)),
            describe: `one of ${JSON.stringify(target)}`,
          };
        case 'length':
          return {
            ok: Array.isArray(actual) && actual.length === Number(target),
            describe: `length ${target}`,
          };
        case 'not': {
          const inner = match(actual, target);
          return { ok: !inner.ok, describe: `not ${inner.describe}` };
        }
      }
    }
  }
  return { ok: deepEqual(actual, matcher), describe: JSON.stringify(matcher) };
}

async function main() {
  const casesFile = arg('file') ? path.resolve(arg('file')!) : CASES_FILE;
  const cases: CalcCase[] = JSON.parse(fs.readFileSync(casesFile, 'utf8'));
  const groupFilter = arg('group');
  const idFilter = arg('id');
  const quiet = process.argv.includes('--quiet');

  const selected = cases.filter(
    (c) => (!groupFilter || c.group === groupFilter) && (!idFilter || c.id === idFilter),
  );
  if (selected.length === 0) {
    console.error(`No cases matched (group=${groupFilter ?? '*'} id=${idFilter ?? '*'}).`);
    process.exit(2);
  }

  const ops = await buildOps();
  const results: CaseResult[] = [];

  for (const testCase of selected) {
    const startedAt = Date.now();
    const base = {
      id: testCase.id,
      group: testCase.group,
      title: testCase.title,
      rules: testCase.rules ?? [],
      op: testCase.op,
    };

    const op = ops[testCase.op];
    if (!op) {
      results.push({
        ...base,
        status: 'failed',
        failures: [`unknown op "${testCase.op}" — no harness entry`],
        durationMs: Date.now() - startedAt,
      });
      continue;
    }

    let facts: Record<string, unknown> | undefined;
    let thrown: string | undefined;
    try {
      facts = await op(testCase.input);
    } catch (error) {
      thrown = error instanceof Error ? error.message : String(error);
    }

    const failures: string[] = [];

    if (testCase.expectError) {
      if (thrown == null) {
        failures.push(`expected a throw containing "${testCase.expectError}", but the call returned`);
      } else if (!thrown.includes(testCase.expectError)) {
        failures.push(`expected a throw containing "${testCase.expectError}", got "${thrown}"`);
      }
    } else if (thrown != null) {
      failures.push(`unexpected throw: ${thrown}`);
    } else {
      for (const [dotted, matcher] of Object.entries(testCase.expect ?? {})) {
        const actual = readPath(facts, dotted);
        if (actual === MISSING) {
          failures.push(`${dotted}: no such fact (harness returns ${Object.keys(facts ?? {}).join(', ')})`);
          continue;
        }
        const outcome = match(actual, matcher);
        if (!outcome.ok) {
          failures.push(`${dotted}: expected ${outcome.describe}, got ${JSON.stringify(actual)}`);
        }
      }
    }

    results.push({
      ...base,
      status: failures.length === 0 ? 'passed' : 'failed',
      failures,
      facts,
      error: thrown,
      durationMs: Date.now() - startedAt,
    });
  }

  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.length - passed;

  if (!quiet) {
    let lastGroup = '';
    for (const r of results) {
      if (r.group !== lastGroup) {
        console.log(`\n── ${r.group} ${'─'.repeat(Math.max(2, 60 - r.group.length))}`);
        lastGroup = r.group;
      }
      if (r.status === 'passed') {
        console.log(`  ok    ${r.id}  ${r.title}`);
      } else {
        console.log(`  FAIL  ${r.id}  ${r.title}`);
        for (const f of r.failures) console.log(`          ${f}`);
      }
    }
  }

  // Record the clock the run happened on. Schedule generation reads local date
  // parts in one branch, so a foreign agent comparing results needs to see
  // whether its machine sat at the same offset as the reference run.
  const environment = {
    node: process.version,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    utcOffsetMinutes: -new Date().getTimezoneOffset(),
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify(
      { runAt: new Date().toISOString(), environment, total: results.length, passed, failed, results },
      null,
      2,
    ),
  );

  console.log(`\n${passed}/${results.length} passed, ${failed} failed → ${path.relative(ROOT, OUT_FILE)}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
