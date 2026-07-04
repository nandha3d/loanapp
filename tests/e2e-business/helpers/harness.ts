type TestFn = () => Promise<void> | void;

export type KnownGapDetails = {
  id: string;
  currentBehavior: string;
  expectedBehavior: string;
  evidenceSource: string;
  businessImpact: string;
  fixedAssertion: string;
};

export type KnownGapResult = KnownGapDetails & {
  name: string;
  observedFailure: string;
};

export type RunSummary = {
  passed: number;
  skipped: number;
  knownGaps: number;
  manualProviderDeviceOnly: number;
  failed: number;
  total: number;
  knownGapResults: KnownGapResult[];
};

type Case =
  | { kind: 'test'; name: string; fn: TestFn }
  | { kind: 'skip'; name: string; reason: string }
  | { kind: 'knownGap'; name: string; details: KnownGapDetails; fn: TestFn };

const cases: Case[] = [];

class SkipNow extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = 'SkipNow';
  }
}

export function test(name: string, fn: TestFn) {
  cases.push({ kind: 'test', name, fn });
}

export function skip(name: string, reason: string) {
  cases.push({ kind: 'skip', name, reason });
}

export function knownGap(name: string, details: KnownGapDetails, fn: TestFn) {
  cases.push({ kind: 'knownGap', name, details, fn });
}

export function skipNow(reason: string): never {
  throw new SkipNow(reason);
}

function describeError(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export async function run(): Promise<RunSummary> {
  let passed = 0;
  let skipped = 0;
  let knownGaps = 0;
  let failed = 0;
  const knownGapResults: KnownGapResult[] = [];

  for (const item of cases) {
    if (item.kind === 'skip') {
      skipped++;
      console.log(`SKIP ${item.name} - ${item.reason}`);
      continue;
    }

    if (item.kind === 'knownGap') {
      try {
        await item.fn();
        failed++;
        console.error(`UNEXPECTED_PASS ${item.details.id} ${item.name}`);
        console.error(`Known gap assertion now passes. Convert this expected-failure case into a normal regression test.`);
      } catch (error) {
        knownGaps++;
        const observedFailure = describeError(error);
        knownGapResults.push({ ...item.details, name: item.name, observedFailure });
        console.log(`KNOWN_GAP ${item.details.id} ${item.name}`);
        console.log(`  current: ${item.details.currentBehavior}`);
        console.log(`  expected: ${item.details.expectedBehavior}`);
        console.log(`  evidence: ${item.details.evidenceSource}`);
        console.log(`  impact: ${item.details.businessImpact}`);
        console.log(`  fixed assertion: ${item.details.fixedAssertion}`);
        console.log(`  observed: ${observedFailure}`);
      }
      continue;
    }

    try {
      await item.fn();
      passed++;
      console.log(`PASS ${item.name}`);
    } catch (error) {
      if (error instanceof SkipNow) {
        skipped++;
        console.log(`SKIP ${item.name} - ${error.reason}`);
        continue;
      }
      failed++;
      console.error(`FAIL ${item.name}`);
      console.error(error);
    }
  }

  const summary = {
    passed,
    skipped,
    knownGaps,
    manualProviderDeviceOnly: 0,
    failed,
    total: cases.length,
    knownGapResults,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failed > 0) process.exitCode = 1;
  return summary;
}
