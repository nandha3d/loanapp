import { inflateRawSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import prisma from '@/lib/db';
import { calculateChitPeriodEngine } from './engineCalculator';
import {
  DEFAULT_ENABLED_CHIT_ENGINE_TYPES,
  type ChitEngineType,
  isBiddingEnabledForPeriod,
  isChitEngineType,
  mapBiddingModeToAuctionType,
  parseChitEngineConfig,
  serializeChitEngineConfig,
} from './engineTypes';
import { getChitTypeSettings } from './settings';
import { roundMoney } from './calculations';
import { createChitAudit } from './audit';
import { nextPeriodDate, parseFrequency } from './frequency';
import { validateChitConfig, validateChitEngineConfig } from './validation';
import { generateCode } from '@/lib/utils';

export interface ParsedWhatsAppMember {
  key: string;
  name: string;
  phone: string | null;
  rawSender: string;
  messageCount: number;
  paymentMentions: number;
  lastAmountHint: number | null;
}

export interface ParsedWhatsAppPeriodHint {
  periodNumber: number | null;
  winnerHint: string | null;
  amountHint: number | null;
  snippet: string;
  dateHint: string | null;
}

export interface WhatsAppParsePreview {
  sourceFormat: 'whatsapp_chat' | 'roster';
  suggestedGroupName: string | null;
  suggestedChitValue: number | null;
  suggestedMonthlyContrib: number | null;
  totalMessagesParsed: number;
  members: ParsedWhatsAppMember[];
  periodHints: ParsedWhatsAppPeriodHint[];
  warnings: string[];
}

export interface ImportMemberInput {
  name: string;
  phone: string;
  ticketNo?: string | null;
  hasWon?: boolean;
  wonPeriodNumber?: number | null;
  wonPrizeAmount?: number | null;
  pendingOpeningDue?: number | null;
}

export interface ImportRunningChitInput {
  name: string;
  chitEngineType?: string;
  chitType?: 'registered' | 'unregistered';
  chitValue: number;
  monthlyContrib: number;
  totalMembers: number;
  completedPeriods: number;
  commissionPct?: number;
  commissionBasis?: 'BID_DISCOUNT' | 'CHIT_VALUE';
  dividendPolicy?: 'ALL_MEMBERS' | 'NON_WINNERS_ONLY' | 'NON_PRIZED_ONLY' | 'NONE';
  dividendDistribution?: 'ADJUST_NEXT_DUE' | 'CASH_PAYOUT' | 'ACCUMULATE' | 'DEFERRED_BONUS_POOL' | 'NONE';
  auctionFrequency?: string;
  startDate: string;
  pinnedAnnouncement?: string | null;
  sourceLabel?: string;
  members: ImportMemberInput[];
}

const SYSTEM_MESSAGE_PATTERNS = [
  /end-to-end encrypted/i,
  /\bcreated group\b/i,
  /\badded\b/i,
  /\bleft\b$/i,
  /\bremoved\b/i,
  /\bjoined using this group/i,
  /\bchanged the subject\b/i,
  /\bchanged this group/i,
  /\bsecurity code changed\b/i,
  /\bYou're now an admin\b/i,
  /<Media omitted>/i,
  /\bdeleted this message\b/i,
  /\bThis message was deleted\b/i,
];

/**
 * Extracts `_chat.txt` or any first `.txt` from a WhatsApp exported `.zip`
 * (supports PKZIP stored=0 and deflate=8 without extra NPM dependencies).
 */
export function extractWhatsAppTxtFromUpload(bytes: Uint8Array | Buffer): string {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  // PKZIP local file header signature: 50 4B 03 04
  if (buf.length >= 30 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    let offset = 0;
    const candidates: Array<{ name: string; content: string }> = [];
    while (offset + 30 <= buf.length) {
      if (buf.readUInt32LE(offset) !== 0x04034b50) break;
      const flags = buf.readUInt16LE(offset + 6);
      const method = buf.readUInt16LE(offset + 8);
      const compSize = buf.readUInt32LE(offset + 18);
      const nameLen = buf.readUInt16LE(offset + 26);
      const extraLen = buf.readUInt16LE(offset + 28);
      const dataStart = offset + 30 + nameLen + extraLen;
      const fileName = buf.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
      if ((flags & 0x08) === 0 && compSize > 0 && dataStart + compSize <= buf.length && /\.txt$/i.test(fileName)) {
        const compressed = buf.subarray(dataStart, dataStart + compSize);
        let text = '';
        if (method === 0) {
          text = compressed.toString('utf8');
        } else if (method === 8) {
          text = inflateRawSync(compressed).toString('utf8');
        }
        if (text) candidates.push({ name: fileName, content: text });
      }
      if ((flags & 0x08) !== 0 || compSize === 0) break;
      offset = dataStart + compSize;
    }
    const preferred =
      candidates.find((c) => /(^|\/)_chat\.txt$/i.test(c.name)) ??
      candidates.find((c) => /whatsapp chat/i.test(c.name)) ??
      candidates[0];
    if (preferred) return preferred.content;
    throw new Error('Could not find a readable .txt chat export inside the uploaded ZIP.');
  }
  return buf.toString('utf8').replace(/^\uFEFF/, '');
}

/** Normalizes Indian & international phone numbers cleanly for matching. */
export function normalizeWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) return digits.slice(2);
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

function parseAmountTokens(text: string): number[] {
  const results: number[] = [];
  const regex = /(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d{3,8})(?:\.\d{1,2})?/gi;
  for (const m of text.matchAll(regex)) {
    const num = Number(m[1].replace(/,/g, ''));
    // Ignore year numbers & 10-digit phone numbers
    if (Number.isFinite(num) && num >= 100 && num <= 100_000_000 && !(num >= 1900 && num <= 2100)) {
      results.push(num);
    }
  }
  return results;
}

function extractPhoneFromString(raw: string): string | null {
  const matches = raw.match(/(?:\+?\d[\d\s-]{8,16}\d)/g);
  if (!matches) return null;
  for (const cand of matches) {
    const norm = normalizeWhatsAppPhone(cand);
    if (norm) return norm;
  }
  return null;
}

const HEADER_PATTERNS = [
  // iOS: [25/11/2026, 7:15:30 PM] Sender Name: Message
  /^\[(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}),?\s+([^\]]+)\]\s+([^:]+):\s*(.*)$/,
  // Android: 25/11/2026, 7:15 pm - Sender Name: Message
  /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?)\s*-\s*([^:]+):\s*(.*)$/i,
];

const SYSTEM_HEADER_PATTERN =
  /^(?:\[?\d{1,2}[/-]\d{1,2}[/-]\d{2,4},?\s+[^\]]+\]?)\s*(?:-\s*)?(.*)$/;

export function parseWhatsAppChatExport(rawText: string): WhatsAppParsePreview {
  const cleanText = rawText.replace(/\u200e|\u202a|\u202c/g, '');
  const lines = cleanText.split(/\r?\n/);

  const messages: Array<{ date: string; sender: string; body: string }> = [];
  let suggestedGroupName: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Grab group name hint from WhatsApp subject change line
    const subjMatch = trimmed.match(/changed the subject from\s+"[^"]+"\s+to\s+"([^"]+)"/i)
      ?? trimmed.match(/created group\s+"([^"]+)"/i);
    if (subjMatch?.[1]) {
      suggestedGroupName = subjMatch[1].trim();
    }

    let matched = false;
    for (const pat of HEADER_PATTERNS) {
      const m = trimmed.match(pat);
      if (m) {
        messages.push({ date: m[1], sender: m[3].trim(), body: m[4].trim() });
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (SYSTEM_HEADER_PATTERN.test(trimmed) && SYSTEM_MESSAGE_PATTERNS.some((rx) => rx.test(trimmed))) {
        continue;
      }
      if (messages.length > 0 && !/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(trimmed)) {
        messages[messages.length - 1].body += `\n${trimmed}`;
      }
    }
  }

  const memberMap = new Map<string, ParsedWhatsAppMember>();
  const periodHints: ParsedWhatsAppPeriodHint[] = [];
  const chitValueVotes = new Map<number, number>();
  const contribVotes = new Map<number, number>();

  for (const msg of messages) {
    if (SYSTEM_MESSAGE_PATTERNS.some((rx) => rx.test(msg.body))) {
      // ignore system notice bodies
    }

    const senderPhone = extractPhoneFromString(msg.sender);
    const bodyPhone = !senderPhone && msg.body.length < 40 ? extractPhoneFromString(msg.body) : null;
    const key = senderPhone ?? msg.sender.toLowerCase();
    const displayName =
      senderPhone && /^[\d+\s()-]+$/.test(msg.sender)
        ? `Member ${senderPhone.slice(-4)}`
        : msg.sender.replace(/[~]/g, '').trim() || 'Unknown';

    const existing = memberMap.get(key) ?? {
      key,
      name: displayName,
      phone: senderPhone ?? bodyPhone,
      rawSender: msg.sender,
      messageCount: 0,
      paymentMentions: 0,
      lastAmountHint: null,
    };
    existing.messageCount += 1;
    if (!existing.phone && bodyPhone) existing.phone = bodyPhone;

    const amounts = parseAmountTokens(msg.body);
    if (/\b(paid|gpay|phonepe|upi|sent|transfer|done|remitted)\b/i.test(msg.body)) {
      existing.paymentMentions += 1;
      if (amounts.length > 0) existing.lastAmountHint = amounts[amounts.length - 1];
    }
    memberMap.set(key, existing);

    // Infer chit value & contribution hints (prefer keyword-adjacent numbers)
    const explicitChit = msg.body.match(/(?:\bchit|\bpot|\bpool|\bscheme|\bfund|\bvalue)[^\d₹]{0,20}(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d{4,8})/i);
    if (explicitChit?.[1]) {
      const val = Number(explicitChit[1].replace(/,/g, ''));
      if (val >= 25_000) chitValueVotes.set(val, (chitValueVotes.get(val) ?? 0) + 3);
    } else if (/\b(chit|pot|group|fund|scheme)\b/i.test(msg.body)) {
      for (const amt of amounts) {
        if (amt >= 25_000) chitValueVotes.set(amt, (chitValueVotes.get(amt) ?? 0) + 1);
      }
    }

    const explicitContrib = msg.body.match(/(?:\binstallment|\binstalment|\bmonthly|\bcontrib(?:ution)?|\bdue|\bsubscription|\bper\s+member)[^\d₹]{0,20}(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d{3,6})/i);
    if (explicitContrib?.[1]) {
      const val = Number(explicitContrib[1].replace(/,/g, ''));
      if (val >= 200 && val <= 200_000) contribVotes.set(val, (contribVotes.get(val) ?? 0) + 3);
    } else if (/\b(installment|instalment|due|monthly|contrib|each|subscription|per member)\b/i.test(msg.body)) {
      for (const amt of amounts) {
        if (amt >= 200 && amt <= 200_000) contribVotes.set(amt, (contribVotes.get(amt) ?? 0) + 1);
      }
    }

    // Detect candidate completed auctions / winner notices
    if (/\b(winner|won|prized|auction|bid|discount|commission|dividend)\b/i.test(msg.body)) {
      const periodMatch = msg.body.match(/\b(?:period|month|cycle|auction|round)\s*[#:-]?\s*(\d{1,2})\b/i);
      const winnerLineMatch = msg.body.match(/\b(?:winner|won by|prized)\s*[:\-–]?\s*([A-Za-z][A-Za-z0-9 .]{1,35})/i);
      if (periodMatch || winnerLineMatch) {
        periodHints.push({
          periodNumber: periodMatch ? Number(periodMatch[1]) : null,
          winnerHint: winnerLineMatch ? winnerLineMatch[1].trim() : msg.sender,
          amountHint: amounts[0] ?? null,
          snippet: msg.body.replace(/\s+/g, ' ').slice(0, 120),
          dateHint: msg.date,
        });
      }
    }
  }

  const pickTop = (votes: Map<number, number>): number | null => {
    let best: number | null = null;
    let max = 0;
    for (const [val, count] of votes.entries()) {
      if (count > max) {
        max = count;
        best = val;
      }
    }
    return best;
  };

  const members = Array.from(memberMap.values());
  const warnings: string[] = [];
  const missingPhoneCount = members.filter((m) => !m.phone).length;
  if (missingPhoneCount > 0) {
    warnings.push(`${missingPhoneCount} contact(s) exported by saved display name without a phone number — enter their mobile numbers before importing.`);
  }
  if (members.length === 0) {
    warnings.push('No WhatsApp chat messages matched standard formats. Try the Paste Member List / CSV tab instead.');
  }

  return {
    sourceFormat: 'whatsapp_chat',
    suggestedGroupName,
    suggestedChitValue: pickTop(chitValueVotes),
    suggestedMonthlyContrib: pickTop(contribVotes),
    totalMessagesParsed: messages.length,
    members,
    periodHints: periodHints.slice(0, 30),
    warnings,
  };
}

export function parseChitRosterText(rawText: string): WhatsAppParsePreview {
  const lines = rawText.split(/\r?\n/);
  const members: ParsedWhatsAppMember[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const clean = line.trim();
    if (!clean || /^name\s*[,;\t]/i.test(clean)) continue;
    const phone = extractPhoneFromString(clean);
    const stripped = clean
      .replace(/^\d+[.)]\s*/, '')
      .replace(/(?:\+?\d[\d\s-]{8,16}\d)/g, '')
      .replace(/[,;\t|-]+/g, ' ')
      .trim();
    const name = stripped || (phone ? `Member ${phone.slice(-4)}` : '');
    if (!name && !phone) continue;
    const key = phone ?? name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    members.push({
      key,
      name: name || `Member ${members.length + 1}`,
      phone,
      rawSender: clean,
      messageCount: 0,
      paymentMentions: 0,
      lastAmountHint: null,
    });
  }

  return {
    sourceFormat: 'roster',
    suggestedGroupName: null,
    suggestedChitValue: null,
    suggestedMonthlyContrib: null,
    totalMessagesParsed: 0,
    members,
    periodHints: [],
    warnings: members.some((m) => !m.phone)
      ? ['Some rows do not contain a 10-digit mobile number — fill them before importing.']
      : [],
  };
}

export interface ChitImportActor {
  tenantId: string;
  appType: string;
  branchId: string | null;
  userId: string;
  role: string;
}

export async function importRunningChitGroup(actor: ChitImportActor, rawInput: ImportRunningChitInput) {
  if (!['admin', 'superadmin', 'developer'].includes(actor.role)) {
    throw new Error('Forbidden');
  }
  const name = rawInput.name.trim();
  if (!name) throw new Error('Chit group name is required');
  if (!(rawInput.chitValue > 0)) throw new Error('Chit value must be greater than zero');
  if (!(rawInput.monthlyContrib > 0)) throw new Error('Installment amount must be greater than zero');
  if (!Number.isInteger(rawInput.totalMembers) || rawInput.totalMembers < 2 || rawInput.totalMembers > 60) {
    throw new Error('Total members must be between 2 and 60');
  }
  const completedPeriods = Math.max(0, Math.min(rawInput.totalMembers, Math.trunc(rawInput.completedPeriods || 0)));
  if (rawInput.members.length === 0 || rawInput.members.length > rawInput.totalMembers) {
    throw new Error(`Provide between 1 and ${rawInput.totalMembers} member rows.`);
  }

  const startDate = new Date(rawInput.startDate);
  if (Number.isNaN(startDate.getTime())) throw new Error('Invalid start date');

  // Verify chit engine type is enabled for tenant (STABLE-2)
  const rawEngine = rawInput.chitEngineType && isChitEngineType(rawInput.chitEngineType)
    ? rawInput.chitEngineType
    : 'AUCTION_STANDARD';
  const settings = await getChitTypeSettings(actor.tenantId);
  const allowed = new Set<ChitEngineType>(settings.enabledTypes ?? DEFAULT_ENABLED_CHIT_ENGINE_TYPES);
  if (!allowed.has(rawEngine)) {
    throw new Error(`Chit type "${rawEngine}" is disabled for this organization.`);
  }

  const commissionPct = rawInput.commissionPct ?? 5;
  const commissionBasis = rawInput.commissionBasis ?? 'BID_DISCOUNT';
  const dividendPolicy = rawInput.dividendPolicy ?? 'ALL_MEMBERS';
  const dividendDistribution = rawInput.dividendDistribution ?? 'ADJUST_NEXT_DUE';
  const engineCfg = parseChitEngineConfig(null, rawEngine);
  engineCfg.foremanCompensation.commissionPct = commissionPct;
  const auctionType = mapBiddingModeToAuctionType(rawEngine, engineCfg.biddingMode);

  validateChitEngineConfig(rawEngine, engineCfg, { totalMembers: rawInput.totalMembers, requireScheduleRows: false });
  validateChitConfig({
    auctionType,
    commissionBasis,
    dividendPolicy,
    dividendDistribution,
    tieBreakRule: 'EARLIEST_BID',
  });

  // Deduplicate normalized phones and resolve branch scope (SCOPE-12)
  const sanitizedMembers = rawInput.members.map((m, idx) => {
    const cleanPhone = normalizeWhatsAppPhone(m.phone);
    if (!cleanPhone) throw new Error(`Member #${idx + 1} (${m.name || 'Unnamed'}) is missing a valid phone number.`);
    return {
      name: m.name.trim() || `Member ${idx + 1}`,
      phone: cleanPhone,
      ticketNo: m.ticketNo?.trim() || String(idx + 1),
      hasWon: Boolean(m.hasWon),
      wonPeriodNumber: m.wonPeriodNumber && m.wonPeriodNumber >= 1 && m.wonPeriodNumber <= completedPeriods
        ? Math.trunc(m.wonPeriodNumber)
        : null,
      wonPrizeAmount: m.wonPrizeAmount != null && m.wonPrizeAmount > 0 ? roundMoney(m.wonPrizeAmount) : null,
      pendingOpeningDue: m.pendingOpeningDue != null && m.pendingOpeningDue > 0 ? roundMoney(m.pendingOpeningDue) : 0,
    };
  });

  const phoneSet = new Set<string>();
  for (const m of sanitizedMembers) {
    if (phoneSet.has(m.phone)) throw new Error(`Duplicate member phone number in import: ${m.phone}`);
    phoneSet.add(m.phone);
  }

  return prisma.$transaction(async (tx) => {
    const resolvedBranchId =
      actor.branchId ??
      (await tx.branch
        .findMany({ where: { tenantId: actor.tenantId, status: 'active' }, select: { id: true }, take: 2 })
        .then((rows) => (rows.length === 1 ? rows[0].id : null)));
    if (!resolvedBranchId && !actor.branchId) {
      throw new Error('Select an active branch before importing a WhatsApp chit group.');
    }

    const existingCount = await tx.chitGroup.count({ where: { tenantId: actor.tenantId } });
    const groupCode = generateCode('CF', existingCount + 1, 5);
    const freq = parseFrequency({ auctionFrequency: rawInput.auctionFrequency ?? 'monthly' });

    const group = await tx.chitGroup.create({
      data: {
        tenantId: actor.tenantId,
        branchId: resolvedBranchId || undefined,
        appType: 'chitfunds',
        groupCode,
        name,
        chitValue: roundMoney(rawInput.chitValue),
        monthlyContrib: roundMoney(rawInput.monthlyContrib),
        totalMembers: rawInput.totalMembers,
        durationMonths: rawInput.totalMembers,
        commissionPct,
        commissionBasis,
        dividendPolicy,
        dividendDistribution,
        startDate,
        status: completedPeriods >= rawInput.totalMembers ? 'completed' : 'active',
        complianceStatus: 'active',
        chitType: rawInput.chitType === 'registered' ? 'registered' : 'unregistered',
        chitEngineType: rawEngine,
        engineConfig: serializeChitEngineConfig(engineCfg),
        auctionType,
        auctionFrequency: rawInput.auctionFrequency ?? 'monthly',
        roomChatMode: 'open',
        pinnedAnnouncement:
          rawInput.pinnedAnnouncement?.trim() ||
          `Migrated from ${rawInput.sourceLabel || 'WhatsApp'} · Periods 1–${completedPeriods} recorded as historical.`,
      },
    });

    // Resolve or create Customer rows strictly within (tenantId, appType, branchId)
    const createdMembers: Array<{
      id: string;
      name: string;
      ticketNo: string;
      hasWon: boolean;
      wonPeriodNumber: number | null;
      wonPrizeAmount: number | null;
      pendingOpeningDue: number;
    }> = [];

    for (const [idx, row] of sanitizedMembers.entries()) {
      const candidates = [row.phone, `91${row.phone}`, `+91${row.phone}`];
      let customer = await tx.customer.findFirst({
        where: {
          tenantId: actor.tenantId,
          appType: 'chitfunds',
          phone: { in: candidates },
          deletedAt: null,
          ...(resolvedBranchId ? { branchId: resolvedBranchId } : {}),
        },
        select: { id: true, name: true },
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            tenantId: actor.tenantId,
            appType: 'chitfunds',
            branchId: resolvedBranchId || undefined,
            customerCode: `CUST-${randomUUID().slice(0, 8).toUpperCase()}`,
            name: row.name,
            phone: row.phone,
            status: 'active',
          },
          select: { id: true, name: true },
        });
        await tx.auditLog.create({
          data: {
            tenantId: actor.tenantId,
            userId: actor.userId,
            action: 'import',
            entityType: 'customer',
            entityId: customer.id,
            newValue: JSON.stringify({ name: row.name, phone: row.phone, source: 'whatsapp_chit_import' }),
          },
        });
      }

      const member = await tx.chitMember.create({
        data: {
          chitGroupId: group.id,
          customerId: customer.id,
          memberNumber: idx + 1,
          ticketNo: row.ticketNo,
          ticketShare: 1,
          subscriberStatus: 'active',
          agreementStatus: group.chitType === 'registered' ? 'pending' : 'signed',
          agreementSignedAt: group.chitType === 'registered' ? null : new Date(),
          hasWon: row.hasWon,
          wonAt: row.hasWon ? startDate : null,
        },
      });
      createdMembers.push({
        id: member.id,
        name: row.name,
        ticketNo: row.ticketNo,
        hasWon: row.hasWon,
        wonPeriodNumber: row.wonPeriodNumber,
        wonPrizeAmount: row.wonPrizeAmount,
        pendingOpeningDue: row.pendingOpeningDue,
      });
    }

    // Distribute historical winners across completed periods if specific period numbers omitted
    const pastWinners = createdMembers.filter((m) => m.hasWon);
    const winnerByPeriod = new Map<number, typeof createdMembers[number]>();
    for (const w of pastWinners) {
      if (w.wonPeriodNumber && !winnerByPeriod.has(w.wonPeriodNumber)) {
        winnerByPeriod.set(w.wonPeriodNumber, w);
      }
    }
    let nextUnassignedPeriod = 1;
    for (const w of pastWinners) {
      if (!w.wonPeriodNumber) {
        while (winnerByPeriod.has(nextUnassignedPeriod) && nextUnassignedPeriod <= completedPeriods) {
          nextUnassignedPeriod += 1;
        }
        if (nextUnassignedPeriod <= completedPeriods) {
          winnerByPeriod.set(nextUnassignedPeriod, w);
          nextUnassignedPeriod += 1;
        }
      }
    }

    // Create historical (1..completedPeriods) + active/upcoming (completedPeriods+1..N) auctions & subscriptions
    for (let period = 1; period <= rawInput.totalMembers; period++) {
      const periodDate = nextPeriodDate(startDate, period, freq);
      const isHistorical = period <= completedPeriods;
      const histWinner = isHistorical ? winnerByPeriod.get(period) ?? null : null;

      let histBreakdownJson: string | undefined;
      let histPrize: number | undefined;
      let histDiscount: number | undefined;
      let histCommission: number | undefined;
      let histDividend: number | undefined;

      if (isHistorical) {
        const prizeInput = histWinner?.wonPrizeAmount ?? roundMoney(rawInput.chitValue);
        const bd = calculateChitPeriodEngine({
          engineType: rawEngine,
          config: engineCfg,
          chitValue: roundMoney(rawInput.chitValue),
          monthlyContrib: roundMoney(rawInput.monthlyContrib),
          totalMembers: rawInput.totalMembers,
          periodNumber: period,
          commissionPct,
          commissionBasis,
          dividendPolicy,
          dividendDistribution,
          winnerMemberIds: histWinner ? [histWinner.id] : [],
          prizeAmount: prizeInput,
          members: createdMembers.map((m) => ({
            memberId: m.id,
            memberName: m.name,
            ticketNo: m.ticketNo,
            ticketShare: 1,
            hasWonBeforePeriod: m.hasWon && histWinner?.id !== m.id,
            isActive: true,
          })),
        });
        histPrize = bd.prizeAmount;
        histDiscount = bd.bidDiscount;
        histCommission = bd.commission;
        histDividend = bd.dividendPerTicket;
        histBreakdownJson = JSON.stringify(bd);
      }

      await tx.chitAuction.create({
        data: {
          chitGroupId: group.id,
          periodNumber: period,
          auctionDate: periodDate,
          scheduledAt: periodDate,
          status: isHistorical ? 'completed' : 'pending',
          roomStatus: isHistorical ? 'closed' : 'scheduled',
          payoutStatus: isHistorical ? 'paid' : 'not_ready',
          winnerMemberId: histWinner?.id ?? undefined,
          prizeAmount: histPrize,
          bidDiscount: histDiscount,
          commission: histCommission,
          dividend: histDividend,
          calculationBreakdown: histBreakdownJson,
          completedAt: isHistorical ? periodDate : undefined,
          confirmedAt: isHistorical ? periodDate : undefined,
          confirmedById: isHistorical ? actor.userId : undefined,
          minutesText: isHistorical
            ? `Historical period ${period} imported from ${rawInput.sourceLabel || 'WhatsApp'}${histWinner ? ` — Winner: ${histWinner.name} (#${histWinner.ticketNo})` : ''}.`
            : undefined,
        },
      });

      const isBiddablePeriod = isBiddingEnabledForPeriod({ chitEngineType: rawEngine, auctionType }, period);
      void isBiddablePeriod;

      for (const m of createdMembers) {
        const base = roundMoney(rawInput.monthlyContrib);
        const isLastHistoricalWithArrears = isHistorical && period === completedPeriods && m.pendingOpeningDue > 0;
        const paid = isHistorical
          ? isLastHistoricalWithArrears
            ? Math.max(0, roundMoney(base - m.pendingOpeningDue))
            : base
          : 0;
        const status = !isHistorical
          ? 'upcoming'
          : isLastHistoricalWithArrears
            ? paid > 0
              ? 'partial'
              : 'missed'
            : 'paid';

        await tx.chitSubscription.create({
          data: {
            memberId: m.id,
            periodNumber: period,
            dueDate: periodDate,
            dueAmount: base,
            baseDueAmount: base,
            paidAmount: paid,
            paidAt: isHistorical && paid > 0 ? periodDate : undefined,
            status,
          },
        });
      }
    }

    await tx.chitRoomMessage.create({
      data: {
        tenantId: actor.tenantId,
        chitGroupId: group.id,
        senderUserId: actor.userId,
        senderName: 'Chit Admin',
        visibility: 'public',
        messageType: 'system_notice',
        body: `Imported "${group.name}" from ${rawInput.sourceLabel || 'WhatsApp'}: ${createdMembers.length} member(s), ${completedPeriods} historical period(s) restored. Next active cycle: Period ${Math.min(rawInput.totalMembers, completedPeriods + 1)}.`,
      },
    });

    await createChitAudit(tx, {
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'import_whatsapp_group',
      entityType: 'chit_group',
      entityId: group.id,
      newValue: {
        groupCode: group.groupCode,
        memberCount: createdMembers.length,
        completedPeriods,
      },
    });

    return {
      groupId: group.id,
      groupCode: group.groupCode,
      name: group.name,
      enrolledCount: createdMembers.length,
      completedPeriods,
    };
  });
}
