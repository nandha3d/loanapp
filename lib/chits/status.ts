export const CHIT_GROUP_STATUS = {
  DRAFT: 'draft',
  REGISTERED: 'registered',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  CANCELLED: 'cancelled',
  CLOSED: 'closed',
} as const;

export const CHIT_COMPLIANCE_STATUS = {
  DRAFT: 'draft',
  REGISTERED: 'registered',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  CLOSED: 'closed',
} as const;

export const CHIT_MEMBER_STATUS = {
  ACTIVE: 'active',
  DEFAULTED: 'defaulted',
  SUBSTITUTED: 'substituted',
  REMOVED: 'removed',
  CLOSED: 'closed',
  VACANT: 'vacant',
} as const;

export const CHIT_AGREEMENT_STATUS = {
  PENDING: 'pending',
  SIGNED: 'signed',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
} as const;

export const CHIT_AUCTION_STATUS = {
  PENDING: 'pending',
  NOTICE_SENT: 'notice_sent',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CONFIRMED: 'confirmed',
  PAYOUT_PENDING: 'payout_pending',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const;

export const CHIT_PAYOUT_STATUS = {
  NOT_READY: 'not_ready',
  SECURITY_PENDING: 'security_pending',
  READY: 'ready',
  PAID: 'paid',
} as const;

export const CHIT_SECURITY_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  VERIFIED: 'verified',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;
