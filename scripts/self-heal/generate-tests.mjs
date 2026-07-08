#!/usr/bin/env node
/**
 * Draft a Playwright spec for one module, covering every category in
 * docs/test-case-checklist.md. Claude Code explores the repo itself
 * (app/api/v1/<module>, matching dashboard UI, prisma schema) — this
 * script just sets the target file and the contract, then writes the
 * draft. Always review generated specs before trusting them.
 *
 * Usage: node scripts/self-heal/generate-tests.mjs <module> [--force]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = process.cwd();
const [, , moduleArg, flag] = process.argv;
const force = flag === '--force';

if (!moduleArg) {
  console.error('Usage: node scripts/self-heal/generate-tests.mjs <module> [--force]');
  process.exit(1);
}

const apiDir = join(ROOT, 'app', 'api', 'v1', moduleArg);
if (!existsSync(apiDir)) {
  console.error(`[gen-tests] no app/api/v1/${moduleArg} — check module name.`);
  process.exit(1);
}

const outPath = join(ROOT, 'e2e', moduleArg, `${moduleArg}.spec.ts`);
if (existsSync(outPath) && !force) {
  console.error(`[gen-tests] ${outPath} already exists, pass --force to regenerate.`);
  process.exit(1);
}

const checklist = readFileSync(join(ROOT, 'docs', 'test-case-checklist.md'), 'utf8');

const prompt = `Draft a Playwright e2e spec for the "${moduleArg}" module.

Explore the repo yourself first: read app/api/v1/${moduleArg}/** (routes,
validation, RBAC checks), find the matching UI pages (search app/ for
"${moduleArg}"), and check prisma/schema.prisma for the relevant models.

Cover every category in this checklist that genuinely applies to this
module (skip categories that don't apply, e.g. money correctness on a
module with no monetary fields — don't pad with no-op tests):

${checklist}

Write the result to e2e/${moduleArg}/${moduleArg}.spec.ts using
@playwright/test conventions already used in this repo (see
playwright.config.ts). Use test.describe blocks per category. Do not
invent API routes or UI selectors that don't exist — if you can't find a
real way to exercise a category, add a // TODO comment explaining what's
missing instead of writing a test that can't pass.`;

mkdirSync(dirname(outPath), { recursive: true });

console.log(`[gen-tests] asking Claude Code to draft ${outPath} ...`);
const res = spawnSync('claude', ['-p', '--permission-mode', 'acceptEdits'], {
  encoding: 'utf8',
  cwd: ROOT,
  stdio: ['pipe', 'inherit', 'inherit'],
  input: prompt,
});

if (res.status !== 0) {
  console.error('[gen-tests] claude exited non-zero, check output above.');
  process.exit(res.status || 1);
}

if (!existsSync(outPath)) {
  console.error(`[gen-tests] claude finished but ${outPath} was not created — check its output above.`);
  process.exit(1);
}

console.log(`[gen-tests] wrote ${outPath} — review it before relying on it.`);
