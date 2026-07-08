# Step 4 — Subscriber Agreement, KYC, Nominee, and Ticket Workflow

> **Implementation status (2026-07-08): BACKEND DONE, UI MISSING.** Member fields, agreement sign/verify/reject actions, and member/agreement API routes exist. No web member table/edit UI and no mobile screen uses them yet. See `IMPLEMENTATION_STATUS_GAP_ANALYSIS.md`.

## Goal

Add the subscriber-side legal and operational workflow that real chit funds need before the group starts.

Current app only links a `Customer` to a `ChitGroup` through `ChitMember`. It does not fully track:

- Ticket number
- Fraction number
- Subscriber agreement
- Nominee
- KYC document status
- Substitution/removal/default status

## Files to update

```txt
prisma/schema.prisma
app/(dashboard)/[module]/chits/[id]/ChitGroupDetailClient.tsx
app/(dashboard)/[module]/chits/actions.ts
app/api/v1/chits/[id]/members/route.ts
mobile/lib/data/models/chit.dart
mobile/lib/features/chits/chit_detail_screen.dart
lib/chits/validation.ts
lib/chits/status.ts
```

## Data model changes

Use fields added to `ChitMember` in Step 1:

```prisma
ticketNo          String?   @map("ticket_no")
fractionNo        String?   @map("fraction_no")
subscriberStatus  String    @default("active") @map("subscriber_status")
agreementStatus   String    @default("pending") @map("agreement_status")
agreementSignedAt DateTime? @map("agreement_signed_at")
nomineeName       String?   @map("nominee_name")
nomineeRelation   String?   @map("nominee_relation")
nomineePhone      String?   @map("nominee_phone")
introducedBy      String?   @map("introduced_by")
```

Use `ChitDocument` for:

- Signed subscriber agreement
- Aadhaar/PAN/address proof reference if allowed by your existing KYC policy
- Nominee proof
- Substitution letter
- Removal/default legal notice

## Status constants

Add to `lib/chits/status.ts`:

```ts
export const CHIT_MEMBER_STATUS = {
  ACTIVE: 'active',
  DEFAULTED: 'defaulted',
  SUBSTITUTED: 'substituted',
  REMOVED: 'removed',
  CLOSED: 'closed',
} as const;

export const CHIT_AGREEMENT_STATUS = {
  PENDING: 'pending',
  SIGNED: 'signed',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
} as const;
```

## UI requirements

### Member table in group detail page

File:

```txt
app/(dashboard)/[module]/chits/[id]/ChitGroupDetailClient.tsx
```

Add columns:

- Member number
- Ticket number
- Customer name
- Phone
- Agreement status
- Nominee name
- Subscriber status
- Has won
- Outstanding amount
- Actions

Actions:

- Edit member details
- Upload agreement
- Mark agreement signed
- Verify agreement
- Reject agreement
- Add nominee
- Substitute member
- Remove member, only if no payments/auction dependencies or with special approval

### Member edit modal/page

Fields:

- Ticket number
- Fraction number
- Nominee name
- Nominee relation
- Nominee phone
- Introduced by
- Agreement status
- Subscriber status
- Notes

Validation:

- Ticket number must be unique within group.
- Nominee phone should be optional but validated if present.
- Agreement cannot be verified unless signed document exists or user confirms offline document.

## Backend actions

Create server actions in `app/(dashboard)/[module]/chits/actions.ts` or a new file:

```ts
export async function updateChitMemberDetails(memberId: string, formData: FormData) {}
export async function markChitAgreementSigned(memberId: string, documentId?: string) {}
export async function verifyChitAgreement(memberId: string) {}
export async function rejectChitAgreement(memberId: string, reason: string) {}
export async function substituteChitMember(oldMemberId: string, newCustomerId: string, reason: string) {}
```

### Substitute member rules

A member substitution should:

1. Validate group belongs to tenant + branch.
2. Validate old member has not won unless business allows special settlement.
3. Validate new customer belongs to same tenant/app/branch policy.
4. Preserve ticket number, or assign a new ticket based on business rule.
5. Move future subscriptions to new member only if legally allowed.
6. Keep old member record with `subscriberStatus = substituted`.
7. Create audit log.
8. Add substitution document if uploaded.

Recommended safer approach:

- Do not physically delete old member.
- Create a new member record or add a `substitutedByMemberId` field if needed.
- Keep full audit history.

## API changes

### `GET /api/v1/chits/:id/members`

Return:

```json
{
  "id": "member_id",
  "memberNumber": 1,
  "ticketNo": "1",
  "fractionNo": null,
  "subscriberStatus": "active",
  "agreementStatus": "verified",
  "agreementSignedAt": "2026-07-08T00:00:00.000Z",
  "nomineeName": "...",
  "nomineeRelation": "...",
  "nomineePhone": "...",
  "customer": {
    "id": "customer_id",
    "name": "...",
    "phone": "..."
  }
}
```

### `PATCH /api/v1/chits/:id/members/:memberId`

Create route:

```txt
app/api/v1/chits/[id]/members/[memberId]/route.ts
```

Allow admin to update:

- ticketNo
- fractionNo
- nominee details
- agreement status
- subscriber status

### `POST /api/v1/chits/:id/members/:memberId/agreement`

Create route:

```txt
app/api/v1/chits/[id]/members/[memberId]/agreement/route.ts
```

Payload:

```json
{
  "status": "signed",
  "documentId": "optional_document_id",
  "remarks": "Signed offline"
}
```

## Activation dependency

Update Step 3 activation validation:

A group should not become active if:

- Any member has missing ticket number.
- Any duplicate ticket number exists.
- Any required agreement is not signed/verified.
- Any required nominee field is missing, if business config makes nominee mandatory.

## Mobile changes

Update:

```txt
mobile/lib/data/models/chit.dart
mobile/lib/features/chits/chit_detail_screen.dart
mobile/lib/data/services/chit_service.dart
```

Mobile agent view:

- Show ticket number.
- Show agreement status.
- Show nominee name.
- Show subscriber status.

Mobile admin view:

- Allow editing nominee/ticket only if admin mobile flow is enabled.
- Otherwise read-only.

## Reports impact

These fields should be available for later reports:

- Subscriber register
- Agreement pending report
- Nominee missing report
- Ticket register
- Substituted member report

## Acceptance criteria

- Every member has a unique ticket number within a group.
- Member agreement status is visible in web and mobile.
- Admin can update nominee and agreement fields.
- Activation is blocked when required member details are incomplete.
- Substitution does not delete history.
- All updates are audit logged.

## Implementation prompt for coding agent

```txt
Implement Step 4 for the LoanTrack chit-fund module.

Add subscriber agreement, nominee, ticket, fraction, and member status workflow. Update ChitMember fields as per schema, then update web member table/detail actions, mobile API response, and Flutter models/screens. Add server actions to update member details, mark agreement signed, verify/reject agreement, and substitute member without deleting history.

Update group activation validation so activation is blocked if required ticket/agreement details are missing. Add audit logs for every member agreement and nominee update. Ensure tenant and branch security.
```
