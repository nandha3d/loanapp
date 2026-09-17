/**
 * Run state shared between chit spec files.
 *
 * Same pattern as the micro-lending suite: Playwright has no cross-file
 * fixture, so the ids one spec creates are written to a JSON file under
 * test-results/ and re-read by the specs that build on them.
 *
 * The fixture groups are named rather than numbered in the type so a spec reads
 * as the business case it is testing — `groups.live` is the open_live room, not
 * "G2".
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const STATE_DIR = path.join(ROOT, 'test-results');
const STATE_FILE = path.join(STATE_DIR, 'chit-run-state.json');

export type Person = { id: string; username: string; password: string; name: string; phone: string };

export type SeededGroup = {
  id: string;
  name: string;
  chitValue: number;
  totalMembers: number;
  monthlyContrib: number;
  branchId: string;
  /** memberId per ticket number, so a spec can say "ticket 7" and mean it. */
  membersByTicket: Record<string, string>;
  /** customerId per ticket, for the borrower-portal specs. */
  customersByTicket: Record<string, string>;
};

export type ChitRunState = {
  runId: string;
  password: string;
  tenantA: {
    id: string;
    slug: string;
    owner: Person;
    admin?: Person;
    agentHq?: Person;
    branches: { hq?: string; erode?: string };
    branchCodes: { hq?: string; erode?: string };
    /** Customer ids seeded per branch — chit members are customers. */
    customers?: { hq: string[]; erode: string[] };
    groups: {
      /** open_manual, the default arithmetic fixture */
      manual?: SeededGroup;
      /** open_live with bells, increments and a discount cap */
      live?: SeededGroup;
      /** lottery with LOTTERY_AMONG_TIED */
      lottery?: SeededGroup;
      /** chitType registered — the activation-gate fixture, deliberately unactivated */
      registered?: SeededGroup;
      /** an Erode group, for branch isolation */
      erode?: SeededGroup;
      /** sealed, for bid-visibility assertions */
      sealed?: SeededGroup;
      /** fixed_rotation, for the draw order assertions */
      rotation?: SeededGroup;
      /** one ticket split into two halves — the ticketShare fixture */
      halfTicket?: SeededGroup;
    };
    /** auctionId per fixture group, for the period under test. */
    auctions: Record<string, string>;
  };
  /** A second tenant with chitfunds disabled — the module-gating fixture. */
  tenantB: { id: string; slug: string; owner: Person; branchHq?: string };
};

export function stateFile(): string {
  return STATE_FILE;
}

export function saveState(state: ChitRunState): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

export function loadState(): ChitRunState {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(
      'chit-run-state.json is missing — run 01-provisioning.spec.ts first; the journey specs build on it.',
    );
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as ChitRunState;
}

export function patchState(mutate: (state: ChitRunState) => void): ChitRunState {
  const state = loadState();
  mutate(state);
  saveState(state);
  return state;
}

/** The group a spec asks for, with a message that names the missing fixture. */
export function group(state: ChitRunState, key: keyof ChitRunState['tenantA']['groups']): SeededGroup {
  const found = state.tenantA.groups[key];
  if (!found) {
    throw new Error(`Fixture group "${key}" was never seeded — check 02-group-setup.spec.ts`);
  }
  return found;
}

/** memberId for a ticket, so a spec never hardcodes a cuid. */
export function ticket(g: SeededGroup, ticketNo: string): string {
  const memberId = g.membersByTicket[ticketNo];
  if (!memberId) throw new Error(`Ticket ${ticketNo} is not seeded on ${g.name}`);
  return memberId;
}
