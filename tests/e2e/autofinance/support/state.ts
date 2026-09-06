/**
 * Run state shared between Auto Finance spec files.
 *
 * Same pattern as the other module suites: Playwright has no cross-file
 * fixture, so the ids one spec creates are written to a JSON file under
 * test-results/ and re-read by the specs that build on them.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const STATE_DIR = path.join(ROOT, 'test-results');
const STATE_FILE = path.join(STATE_DIR, 'auto-run-state.json');

export type Person = { id: string; username: string; password: string; name: string; phone: string };

export type AutoRunState = {
  runId: string;
  password: string;
  tenantA: {
    id: string;
    slug: string;
    owner: Person;
    admin?: Person;
    agentHq?: Person;
    agentErode?: Person;
    branches: { hq?: string; erode?: string };
    branchCodes: { hq?: string; erode?: string };
    /** Customer ids per branch — a vehicle is always filed against a customer. */
    customers: { hq: string[]; erode: string[] };
    /** Route ids, because an agent may only file customers on their own route. */
    routes: { hq?: string; erode?: string };
    partners: { broker?: string; dealer?: string };
    vehicles: Record<string, string>;
    loans: Record<string, string>;
  };
  /** A second tenant without the autofinance module — the gating fixture. */
  tenantB: { id: string; slug: string; owner: Person; branchHq?: string; customerId?: string };
};

export function stateFile(): string {
  return STATE_FILE;
}

export function saveState(state: AutoRunState): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

export function loadState(): AutoRunState {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(
      'auto-run-state.json is missing — run 01-provisioning.spec.ts first; the journey specs build on it.',
    );
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as AutoRunState;
}

export function patchState(mutate: (state: AutoRunState) => void): AutoRunState {
  const state = loadState();
  mutate(state);
  saveState(state);
  return state;
}
