import { createHash, randomBytes } from 'crypto';

export type LotteryCandidate = { memberId: string; ticketNo: string; memberName?: string };

export type LotteryDrawResult = {
  winner: LotteryCandidate;
  seed: string;
  index: number;
  candidateTickets: string[];
};

// Auditable draw: winner index = sha256(auctionId:seed) mod candidates.
// Persist seed + candidate list so anyone can recompute and verify the result.
export function drawLotteryWinner(input: {
  candidates: LotteryCandidate[];
  auctionId: string;
  seed?: string;
}): LotteryDrawResult {
  if (!input.candidates.length) throw new Error('No eligible tickets for lottery draw');
  const candidates = [...input.candidates].sort((a, b) => a.ticketNo.localeCompare(b.ticketNo, undefined, { numeric: true }));
  const seed = input.seed ?? randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(`${input.auctionId}:${seed}`).digest();
  const index = hash.readUInt32BE(0) % candidates.length;
  return {
    winner: candidates[index],
    seed,
    index,
    candidateTickets: candidates.map((candidate) => candidate.ticketNo),
  };
}

export function formatDrawEvidence(result: LotteryDrawResult) {
  return `Lottery draw among ${result.candidateTickets.length} tickets [${result.candidateTickets.join(', ')}]; seed ${result.seed}; index ${result.index}; ticket ${result.winner.ticketNo} selected.`;
}
