import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { KnownGapResult } from '../../e2e-business/helpers/harness';
import { writeKnownGapsReport } from '../../e2e-business/helpers/evidenceWriter';

type UiSuiteSummary = {
  source: string;
  baseURL: string;
  browser: string;
  roles: string[];
  passed: string[];
  knownGaps: KnownGapResult[];
  blocked: string[];
};

const summaries = new Map<string, UiSuiteSummary>();

export function makeUiGap(input: {
  id: string;
  name: string;
  classification?: KnownGapResult['classification'];
  currentBehavior: string;
  expectedBehavior: string;
  evidenceSource: string;
  businessImpact: string;
  fixedAssertion: string;
  observedFailure: string;
}): KnownGapResult {
  return {
    classification: input.classification ?? 'P2',
    ...input,
  };
}

export function createUiEvidenceRecorder(input: {
  runId: string;
  source: string;
  baseURL: string;
  browser: string;
}) {
  const summary: UiSuiteSummary = {
    source: input.source,
    baseURL: input.baseURL,
    browser: input.browser,
    roles: [],
    passed: [],
    knownGaps: [],
    blocked: [],
  };
  summaries.set(input.source, summary);

  return {
    role(role: string) {
      if (!summary.roles.includes(role)) summary.roles.push(role);
    },
    pass(id: string) {
      if (!summary.passed.includes(id)) summary.passed.push(id);
    },
    gap(gap: KnownGapResult) {
      if (!summary.knownGaps.some((item) => item.id === gap.id && item.name === gap.name)) {
        summary.knownGaps.push(gap);
      }
    },
    blocked(id: string, reason: string) {
      summary.blocked.push(`${id}: ${reason}`);
    },
    write() {
      writeUiEvidence(input.runId);
      writeKnownGapsReport({
        runId: input.runId,
        source: input.source,
        knownGaps: summary.knownGaps,
        summary: {
          passed: summary.passed.length,
          skipped: 0,
          knownGaps: summary.knownGaps.length,
          manualProviderDeviceOnly: 0,
          failed: 0,
          total: summary.passed.length + summary.knownGaps.length,
          knownGapResults: summary.knownGaps,
        },
      });
    },
  };
}

function writeUiEvidence(runId: string) {
  const evidenceDir = path.join(process.cwd(), 'Testing', 'qa_evidence', runId, 'ui');
  mkdirSync(evidenceDir, { recursive: true });
  const jsonPath = path.join(evidenceDir, 'ui-summary.json');
  const existing: UiSuiteSummary[] = existsSync(jsonPath)
    ? JSON.parse(readFileSync(jsonPath, 'utf8'))
    : [];
  const bySource = new Map(existing.map((summary) => [summary.source, summary]));
  for (const summary of summaries.values()) bySource.set(summary.source, summary);
  const all = Array.from(bySource.values()).sort((a, b) => a.source.localeCompare(b.source));
  writeFileSync(jsonPath, `${JSON.stringify(all, null, 2)}\n`, 'utf8');

  const lines = [
    '# LoanTrack Critical UI E2E Summary',
    '',
    `RUN_ID: ${runId}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Environment',
    '',
    `- baseURL: ${all[0]?.baseURL ?? 'unknown'}`,
    `- tested browser: ${Array.from(new Set(all.map((summary) => summary.browser))).join(', ') || 'unknown'}`,
    `- tested roles: ${Array.from(new Set(all.flatMap((summary) => summary.roles))).join(', ') || 'none'}`,
    '',
    '## Passing UI Checks',
    '',
    ...(all.flatMap((summary) => summary.passed.map((id) => `- ${summary.source}: ${id}`)).length
      ? all.flatMap((summary) => summary.passed.map((id) => `- ${summary.source}: ${id}`))
      : ['- None recorded.']),
    '',
    '## Known UI Gaps',
    '',
    ...(all.flatMap((summary) => summary.knownGaps.map((gap) => `- ${gap.id}: ${gap.name}`)).length
      ? all.flatMap((summary) => summary.knownGaps.map((gap) => `- ${gap.id}: ${gap.name}`))
      : ['- None recorded.']),
    '',
    '## Blocked Checks',
    '',
    ...(all.flatMap((summary) => summary.blocked.map((blocked) => `- ${summary.source}: ${blocked}`)).length
      ? all.flatMap((summary) => summary.blocked.map((blocked) => `- ${summary.source}: ${blocked}`))
      : ['- None recorded.']),
    '',
  ];
  writeFileSync(path.join(evidenceDir, 'ui-summary.md'), `${lines.join('\n')}\n`, 'utf8');
}
