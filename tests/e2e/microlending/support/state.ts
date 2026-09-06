/**
 * Run state shared between spec files.
 *
 * The suite is one long business journey, so file N+1 needs the ids file N
 * created. Playwright gives no cross-file fixture, so the state is a JSON file
 * written under test-results/ and re-read by every spec that needs it.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const STATE_DIR = path.join(ROOT, 'test-results');
const STATE_FILE = path.join(STATE_DIR, 'ml-run-state.json');

export type Person = { id: string; username: string; password: string; name: string; phone: string };

export type RunState = {
  runId: string;
  password: string;
  tenantA: {
    id: string;
    slug: string;
    owner: Person;
    branches: { hq?: string; erode?: string; salem?: string };
    admin?: Person;
    agentHq?: Person;
    agentErode?: Person;
    routeHq?: string;
    routeErode?: string;
    customerHq?: string;
    customerErode?: string;
    loans: Record<string, string>;
  };
  tenantB: { id: string; slug: string; owner: Person; branchHq?: string };
};

export function stateFile(): string {
  return STATE_FILE;
}

export function saveState(state: RunState): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

export function loadState(): RunState {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(
      'ml-run-state.json is missing — run 01-registration.spec.ts first; the journey specs build on it.',
    );
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as RunState;
}

export function patchState(mutate: (state: RunState) => void): RunState {
  const state = loadState();
  mutate(state);
  saveState(state);
  return state;
}

/** Short, collision-free suffix so a re-run never trips a UNIQUE constraint. */
export function makeRunId(): string {
  const stamp = Date.now().toString(36).slice(-6);
  const rand = Math.random().toString(36).slice(2, 5);
  return `${stamp}${rand}`;
}

/** Deterministic 10-digit Indian mobile derived from the run id + an offset. */
export function runPhone(runId: string, offset: number): string {
  const seed = [...runId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const body = String((seed * 977 + offset * 13) % 900000000 + 100000000).padStart(9, '0');
  return `9${body}`.slice(0, 10);
}
