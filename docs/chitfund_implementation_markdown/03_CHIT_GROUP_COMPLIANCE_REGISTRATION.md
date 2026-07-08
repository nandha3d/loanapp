# Step 3 — Chit Group Compliance and Registration Workflow

## Goal

Make chit group creation match a real registered chit-fund business flow.

A production chit group should not be only `name`, `chitValue`, `monthlyContrib`, `members`, and `startDate`. It should also track registration, approved terms, foreman details, auction rules, bank details, and compliance status.

## Files to update

```txt
app/(dashboard)/[module]/chits/new/ChitGroupForm.tsx
app/(dashboard)/[module]/chits/[id]/edit/ChitGroupEditForm.tsx
app/(dashboard)/[module]/chits/[id]/ChitGroupDetailClient.tsx
app/(dashboard)/[module]/chits/actions.ts
app/api/v1/chits/route.ts
app/api/v1/chits/[id]/route.ts
lib/chits/validation.ts
lib/chits/status.ts
prisma/schema.prisma
mobile/lib/features/chits/chit_form_screen.dart
mobile/lib/data/models/chit.dart
mobile/lib/data/services/chit_service.dart
```

## Required compliance fields

Add to create/edit forms:

### Group identity

- Chit group name
- Chit value
- Monthly contribution
- Total members
- Duration months
- Start date
- Auction frequency
- Auction day/date
- Auction mode: offline, online, hybrid

### Registration details

- Registration number
- Registration date
- Registrar office
- By-law number
- Commencement certificate number/reference
- Compliance status: draft, registered, active, suspended, closed

### Foreman/company details

- Foreman name
- Foreman commission percentage
- Foreman commission cap percentage
- Maximum bid discount percentage

### Bank details

- Approved bank name
- Approved bank account number
- Optional IFSC/branch field if business needs it

### Document uploads

Use `ChitDocument` from Step 1 for:

- Registration certificate
- Approved by-law document
- Commencement certificate
- Foreman security proof
- Bank approval/reference document

## Status model

Create `lib/chits/status.ts`:

```ts
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
```

## Validation rules

Create/update validation in `lib/chits/validation.ts`.

### Draft group

Draft group can be saved with minimum fields:

- Name
- Chit value
- Total members
- Monthly contribution
- Start date

### Activate group

A group can be activated only if the following are complete:

- Registration number
- Registration date
- Registrar office
- By-law number
- Commencement certificate
- Approved bank name
- Foreman name
- Commission percentage
- Maximum discount percentage
- Member count equals total members
- Every member has ticket number
- Every member has agreement status `signed` or `verified`, based on config

Example helper:

```ts
export function validateChitGroupActivation(input: {
  registrationNo?: string | null;
  registrationDate?: Date | null;
  registrarOffice?: string | null;
  bylawNo?: string | null;
  commencementCertificate?: string | null;
  approvedBankName?: string | null;
  foremanName?: string | null;
  commissionPct: number;
  foremanCommissionCapPct?: number | null;
  maxDiscountPct?: number | null;
  totalMembers: number;
  actualMembers: number;
}) {
  const missing: string[] = [];
  if (!input.registrationNo) missing.push('Registration number');
  if (!input.registrationDate) missing.push('Registration date');
  if (!input.registrarOffice) missing.push('Registrar office');
  if (!input.bylawNo) missing.push('By-law number');
  if (!input.commencementCertificate) missing.push('Commencement certificate');
  if (!input.approvedBankName) missing.push('Approved bank name');
  if (!input.foremanName) missing.push('Foreman name');
  if (input.actualMembers !== input.totalMembers) missing.push('All members must be added');

  if (input.foremanCommissionCapPct && input.commissionPct > input.foremanCommissionCapPct) {
    missing.push('Commission percentage exceeds cap');
  }

  if (missing.length) {
    throw new Error(`Cannot activate chit group. Missing/invalid: ${missing.join(', ')}`);
  }
}
```

## UI changes

### Create chit page

File:

```txt
app/(dashboard)/[module]/chits/new/ChitGroupForm.tsx
```

Change form into sections:

1. Basic group details
2. Registration and approval
3. Foreman and auction rules
4. Bank details
5. Member selection
6. Review and create

Add helper text:

```txt
Draft groups can be saved without full compliance details. A group can be activated only after registration, member, agreement, and auction rule details are complete.
```

### Group detail page

File:

```txt
app/(dashboard)/[module]/chits/[id]/ChitGroupDetailClient.tsx
```

Add compliance card:

- Registration status
- Registration number
- Registrar office
- By-law number
- Commencement certificate
- Approved bank
- Missing compliance items
- Activate button only for admin/superadmin/developer

### Edit page

File:

```txt
app/(dashboard)/[module]/chits/[id]/edit/ChitGroupEditForm.tsx
```

Allow editing compliance fields only before activation, or require elevated role after activation.

Recommended rule:

- Admin can edit draft groups.
- Superadmin/developer can edit active group compliance metadata.
- Changes to active compliance fields must create audit log.

## Backend actions

Update `createChitGroup`:

- Save compliance fields.
- Default `status = draft` unless activation requested.
- Default `complianceStatus = draft`.
- Generate subscriptions/auction stubs only when group is activated, or generate but keep locked in draft mode.

Recommended safer approach:

- On create draft: create group + members only.
- On activate: generate subscriptions + auctions.

Create new action:

```ts
export async function activateChitGroup(groupId: string) {}
```

Activation flow:

1. Load group with members.
2. Validate tenant + branch.
3. Validate compliance fields.
4. Validate member count.
5. Validate agreements if Step 4 already implemented.
6. Generate subscriptions for all members x periods if not already generated.
7. Generate auction stubs if not already generated.
8. Set group status to `active` and complianceStatus to `active`.
9. Audit log.
10. Revalidate paths.

## API changes

### `GET /api/v1/chits`

Return compliance fields in list response:

```json
{
  "id": "...",
  "name": "...",
  "chitValue": 100000,
  "status": "active",
  "complianceStatus": "active",
  "registrationNo": "TN-...",
  "totalMembers": 20,
  "activeMembers": 20
}
```

### `POST /api/v1/chits`

Support draft creation with compliance fields.

### `PATCH /api/v1/chits/:id`

Allow update with role check.

### `POST /api/v1/chits/:id/activate`

Create a new route:

```txt
app/api/v1/chits/[id]/activate/route.ts
```

## Mobile changes

Update Flutter:

```txt
mobile/lib/data/models/chit.dart
mobile/lib/features/chits/chit_form_screen.dart
mobile/lib/features/chits/chit_detail_screen.dart
mobile/lib/data/services/chit_service.dart
```

Mobile should:

- Display compliance status.
- Show registration details read-only for agents.
- Allow admin to create draft group if mobile admin flow exists.
- Hide activation button from agents.

## Audit logging

Create audit logs for:

- Create draft group
- Update compliance details
- Upload compliance document
- Activate group
- Suspend group
- Cancel group
- Close group

Audit `entityType` examples:

```txt
chit_group
chit_group_compliance
chit_document
```

## Acceptance criteria

- Chit group can be saved as draft.
- Chit group cannot be activated without required compliance fields.
- Active group shows compliance details in web UI.
- Mobile list/detail shows compliance status.
- Activation creates subscriptions and auction stubs only once.
- All compliance updates are audit logged.
- Tenant and branch restrictions are enforced.

## Implementation prompt for coding agent

```txt
Implement Step 3 for the LoanTrack chit-fund module.

Add compliance and registration workflow to chit groups. Update web create/edit/detail pages, server actions, and mobile APIs. Create activateChitGroup server action and POST /api/v1/chits/[id]/activate route. Draft groups should be allowed, but activation must be blocked until registration, registrar, by-law, commencement certificate, approved bank, foreman, commission cap, max discount, and full member count are complete.

Use lib/chits/validation.ts and lib/chits/status.ts. Generate subscriptions and auction stubs only once during activation. Add audit logs. Update Flutter model and detail screens to show compliance status. Preserve existing groups.
```
