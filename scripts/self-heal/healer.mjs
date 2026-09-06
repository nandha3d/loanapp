#!/usr/bin/env node
/**
 * Self-healing loop: run Playwright -> on failure, hand the error to
 * Claude Code to patch source -> rerun -> max 3 attempts -> escalate.
 * Never pushes, never force-pushes, never edits test files.
 * See docs/self-healing-sdlc.md for the rules this enforces.
 */
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const STATE_DIR = join(ROOT, 'scripts', 'self-heal', '.state');
const RESULTS_PATH = join(ROOT, 'e2e-results', 'results.json');
const MAX_RETRIES = Number(process.env.SELF_HEAL_MAX_RETRIES || 3);
const RATE_LIMIT_MS = 10 * 60 * 1000;
const SOURCE_DIRS = ['app/', 'lib/', 'components/', 'prisma/', 'scripts/', 'proxy.ts'];
const TEST_DIRS = ['e2e/', 'tests/'];

// Token budget: Playwright itself costs nothing — only what we paste into
// the prompt does. Cap error/snippet/diff sizes so a 3-attempt loop can't
// balloon the prompt linearly with every retry.
const MAX_ERROR_CHARS = Number(process.env.SELF_HEAL_MAX_ERROR_CHARS || 1500);
const MAX_DIFF_CHARS = Number(process.env.SELF_HEAL_MAX_DIFF_CHARS || 3000);

// Scale model effort up only as attempts escalate — attempt 1 is usually a
// single bad locator/assertion, not worth a max-effort pass.
const ATTEMPT_EFFORT = ['low', 'medium', 'high', 'xhigh', 'max'];

function truncate(text, max) {
  if (!text || text.length <= max) return text;
  return `${text.slice(0, max)}\n...[truncated ${text.length - max} chars]`;
}

function sh(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', shell: true, cwd: ROOT, ...opts });
}

function currentBranch() {
  return sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
}

function redact(text) {
  let out = text;
  for (const [key, value] of Object.entries(process.env)) {
    if (!value || value.length < 6) continue;
    if (/SECRET|KEY|PASSWORD|PASS|TOKEN|DATABASE_URL/i.test(key)) {
      out = out.split(value).join(`[redacted:${key}]`);
    }
  }
  out = out.replace(/mysql:\/\/[^\s"']+/gi, 'mysql://[redacted]');
  out = out.replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]');
  return out;
}

async function notifyN8n(event, payload) {
  const url = process.env.N8N_WEBHOOK_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!url || !secret) {
    console.warn('[self-heal] N8N_WEBHOOK_URL/SECRET not set, skipping notify:', event);
    return;
  }
  const body = JSON.stringify({ event, branch: currentBranch(), ts: new Date().toISOString(), ...payload });
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Signature': signature },
      body,
    });
  } catch (err) {
    console.warn('[self-heal] notify failed:', err.message);
  }
}

function rateLimited(branch) {
  mkdirSync(STATE_DIR, { recursive: true });
  const lockFile = join(STATE_DIR, `${branch.replace(/[^a-z0-9_-]/gi, '_')}.json`);
  if (existsSync(lockFile)) {
    const last = JSON.parse(readFileSync(lockFile, 'utf8')).ts;
    if (Date.now() - last < RATE_LIMIT_MS) return true;
  }
  writeFileSync(lockFile, JSON.stringify({ ts: Date.now() }));
  return false;
}

function runPlaywright() {
  mkdirSync(join(ROOT, 'e2e-results'), { recursive: true });
  const res = sh('npx', ['playwright', 'test', '--reporter=json'], {
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: RESULTS_PATH },
  });
  let report = null;
  try {
    report = JSON.parse(readFileSync(RESULTS_PATH, 'utf8'));
  } catch {
    return { passed: false, failures: [], raw: redact(res.stdout + res.stderr) };
  }
  const failures = [];
  const walk = (suite) => {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        for (const result of test.results || []) {
          if (result.status && result.status !== 'passed') {
            failures.push({
              title: spec.title,
              file: spec.file,
              error: truncate(redact(result.error?.message || 'unknown error'), MAX_ERROR_CHARS),
              snippet: truncate(redact(result.error?.snippet || ''), MAX_ERROR_CHARS),
              attachments: (result.attachments || []).map((a) => a.path).filter(Boolean),
            });
          }
        }
      }
    }
    for (const sub of suite.suites || []) walk(sub);
  };
  for (const suite of report.suites || []) walk(suite);
  return { passed: failures.length === 0, failures };
}

function buildPrompt(failures, attempt, priorDiffs) {
  let prompt = `Playwright e2e tests are failing (attempt ${attempt}/${MAX_RETRIES}). `
    + `Fix the application source code so these tests pass. Do NOT edit any file under ${TEST_DIRS.join(' or ')} `
    + `— if a failure looks like a wrong/flaky test rather than a real bug, stop and explain instead of editing the test.\n\n`;
  for (const f of failures) {
    prompt += `## ${f.title} (${f.file})\nError:\n${f.error}\n${f.snippet ? `Snippet:\n${f.snippet}\n` : ''}`;
    if (f.attachments.length) prompt += `Attachments: ${f.attachments.join(', ')}\n`;
    prompt += '\n';
  }
  if (priorDiffs.length) {
    prompt += `Prior attempts already tried (did not fix it, don't repeat):\n`;
    // Only the most recent diff in full — older ones summarized to a
    // line each so the prompt doesn't grow with every retry.
    priorDiffs.slice(0, -1).forEach((d, i) => {
      prompt += `--- attempt ${i + 1}: ${d.split('\n').length} line diff, did not fix it (omitted) ---\n`;
    });
    const last = priorDiffs[priorDiffs.length - 1];
    prompt += `--- attempt ${priorDiffs.length} diff (most recent, did not fix it) ---\n${truncate(last, MAX_DIFF_CHARS)}\n`;
  }
  return prompt;
}

function editedTestFiles() {
  const changed = sh('git', ['diff', '--name-only']).stdout.split('\n').filter(Boolean);
  return changed.filter((f) => TEST_DIRS.some((d) => f.startsWith(d)));
}

function callClaude(prompt, effort) {
  // Piped via stdin (not a CLI arg) to avoid shell-quoting issues with
  // long, multi-line prompts containing quotes/backslashes on Windows.
  const args = ['-p', '--permission-mode', 'acceptEdits', '--effort', effort];
  if (process.env.SELF_HEAL_MODEL) args.push('--model', process.env.SELF_HEAL_MODEL);
  const res = spawnSync('claude', args, {
    encoding: 'utf8',
    cwd: ROOT,
    input: prompt,
  });
  return { ok: res.status === 0, output: redact((res.stdout || '') + (res.stderr || '')) };
}

// Antigravity is Google's agentic IDE — wired in here as an optional
// second opinion on the FINAL attempt only, so a fix that Claude couldn't
// find gets a different model family before we give up and escalate to a
// human. We can't verify Antigravity's exact non-interactive CLI flags
// from here, so this is a generic command template, not a hardcoded
// invocation — set ANTIGRAVITY_CMD yourself, e.g.
//   ANTIGRAVITY_CMD="antigravity run --file {PROMPT_FILE} --yes"
// {PROMPT_FILE} is replaced with a path to the prompt text. Leave unset to
// stay on Claude Code for every attempt.
function callAntigravity(prompt) {
  const template = process.env.ANTIGRAVITY_CMD;
  const promptFile = join(STATE_DIR, 'antigravity-prompt.txt');
  writeFileSync(promptFile, prompt);
  const command = template.replace('{PROMPT_FILE}', promptFile);
  const res = sh(command, []);
  return { ok: res.status === 0, output: redact((res.stdout || '') + (res.stderr || '')) };
}

function callAgent(prompt, attemptIndex) {
  const effort = ATTEMPT_EFFORT[Math.min(attemptIndex, ATTEMPT_EFFORT.length - 1)];
  const isFinalAttempt = attemptIndex === MAX_RETRIES - 1;
  if (isFinalAttempt && process.env.ANTIGRAVITY_CMD) {
    console.log('[self-heal] final attempt, routing to Antigravity for a second opinion.');
    return { agent: 'antigravity', effort, ...callAntigravity(prompt) };
  }
  console.log(`[self-heal] routing to Claude Code (effort=${effort}).`);
  return { agent: 'claude', effort, ...callClaude(prompt, effort) };
}

async function main() {
  if (process.env.SELF_HEAL_ENABLED === 'false') {
    console.log('[self-heal] disabled via SELF_HEAL_ENABLED=false, skipping.');
    process.exit(0);
  }
  const branch = currentBranch();
  if (branch === 'main' || branch === 'master') {
    console.log('[self-heal] refusing to heal on protected branch, skipping loop.');
    process.exit(0);
  }
  if (rateLimited(branch)) {
    console.log('[self-heal] rate limited (one run per 10 min per branch), skipping loop.');
    process.exit(0);
  }

  await notifyN8n('run_started', { branch });
  const priorDiffs = [];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = runPlaywright();
    if (result.passed) {
      await notifyN8n(attempt === 0 ? 'run_passed' : 'run_healed', { attempts: attempt });
      console.log(`[self-heal] tests passed${attempt > 0 ? ` after ${attempt} healing attempt(s)` : ''}.`);
      process.exit(0);
    }

    if (attempt === MAX_RETRIES) {
      await notifyN8n('run_escalate', {
        attempts: attempt,
        failures: result.failures,
        diffs: priorDiffs,
      });
      console.error(`[self-heal] still failing after ${MAX_RETRIES} attempts. Push blocked, escalated to n8n.`);
      process.exit(1);
    }

    const prompt = buildPrompt(result.failures, attempt + 1, priorDiffs);
    await notifyN8n('attempt_failed', { attempt: attempt + 1, failures: result.failures });

    const agentResult = callAgent(prompt, attempt);
    const badEdits = editedTestFiles();
    if (badEdits.length) {
      sh('git', ['checkout', '--', ...badEdits]);
      await notifyN8n('run_escalate', {
        attempts: attempt + 1,
        reason: 'healer attempted to edit test files, reverted and stopped',
        editedTestFiles: badEdits,
        agent: agentResult.agent,
      });
      console.error('[self-heal] agent edited test file(s) instead of source — reverted, escalating.');
      process.exit(1);
    }

    const diff = truncate(redact(sh('git', ['diff']).stdout), MAX_DIFF_CHARS);
    priorDiffs.push(diff);
    if (diff.trim()) {
      sh('git', ['add', ...SOURCE_DIRS.filter((d) => existsSync(join(ROOT, d)))]);
      sh('git', ['commit', '-m', `"[self-heal] attempt ${attempt + 1} (${agentResult.agent}/${agentResult.effort}): auto-patch from Playwright failure"`]);
    } else if (!agentResult.ok) {
      console.warn(`[self-heal] ${agentResult.agent} made no changes, will retry once more.`);
    }
  }
}

main();
