# FEAT-04 — Mobile: e-NACH Mandate Registration Screen

**Priority:** 🔴 HIGH  
**Category:** Feature — Mobile Parity  
**Effort:** 1–2 days (Flutter)

---

## Background

The e-NACH mandate system was implemented in June 2026 (see `lib/nach.ts`, `app/api/v1/nach/`). The web dashboard has mandate creation, but field agents who visit borrowers in person need to be able to:

1. Register a new e-mandate from the mobile app
2. Show the borrower the auth link (Razorpay payment page)
3. See mandate status for a loan
4. Present a manual debit (admin override)

This is critical for on-ground field operations — agents can't carry a laptop.

---

## Backend API (Already Implemented)

| Method | Endpoint | Used For |
|---|---|---|
| `POST` | `/api/v1/nach/mandate` | Create mandate (gets auth link) |
| `GET` | `/api/v1/nach/mandate` | List all mandates |
| `GET` | `/api/v1/nach/loan/[loanId]` | Get active mandate for a loan |
| `GET` | `/api/v1/nach/mandate/[id]` | Mandate detail + presentations |
| `DELETE` | `/api/v1/nach/mandate/[id]` | Cancel mandate |
| `POST` | `/api/v1/nach/present` | Manual debit trigger |

All routes use web `auth()` session. Mobile needs them on the `requireMobileContext` guard. Apply the `resolveActor` dual-auth pattern from **FEAT-03** to these routes.

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Enable mobile auth on NACH API routes

Apply `resolveActor` (from FEAT-03's `lib/api/dualAuth.ts`) to:

- `app/api/v1/nach/mandate/route.ts` — POST + GET
- `app/api/v1/nach/mandate/[id]/route.ts` — GET + DELETE  
- `app/api/v1/nach/loan/[loanId]/route.ts` — GET
- `app/api/v1/nach/present/route.ts` — POST

Pattern for each:

```typescript
import { resolveActor } from '@/lib/api/dualAuth';

export async function POST(req: NextRequest) {
  const actor = await resolveActor(req);
  if (!actor) return fail('Unauthorized', 401);
  // ...use actor.tenantId, actor.userId, actor.role
}
```

### Step 2 — Flutter: NACH model

Create `mobile/lib/models/nach_mandate.dart`:

```dart
class NachMandate {
  final String id;
  final String loanId;
  final String status; // pending_auth | active | cancelled | rejected
  final String accountHolderName;
  final String accountNumber;
  final String ifscCode;
  final String bankName;
  final double maxAmount;
  final DateTime? activatedAt;
  final String? razorpayOrderId;

  const NachMandate({ required this.id, required this.loanId, ... });

  factory NachMandate.fromJson(Map<String, dynamic> json) => NachMandate(
    id:                 json['id'],
    loanId:             json['loanId'],
    status:             json['status'],
    accountHolderName:  json['accountHolderName'],
    accountNumber:      json['accountNumber'],
    ifscCode:           json['ifscCode'],
    bankName:           json['bankName'] ?? '',
    maxAmount:          (json['maxAmount'] as num).toDouble(),
    activatedAt:        json['activatedAt'] != null ? DateTime.parse(json['activatedAt']) : null,
    razorpayOrderId:    json['razorpayOrderId'],
  );
}
```

### Step 3 — Flutter: Register mandate screen

Create `mobile/lib/screens/nach/create_mandate_screen.dart`.

Fields to collect from the user (pre-fill from loan customer where possible):

```
Account Holder Name  (TextFormField)
Account Number       (TextFormField, numeric keyboard)
Confirm Account No.  (TextFormField, cross-check)
IFSC Code            (TextFormField, uppercase)
Bank Name            (TextFormField, optional)
Account Type         (DropdownButton: Savings / Current)
Max Amount (₹)       (TextFormField, default = loan EMI amount)
Auth Method          (DropdownButton: Net Banking / Debit Card / Aadhaar)
```

On submit, call `POST /api/v1/nach/mandate` with the field values.

On success, the response includes `razorpayOrderId` and `razorpayKeyId`. Open the Razorpay payment page in a `url_launcher` in-app browser:

```dart
final authUrl = 'https://api.razorpay.com/v1/checkout/embedded'
    '?key=${response.razorpayKeyId}'
    '&order_id=${response.razorpayOrderId}';
await launchUrl(Uri.parse(authUrl), mode: LaunchMode.inAppWebView);
```

> The borrower authorizes directly in the in-app browser. Razorpay fires the webhook to confirm.

### Step 4 — Flutter: Mandate status in loan detail

In the loan detail screen (`mobile/lib/screens/loans/loan_detail_screen.dart`):

- Add a "NACH Mandate" section below the instalment schedule
- Call `GET /api/v1/nach/loan/[loanId]`
- Show: status badge, bank name, account (masked: XXXX1234), max amount, activated date
- If no mandate: show "Set up e-NACH" button → navigate to create mandate screen
- If status is `active`: show "Cancel" button (admin role only)

### Step 5 — Flutter: Mandate status colors

| Status | Color |
|---|---|
| `pending_auth` | Orange |
| `active` | Green |
| `cancelled` | Grey |
| `rejected` | Red |

---

## Verification

- `POST /api/v1/nach/mandate` with mobile Bearer token → creates mandate, returns `razorpayOrderId`
- Flutter create mandate screen submits correctly
- Loan detail screen shows mandate status
- `flutter analyze` → 0 issues
- `npx tsc --noEmit` → 0 errors
