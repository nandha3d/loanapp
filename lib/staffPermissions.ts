/**
 * Role customization & element-level staff / foreman privileges.
 *
 * Per ENGINEERING_REFERENCE.md ROLE-3 and STABLE-2:
 * - Base `User.role` remains one of `agent | admin | superadmin | developer`.
 * - Custom roles (`CustomRole`) and per-staff JSON capabilities (`User.staffPermissions`)
 *   grant explicit additive permissions to `agent`/staff logins (e.g. Head Foreman,
 *   Co-Foreman, Auctioneer, Chit Staff, Accounts Staff) without widening any untouched
 *   existing `agent` account (`staffPermissions == null` => all false).
 */

export type StaffPermissionKey =
  // Portal & Navigation Elements
  | 'canAccessForemanPortal'
  | 'canViewDashboard'
  | 'canViewChits'
  | 'canViewAccounting'
  | 'canViewReports'
  // Chit Group & Member Elements
  | 'canManageChits'
  | 'canImportChits'
  | 'canEnrollMembers'
  | 'canVerifyAgreements'
  | 'canAssignForemen'
  // Live Room, Chat & Auction Controls
  | 'canConductAuction'
  | 'canEnterBidsOnBehalf'
  | 'canModerateGroupRoom'
  | 'canRescheduleAuction'
  // Collections, Security & Payouts
  | 'canCollectChits'
  | 'canVerifyPaymentProofs'
  | 'canApproveSecurity'
  | 'canReleasePayout'
  // Customers, Exports & Alerts
  | 'canManageCustomers'
  | 'canExportPdfStatements'
  | 'canSendNotifications';

export type StaffPermissionGroupKey =
  | 'portal'
  | 'chits'
  | 'auction'
  | 'finance'
  | 'general';

export type StaffPermissions = Record<StaffPermissionKey, boolean>;

export const EMPTY_STAFF_PERMISSIONS: StaffPermissions = {
  canAccessForemanPortal: false,
  canViewDashboard: false,
  canViewChits: false,
  canViewAccounting: false,
  canViewReports: false,
  canManageChits: false,
  canImportChits: false,
  canEnrollMembers: false,
  canVerifyAgreements: false,
  canAssignForemen: false,
  canConductAuction: false,
  canEnterBidsOnBehalf: false,
  canModerateGroupRoom: false,
  canRescheduleAuction: false,
  canCollectChits: false,
  canVerifyPaymentProofs: false,
  canApproveSecurity: false,
  canReleasePayout: false,
  canManageCustomers: false,
  canExportPdfStatements: false,
  canSendNotifications: false,
};

export const ALL_STAFF_PERMISSION_KEYS: StaffPermissionKey[] = Object.keys(
  EMPTY_STAFF_PERMISSIONS,
) as StaffPermissionKey[];

export interface StaffPermissionGroupMeta {
  id: StaffPermissionGroupKey;
  title: string;
  icon: string;
  description: string;
}

export const STAFF_PERMISSION_GROUPS: StaffPermissionGroupMeta[] = [
  {
    id: 'portal',
    title: 'Portal & Navigation Elements',
    icon: 'space_dashboard',
    description: 'Control which screens and sidebar sections appear for this staff role.',
  },
  {
    id: 'chits',
    title: 'Chit Group & Member Elements',
    icon: 'savings',
    description: 'Enable creating groups, importing WhatsApp plans, enrolling tickets, and verifying agreements.',
  },
  {
    id: 'auction',
    title: 'Live Room, Chat & Auction Controls',
    icon: 'gavel',
    description: 'Manage auction rounds, proxy bidding, chat moderation, bells, and cycle schedules.',
  },
  {
    id: 'finance',
    title: 'Collections, Security & Payouts',
    icon: 'payments',
    description: 'Control installment collections, payment proof verification, security approvals, and prize payout release.',
  },
  {
    id: 'general',
    title: 'Customers, PDFs & Notifications',
    icon: 'people',
    description: 'Toggle direct customer management, 6-language PDF exports, and outbound notices.',
  },
];

export interface StaffPermissionMeta {
  key: StaffPermissionKey;
  label: string;
  description: string;
  group: StaffPermissionGroupKey;
}

export const STAFF_PERMISSION_META: StaffPermissionMeta[] = [
  // 1. Portal & Navigation Elements
  {
    key: 'canAccessForemanPortal',
    label: 'Foreman / Staff Portal',
    description: 'Show the Foreman & Staff Portal nav link and assigned chit workspace.',
    group: 'portal',
  },
  {
    key: 'canViewDashboard',
    label: 'Main Dashboard & KPIs',
    description: 'View executive summary cards, collection velocity, and branch KPIs.',
    group: 'portal',
  },
  {
    key: 'canViewChits',
    label: 'Chit Groups Directory',
    description: 'Open Chit Groups list, group cards, schedules, and member ledgers.',
    group: 'portal',
  },
  {
    key: 'canViewAccounting',
    label: 'Accounting & P&L Ledger',
    description: 'Access capital flow, payouts, dividends, and P&L accounting view.',
    group: 'portal',
  },
  {
    key: 'canViewReports',
    label: 'Reports & Analytics',
    description: 'View analytics charts, commission statements, and period ledgers.',
    group: 'portal',
  },

  // 2. Chit Group & Member Elements
  {
    key: 'canManageChits',
    label: 'Create & Edit Chit Groups',
    description: 'Create new chit groups, edit settings, activate drafts, or cancel groups.',
    group: 'chits',
  },
  {
    key: 'canImportChits',
    label: 'WhatsApp / Bulk Chit Import',
    description: 'Import chit schedules and member lists directly from WhatsApp text.',
    group: 'chits',
  },
  {
    key: 'canEnrollMembers',
    label: 'Enroll Tickets & Edit Members',
    description: 'Add single or multi-ticket seats for customers and edit nominee details.',
    group: 'chits',
  },
  {
    key: 'canVerifyAgreements',
    label: 'Verify Subscriber Agreements',
    description: 'Sign off and verify chit subscriber agreements before group activation.',
    group: 'chits',
  },
  {
    key: 'canAssignForemen',
    label: 'Assign Group Foremen',
    description: 'Add/remove co-foremen and promote primary foremen on groups.',
    group: 'chits',
  },

  // 3. Live Room, Chat & Auction Controls
  {
    key: 'canConductAuction',
    label: 'Start / Finalize Auctions & Draws',
    description: 'Open auction sessions, draw lottery winners, and confirm winning bids.',
    group: 'auction',
  },
  {
    key: 'canEnterBidsOnBehalf',
    label: 'Record Proxy Bids & Retract Bids',
    description: 'Place floor/agent bids for present subscribers or retract erroneous bids.',
    group: 'auction',
  },
  {
    key: 'canModerateGroupRoom',
    label: 'Group Chat & Pinned Notices',
    description: 'Post pinned announcements and toggle member chat mode inside group rooms.',
    group: 'auction',
  },
  {
    key: 'canRescheduleAuction',
    label: 'Reschedule Cycles & Ring Bell',
    description: 'Change upcoming auction date/time and trigger 3-bell countdowns.',
    group: 'auction',
  },

  // 4. Collections, Security & Payouts
  {
    key: 'canCollectChits',
    label: 'Record Member Subscriptions',
    description: 'Collect chit installments in cash/UPI/bank and issue digital receipts.',
    group: 'finance',
  },
  {
    key: 'canVerifyPaymentProofs',
    label: 'Approve / Reject Payment Proofs',
    description: 'Review subscriber-uploaded UPI screenshots and mark dues settled.',
    group: 'finance',
  },
  {
    key: 'canApproveSecurity',
    label: 'Approve Winner Collateral / Guarantors',
    description: 'Verify prized member guarantor documents and release payout holds.',
    group: 'finance',
  },
  {
    key: 'canReleasePayout',
    label: 'Release Prize Payout & Denominations',
    description: 'Disburse net prize money and record cash note denomination slips.',
    group: 'finance',
  },

  // 5. Customers, PDFs & Notifications
  {
    key: 'canManageCustomers',
    label: 'Create & Edit Customers Directly',
    description: 'Add and update customer profiles directly without admin approval queue.',
    group: 'general',
  },
  {
    key: 'canExportPdfStatements',
    label: 'Download 6-Language PDF Statements',
    description: 'Generate settlement PDFs and member ledgers in EN/TA/HI/TE/KN/ML.',
    group: 'general',
  },
  {
    key: 'canSendNotifications',
    label: 'Send Auction Notices & Reminders',
    description: 'Trigger WhatsApp/SMS auction invitations and due reminders.',
    group: 'general',
  },
];

export interface DefaultRoleTemplate {
  key: string;
  name: string;
  description: string;
  permissions: Partial<StaffPermissions>;
}

export const DEFAULT_ROLE_TEMPLATES: DefaultRoleTemplate[] = [
  {
    key: 'head_foreman',
    name: 'Head Foreman',
    description: 'Full chit operations: manage groups, conduct auctions, verify security, release payouts, and view reports.',
    permissions: {
      canAccessForemanPortal: true,
      canViewDashboard: true,
      canViewChits: true,
      canViewAccounting: true,
      canViewReports: true,
      canManageChits: true,
      canImportChits: true,
      canEnrollMembers: true,
      canVerifyAgreements: true,
      canAssignForemen: true,
      canConductAuction: true,
      canEnterBidsOnBehalf: true,
      canModerateGroupRoom: true,
      canRescheduleAuction: true,
      canCollectChits: true,
      canVerifyPaymentProofs: true,
      canApproveSecurity: true,
      canReleasePayout: true,
      canManageCustomers: true,
      canExportPdfStatements: true,
      canSendNotifications: true,
    },
  },
  {
    key: 'co_foreman',
    name: 'Co-Foreman / Auctioneer',
    description: 'Runs assigned chit auctions, moderates live rooms, collects subscriptions, and downloads reports.',
    permissions: {
      canAccessForemanPortal: true,
      canViewChits: true,
      canViewReports: true,
      canConductAuction: true,
      canEnterBidsOnBehalf: true,
      canModerateGroupRoom: true,
      canRescheduleAuction: true,
      canCollectChits: true,
      canVerifyPaymentProofs: true,
      canManageCustomers: true,
      canExportPdfStatements: true,
    },
  },
  {
    key: 'chit_staff',
    name: 'Chit Staff / Coordinator',
    description: 'Views assigned chit groups in the Foreman Portal, enrolls tickets, collects dues, and updates customer records.',
    permissions: {
      canAccessForemanPortal: true,
      canViewChits: true,
      canEnrollMembers: true,
      canCollectChits: true,
      canVerifyPaymentProofs: true,
      canManageCustomers: true,
      canSendNotifications: true,
    },
  },
  {
    key: 'accounts_staff',
    name: 'Accounts & Reports Staff',
    description: 'Views chit groups, accounting P&L, financial dashboards, dividend ledgers, and printable PDF reports.',
    permissions: {
      canAccessForemanPortal: true,
      canViewDashboard: true,
      canViewChits: true,
      canViewAccounting: true,
      canViewReports: true,
      canExportPdfStatements: true,
    },
  },
  {
    key: 'collection_agent',
    name: 'Collection Staff (Standard)',
    description: 'Standard field collection role restricted to Collections and Customers.',
    permissions: {},
  },
];

export function parseStaffPermissions(
  raw?: string | Partial<Record<string, unknown>> | null,
): StaffPermissions {
  const out: StaffPermissions = { ...EMPTY_STAFF_PERMISSIONS };
  if (!raw) return out;
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return out;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') obj = parsed as Record<string, unknown>;
    } catch {
      return out;
    }
  } else if (typeof raw === 'object') {
    obj = raw as Record<string, unknown>;
  }
  if (!obj) return out;
  for (const key of ALL_STAFF_PERMISSION_KEYS) {
    if (obj[key] === true || obj[key] === 'true' || obj[key] === 1 || obj[key] === '1') {
      out[key] = true;
    }
  }
  // Conducting auctions, managing chits, security approval or payout release implies viewing chits & portal access
  if (out.canManageChits || out.canConductAuction || out.canApproveSecurity || out.canReleasePayout) {
    out.canViewChits = true;
    out.canAccessForemanPortal = true;
  }
  if (out.canImportChits || out.canEnrollMembers || out.canVerifyAgreements || out.canAssignForemen || out.canModerateGroupRoom) {
    out.canViewChits = true;
  }
  return out;
}

export function serializeStaffPermissions(perms: Partial<StaffPermissions>): string {
  const normalized = parseStaffPermissions(perms);
  return JSON.stringify(normalized);
}

export function mergeStaffPermissions(
  roleTemplateRaw?: string | Partial<StaffPermissions> | null,
  userOverrideRaw?: string | Partial<StaffPermissions> | null,
): StaffPermissions {
  const base = parseStaffPermissions(roleTemplateRaw);
  if (!userOverrideRaw) return base;
  const override = parseStaffPermissions(userOverrideRaw);
  const merged: StaffPermissions = { ...EMPTY_STAFF_PERMISSIONS };
  for (const key of ALL_STAFF_PERMISSION_KEYS) {
    merged[key] = Boolean(base[key] || override[key]);
  }
  return parseStaffPermissions(merged);
}

export function hasAnyCustomStaffPermission(perms?: StaffPermissions | null): boolean {
  if (!perms) return false;
  return ALL_STAFF_PERMISSION_KEYS.some((key) => Boolean(perms[key]));
}

export function hasStaffPermission(
  role: string | null | undefined,
  perms: StaffPermissions | null | undefined,
  key: StaffPermissionKey,
): boolean {
  if (role === 'developer' || role === 'superadmin') return true;
  if (role === 'admin') {
    if (key === 'canApproveSecurity') {
      return Boolean(perms?.canApproveSecurity);
    }
    return true;
  }
  if (role === 'agent') {
    return Boolean(perms?.[key]);
  }
  return false;
}

/**
 * Checks whether an `agent` (staff / foreman) with explicit customized permissions
 * is allowed to visit a given module sub-route. Untouched agents (`perms == null` or
 * all false) always return `false`, preserving existing `AGENT_BLOCKED` behaviour.
 */
export function canStaffVisitPage(
  page: string,
  perms?: StaffPermissions | null,
): boolean {
  if (!perms) return false;
  if (page === '/foreman' || page.startsWith('/foreman/')) {
    return Boolean(
      perms.canAccessForemanPortal ||
        perms.canViewChits ||
        perms.canManageChits ||
        perms.canConductAuction,
    );
  }
  if (page === '/chits' || page.startsWith('/chits/')) {
    if (page === '/chits/new' || page.startsWith('/chits/new/') || page.endsWith('/edit')) {
      return Boolean(perms.canManageChits);
    }
    if (page === '/chits/import' || page.startsWith('/chits/import/')) {
      return Boolean(perms.canManageChits || perms.canImportChits);
    }
    return Boolean(
      perms.canViewChits ||
        perms.canManageChits ||
        perms.canConductAuction ||
        perms.canCollectChits,
    );
  }
  if (page === '/accounting' || page.startsWith('/accounting/')) {
    return Boolean(perms.canViewAccounting);
  }
  if (page === '/reports' || page.startsWith('/reports/')) {
    return Boolean(perms.canViewReports);
  }
  if (page === '/dashboard' || page.startsWith('/dashboard/')) {
    return Boolean(perms.canViewDashboard);
  }
  if (page === '/analytics' || page.startsWith('/analytics/')) {
    return Boolean(perms.canViewDashboard || perms.canViewReports);
  }
  return false;
}

/** Compact string list of granted permission keys for JWT claims. */
export function encodePermissionClaims(perms: StaffPermissions): StaffPermissionKey[] {
  return ALL_STAFF_PERMISSION_KEYS.filter((k) => Boolean(perms[k]));
}

/** Rebuilds normalized `StaffPermissions` from JWT claim array. */
export function decodePermissionClaims(claims?: string[] | null): StaffPermissions {
  if (!Array.isArray(claims) || claims.length === 0) {
    return { ...EMPTY_STAFF_PERMISSIONS };
  }
  const obj: Partial<StaffPermissions> = {};
  for (const key of ALL_STAFF_PERMISSION_KEYS) {
    if (claims.includes(key)) obj[key] = true;
  }
  return parseStaffPermissions(obj);
}
