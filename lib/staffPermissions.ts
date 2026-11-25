/**
 * Role customization & fine-grained staff / foreman permissions.
 *
 * Per ENGINEERING_REFERENCE.md ROLE-3 and STABLE-2:
 * - Base `User.role` remains one of `agent | admin | superadmin | developer`.
 * - Custom roles (`CustomRole`) and per-staff JSON capabilities (`User.staffPermissions`)
 *   grant explicit additive permissions to `agent`/staff logins (e.g. Head Foreman,
 *   Co-Foreman, Auctioneer, Chit Staff, Accounts Staff) without widening any untouched
 *   existing `agent` account (`staffPermissions == null` => all false).
 */

export type StaffPermissionKey =
  | 'canAccessForemanPortal'
  | 'canViewChits'
  | 'canManageChits'
  | 'canConductAuction'
  | 'canCollectChits'
  | 'canApproveSecurity'
  | 'canReleasePayout'
  | 'canViewReports'
  | 'canViewDashboard'
  | 'canManageCustomers';

export type StaffPermissions = Record<StaffPermissionKey, boolean>;

export const EMPTY_STAFF_PERMISSIONS: StaffPermissions = {
  canAccessForemanPortal: false,
  canViewChits: false,
  canManageChits: false,
  canConductAuction: false,
  canCollectChits: false,
  canApproveSecurity: false,
  canReleasePayout: false,
  canViewReports: false,
  canViewDashboard: false,
  canManageCustomers: false,
};

export const ALL_STAFF_PERMISSION_KEYS: StaffPermissionKey[] = Object.keys(
  EMPTY_STAFF_PERMISSIONS,
) as StaffPermissionKey[];

export interface StaffPermissionMeta {
  key: StaffPermissionKey;
  label: string;
  description: string;
  group: 'portal' | 'chits' | 'finance' | 'general';
}

export const STAFF_PERMISSION_META: StaffPermissionMeta[] = [
  {
    key: 'canAccessForemanPortal',
    label: 'Foreman / Staff Portal',
    description: 'Access the dedicated Foreman & Staff portal to view assigned chit groups and daily operations.',
    group: 'portal',
  },
  {
    key: 'canViewChits',
    label: 'View Chit Groups',
    description: 'Open Chit Groups list, member tickets, live auction rooms, and schedules.',
    group: 'chits',
  },
  {
    key: 'canManageChits',
    label: 'Create & Manage Chit Groups',
    description: 'Create/edit chit groups, enroll members (including multi-ticket), assign tickets, and verify agreements.',
    group: 'chits',
  },
  {
    key: 'canConductAuction',
    label: 'Conduct Auctions & Moderate Room',
    description: 'Open/close live auction rooms, record bids, finalize or draw winners, and moderate group chat.',
    group: 'chits',
  },
  {
    key: 'canCollectChits',
    label: 'Collect Subscriptions & Verify Proofs',
    description: 'Record member installment collections and approve/reject customer payment proofs.',
    group: 'finance',
  },
  {
    key: 'canApproveSecurity',
    label: 'Approve Winner Security / Guarantors',
    description: 'Review and approve prized subscriber collateral/guarantor verification before payout.',
    group: 'finance',
  },
  {
    key: 'canReleasePayout',
    label: 'Release Prize Payouts',
    description: 'Record prize disbursement receipts and cash denomination breakdowns.',
    group: 'finance',
  },
  {
    key: 'canViewReports',
    label: 'View & Download Reports',
    description: 'Access Reports, dividend ledgers, and multi-language period PDF statements.',
    group: 'general',
  },
  {
    key: 'canViewDashboard',
    label: 'View Dashboard & Analytics',
    description: 'Open the main module Dashboard and Analytics overview.',
    group: 'general',
  },
  {
    key: 'canManageCustomers',
    label: 'Manage Customers Directly',
    description: 'Add and update customer profiles directly without waiting for approval.',
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
      canViewChits: true,
      canManageChits: true,
      canConductAuction: true,
      canCollectChits: true,
      canApproveSecurity: true,
      canReleasePayout: true,
      canViewReports: true,
      canViewDashboard: true,
      canManageCustomers: true,
    },
  },
  {
    key: 'co_foreman',
    name: 'Co-Foreman / Auctioneer',
    description: 'Runs assigned chit auctions, moderates live rooms, collects subscriptions, and downloads reports.',
    permissions: {
      canAccessForemanPortal: true,
      canViewChits: true,
      canConductAuction: true,
      canCollectChits: true,
      canViewReports: true,
      canManageCustomers: true,
    },
  },
  {
    key: 'chit_staff',
    name: 'Chit Staff / Coordinator',
    description: 'Views assigned chit groups in the Foreman Portal, collects dues, and updates customer records.',
    permissions: {
      canAccessForemanPortal: true,
      canViewChits: true,
      canCollectChits: true,
      canManageCustomers: true,
    },
  },
  {
    key: 'accounts_staff',
    name: 'Accounts & Reports Staff',
    description: 'Views chit groups, financial dashboards, dividend ledgers, and printable PDF reports.',
    permissions: {
      canAccessForemanPortal: true,
      canViewChits: true,
      canViewReports: true,
      canViewDashboard: true,
    },
  },
  {
    key: 'collection_agent',
    name: 'Collection Agent (Standard)',
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
      return Boolean(perms.canManageChits);
    }
    return Boolean(
      perms.canViewChits ||
        perms.canManageChits ||
        perms.canConductAuction ||
        perms.canCollectChits,
    );
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
  return ALL_STAFF_PERMISSION_KEYS.filter((k) => perms[k]);
}

export function decodePermissionClaims(claims: unknown): StaffPermissions {
  const out: StaffPermissions = { ...EMPTY_STAFF_PERMISSIONS };
  if (Array.isArray(claims)) {
    for (const c of claims) {
      if (typeof c === 'string' && c in out) {
        out[c as StaffPermissionKey] = true;
      }
    }
    return parseStaffPermissions(out);
  }
  if (claims && typeof claims === 'object') {
    return parseStaffPermissions(claims as Record<string, unknown>);
  }
  return out;
}
