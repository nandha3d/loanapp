import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export type LiveCheck = {
  name: string;
  path: string;
  method?: string;
  expectedStatuses?: number[];
};

export const repoRoot = process.cwd();

export function assertRoute(relativePath: string) {
  const fullPath = path.join(repoRoot, relativePath);
  assert.equal(fs.existsSync(fullPath), true, `Missing route file: ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

export function assertContains(source: string, needles: string[], label: string) {
  for (const needle of needles) {
    assert.equal(
      source.includes(needle),
      true,
      `${label} does not contain expected token: ${needle}`,
    );
  }
}

export function assertAnyContains(source: string, needles: string[], label: string) {
  assert.equal(
    needles.some((needle) => source.includes(needle)),
    true,
    `${label} does not contain any expected token: ${needles.join(', ')}`,
  );
}

export async function runLiveChecks(checks: LiveCheck[]) {
  const baseUrl = process.env.E2E_BASE_URL;
  if (!baseUrl) {
    console.log('BLOCKED live API checks: E2E_BASE_URL is not set.');
    return { blocked: checks.length, executed: 0 };
  }

  let executed = 0;
  for (const check of checks) {
    const url = new URL(check.path, baseUrl).toString();
    const response = await fetch(url, { method: check.method ?? 'GET' });
    executed++;
    const allowed = check.expectedStatuses ?? [200, 401, 403, 404];
    assert.equal(
      allowed.includes(response.status),
      true,
      `${check.name} returned ${response.status}; expected one of ${allowed.join(', ')}`,
    );
  }
  return { blocked: 0, executed };
}

export function printSummary(name: string, result: Record<string, unknown>) {
  console.log(JSON.stringify({ suite: name, ...result }, null, 2));
}
