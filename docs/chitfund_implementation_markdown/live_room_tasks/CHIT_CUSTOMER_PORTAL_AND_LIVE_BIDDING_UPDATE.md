# Chit Fund Customer Portal and Unified Live Bidding Update

## 1. Purpose

This document defines the next update required for the Chit Fund module.

The current application already supports a staff-operated live auction room on web and mobile. However:

- The web and mobile live-room experiences are different.
- Customers cannot log in and access their own chit memberships.
- Customers cannot join an auction and place bids themselves.
- Voice bidding is only partially available as a staff-side speech-to-text shortcut.
- The current borrower/customer portal is loan-focused and does not support chit-only customers.

This update introduces:

1. A unified live-auction backend contract.
2. A dedicated customer portal for web and mobile.
3. Customer self-bidding with secure ticket ownership checks.
4. Voice bidding with confirmation and audit trail.
5. Chit contribution, receipt, dividend, auction, and payout visibility for customers.
6. Clear separation between staff and customer experiences.

---

# 2. Current State

## 2.1 Staff Web

The current web application supports:

- Creating chit groups.
- Enrolling members.
- Scheduling auctions.
- Opening and closing the live room.
- Marking attendance.
- Entering bids on behalf of members.
- Confirming winners.
- Lottery selection for tied bids.
- Dividend calculation.
- Security approval.
- Prize payout.
- Contribution collection.
- Receipts and reversals.

## 2.2 Staff Mobile

The current mobile application supports:

- Chit group listing.
- Chit group details.
- Live-room entry.
- Attendance marking.
- Bid entry.
- Confirming or drawing winners.
- Contribution collection.
- Security and payout-related functions.

## 2.3 Current Customer Access

The current customer/borrower portal is designed mainly for loans.

Current limitations:

- Chit-only customers cannot use the borrower dashboard.
- Customer mobile tokens cannot access staff chit APIs.
- Customer credentials do not automatically expose chit memberships.
- Customers cannot join a chit auction.
- Customers cannot submit their own bids.
- Customers cannot view chit contribution and dividend history.
- Customers cannot download chit receipts from a dedicated portal.

---

# 3. Target Architecture

Use one auction engine with two separate user experiences.

```text
One auction engine
One room-state service
One validation engine
One event stream
Two user experiences:
  1. Staff auction room
  2. Customer auction room
```

## 3.1 Staff Experience

Staff users may:

- Configure the auction.
- Open and close the room.
- Admit members from the waiting room.
- Mark attendance.
- Enter an offline or in-person bid for a member.
- View all eligible members.
- View all bids.
- Resolve ties.
- Confirm the winner.
- Review security.
- Release the payout.

## 3.2 Customer Experience

Customers may:

- View only their own chit memberships.
- View their ticket numbers.
- View contribution and dividend history.
- Join an eligible auction.
- Place a bid only for their own ticket.
- Use tap or voice bidding.
- View their own bid history.
- View the current leading bid according to configured privacy rules.
- Send a message to the organizer.
- View results.
- View security and prize payout status.
- Pay contributions and download receipts.

---

# 4. Implementation Phases

## Phase 1 — Unify the Existing Auction Engine

### Objective

Remove duplicated auction flows and make web and mobile use one canonical backend contract.

### 4.1 Retire Legacy Period-Based Auction APIs

Retire or return `410 Gone` for old period-based endpoints such as:

```text
/open
/bid
/pass
/undo
/state
/close
```

Keep only auction-ID-based routes.

Preferred canonical routes:

```text
GET  /api/v1/chits/:groupId/auctions/:auctionId
POST /api/v1/chits/:groupId/auctions/:auctionId/open
POST /api/v1/chits/:groupId/auctions/:auctionId/close
POST /api/v1/chits/:groupId/auctions/:auctionId/bids
POST /api/v1/chits/:groupId/auctions/:auctionId/attendance
POST /api/v1/chits/:groupId/auctions/:auctionId/confirm
POST /api/v1/chits/:groupId/auctions/:auctionId/draw
GET  /api/v1/chits/:groupId/auctions/:auctionId/room
```

### 4.2 Shared Room-State DTO

Create a common DTO used by:

- Staff web room.
- Staff mobile room.
- Customer web room.
- Customer mobile room.

```ts
export type AuctionRoomState = {
  groupId: string;
  auctionId: string;
  periodNumber: number;

  roomStatus:
    | 'scheduled'
    | 'waiting'
    | 'open'
    | 'extended'
    | 'closed'
    | 'completed';

  serverTime: string;
  openedAt: string | null;
  closesAt: string | null;
  secondsRemaining: number;
  antiSnipeExtendSeconds: number;

  chitValue: number;
  minDiscount: number;
  maxDiscount: number;
  bidIncrement: number;

  currentHighestBid: {
    bidId: string;
    ticketDisplay: string;
    prizeAmount: number;
    discountAmount: number;
    submittedAt: string;
  } | null;

  eligibleMemberCount: number;
  attendanceCount: number;

  permissions: {
    canOpen: boolean;
    canClose: boolean;
    canBid: boolean;
    canConfirm: boolean;
    canDraw: boolean;
    canMarkAttendance: boolean;
  };
};
```

### 4.3 Shared Bid Validation Service

Create one backend service responsible for:

- Group status validation.
- Auction status validation.
- Member eligibility.
- Ticket ownership.
- Previous-winner restriction.
- Minimum discount validation.
- Maximum discount validation.
- Bid increment validation.
- Prize amount validation.
- Anti-snipe extension.
- Idempotency.
- Bid persistence.
- Event broadcasting.

Suggested location:

```text
lib/chits/auction/bid-service.ts
```

Suggested functions:

```ts
validateAuctionBid()
submitAuctionBid()
applyAntiSnipeExtension()
finalizeAuctionWinner()
calculateAuctionDividend()
```

### 4.4 Shared Dividend Formula

The default formula should be:

```text
Dividend per member =
(Winning Bid Discount - Admin Commission) / Total Members
```

The calculation engine should support configuration where applicable:

```text
commissionBasis = BID_DISCOUNT | CHIT_VALUE
dividendPolicy = ALL_MEMBERS | NON_WINNERS_ONLY
```

The backend must be the final source of truth.

The UI may show an estimate, but the persisted value must come from the shared backend calculation engine.

### 4.5 Web and Mobile Consistency

Both web and mobile must display the same core information:

- Auction status.
- Countdown.
- Current leading discount.
- Current prize amount.
- Minimum and maximum discount.
- Bid increment.
- Anti-snipe extension.
- Attendance status.
- Tie status.
- Confirmed winner.

The layouts may differ responsively, but the data and terminology must remain consistent.

---

## Phase 2 — General Customer Authentication

### Objective

Convert the loan-only borrower portal into a general customer portal supporting both loans and chit funds.

### 4.6 Customer Identity

Use the existing `Customer` record as the customer identity.

Do not create a normal staff `User` record for every chit subscriber.

Recommended token claims:

```ts
export type CustomerTokenClaims = {
  customerId: string;
  tenantId: string;
  branchIds: string[];
  role: 'customer';
  availableModules: Array<'loans' | 'chitfunds'>;
};
```

### 4.7 Customer Activation Flow

1. Staff creates a customer.
2. Staff enrolls the customer into a chit group.
3. The system enables customer portal access.
4. The customer receives an SMS or WhatsApp notification.
5. The customer verifies their registered phone number using OTP.
6. The customer creates a password or PIN.
7. The customer logs in and sees available products.

Suggested notification:

```text
You have been added to chit group ABC-001.
Use your registered mobile number to activate your Customer Portal.
```

### 4.8 Web Customer Login

Recommended route:

```text
/customer/login
```

Support:

- Phone number and OTP.
- Phone number and password.
- Forgot password.
- Reset password.
- Logout.

### 4.9 Mobile Customer Login

Support:

- Phone and OTP.
- Optional six-digit PIN.
- Biometric unlock after first successful login.
- Separate secure token storage for customer sessions.

### 4.10 Product Discovery

After login, determine available modules from customer records.

Examples:

```text
Customer has active loan only:
  Show Loans

Customer has active chit membership only:
  Show Chit Funds

Customer has both:
  Show Loans and Chit Funds
```

A chit-only customer must not be redirected away because no loan exists.

---

## Phase 3 — Customer Chit Dashboard

### Objective

Provide customers with a dedicated chit module on web and mobile.

### 4.11 Customer Web Routes

Recommended routes:

```text
/customer/dashboard
/customer/chits
/customer/chits/:groupId
/customer/chits/:groupId/contributions
/customer/chits/:groupId/auctions
/customer/chits/:groupId/auctions/:auctionId
/customer/chits/:groupId/security
/customer/receipts
/customer/profile
```

### 4.12 Customer Mobile Navigation

Recommended customer tabs:

```text
Home
My Chits
Payments
Receipts
Profile
```

Show Loans only when the customer has loan products.

### 4.13 Customer Dashboard Cards

Show:

- Active chit memberships.
- Upcoming auction.
- Current contribution due.
- Total dividend received.
- Latest receipt.
- Prize status.
- Security approval status.
- Pending actions.

### 4.14 My Chits List

Each item should show:

```text
Group name
Group code
Ticket number
Chit value
Monthly contribution
Current period
Membership status
Auction eligibility
Next due date
Next auction date
```

### 4.15 Chit Detail Screen

Sections:

1. Overview.
2. My ticket.
3. Contributions.
4. Dividend adjustments.
5. Auctions.
6. Receipts.
7. Security and payout.
8. Nominee and agreement.
9. Documents.

### 4.16 Contribution Breakdown

Show:

```text
Base contribution
Dividend adjustment
Penalty
Net due
Paid
Outstanding
```

Formula:

```text
Net due = Base contribution - Dividend adjustment + Penalty
Outstanding = Net due - Paid
```

### 4.17 Customer Payments

Support:

- UPI.
- Bank transfer.
- Card, if payment gateway is enabled.
- Cheque entry, where allowed.
- Receipt download.
- Payment status.
- Failed-payment retry.
- Idempotent payment submission.

Do not expose staff cash-collection controls to customers.

---

## Phase 4 — Customer Live Auction Room

### Objective

Allow eligible customers to join and bid directly.

### 4.18 Customer Auction APIs

Create customer-scoped APIs.

```text
GET  /api/v1/customer/chits
GET  /api/v1/customer/chits/:groupId
GET  /api/v1/customer/chits/:groupId/subscriptions
GET  /api/v1/customer/chits/:groupId/auctions/:auctionId
POST /api/v1/customer/chits/:groupId/auctions/:auctionId/join
POST /api/v1/customer/chits/:groupId/auctions/:auctionId/leave
POST /api/v1/customer/chits/:groupId/auctions/:auctionId/bids
GET  /api/v1/customer/chits/:groupId/auctions/:auctionId/stream
GET  /api/v1/customer/chits/:groupId/auctions/:auctionId/messages
POST /api/v1/customer/chits/:groupId/auctions/:auctionId/messages
POST /api/v1/customer/chits/:groupId/payments
GET  /api/v1/customer/chits/receipts
```

### 4.19 Customer Membership Resolution

For every customer auction request:

1. Read `customerId` from the customer token.
2. Find the customer’s membership in the requested group.
3. Confirm tenant, app, and branch scope.
4. Confirm membership is active.
5. Confirm the ticket belongs to the customer.
6. Confirm the ticket is eligible to bid.
7. Never trust a `memberId` supplied by the customer without ownership validation.

### 4.20 Customer Room State

```ts
export type CustomerAuctionRoomState = {
  groupId: string;
  auctionId: string;
  periodNumber: number;

  roomStatus:
    | 'scheduled'
    | 'waiting'
    | 'open'
    | 'extended'
    | 'closed'
    | 'completed';

  serverTime: string;
  closesAt: string | null;
  secondsRemaining: number;
  antiSnipeExtendSeconds: number;

  chitValue: number;
  minDiscount: number;
  maxDiscount: number;
  bidIncrement: number;

  currentHighestBid: {
    ticketDisplay: string;
    prizeAmount: number;
    discountAmount: number;
    submittedAt: string;
  } | null;

  myMembership: {
    memberId: string;
    ticketNo: string;
    eligible: boolean;
    eligibilityReason: string | null;
    admissionStatus:
      | 'not_joined'
      | 'waiting'
      | 'admitted'
      | 'denied';
  };

  myLatestBid: {
    prizeAmount: number;
    discountAmount: number;
    source: 'tap' | 'voice';
    submittedAt: string;
  } | null;

  minimumNextPrize: number;

  permissions: {
    canJoin: boolean;
    canBid: boolean;
    canMessage: boolean;
  };
};
```

### 4.21 Before Auction Opens

Show:

```text
Chit group name
Ticket number
Auction period
Scheduled date and time
Chit value
Minimum discount
Maximum discount
Contribution status
Eligibility message
Join waiting room button
```

Examples:

```text
Your ticket: A-14
Auction starts at 6:00 PM
You are eligible to bid
```

```text
Bidding is unavailable because this ticket has already won.
```

### 4.22 Waiting Room

Show:

- Waiting for organizer approval.
- Connection status.
- Auction rules.
- Leave-room button.
- Message organizer.
- Admission result.

### 4.23 Active Customer Room

Top section:

```text
LIVE or EXTENDED badge
Server-driven countdown
Connection/reconnection status
Current leading discount
Current prize amount
Anti-snipe extension notice
```

Bid section:

Allow either:

```text
Enter prize amount
Enter discount amount
```

Show immediate conversion:

```text
Prize requested: ₹4,50,000
Discount offered: ₹50,000
Estimated dividend: ₹900 per member
```

Quick actions:

```text
Increase discount by ₹500
Increase discount by ₹1,000
Bid maximum allowed discount
Speak bid
```

### 4.24 Bid Confirmation

Never submit immediately after tapping or speaking.

Show:

```text
Confirm Your Bid

Ticket: A-14
Prize amount: ₹4,50,000
Discount: ₹50,000

This bid cannot be cancelled after acceptance.
```

Recommended controls:

- Mobile: swipe to confirm.
- Web: hold or click Confirm Bid.
- Optional short PIN confirmation for high-value bids.

---

## Phase 5 — Voice Bidding

### Objective

Provide safe, auditable Tamil and English voice bidding.

### 4.25 Voice Modes

Support:

```text
Prize amount voice command
Discount amount voice command
```

English examples:

```text
Prize four lakh fifty thousand
Discount fifty thousand
```

Tamil examples:

```text
பரிசுத் தொகை நான்கு லட்சத்து ஐம்பதாயிரம்
தள்ளுபடி ஐம்பதாயிரம்
```

### 4.26 Voice Flow

1. Customer presses and holds the microphone.
2. Record only while the button is held.
3. Convert speech to text.
4. Detect whether the value is a prize or discount.
5. Parse the spoken amount.
6. Show the interpreted amount.
7. Read it back visually and optionally with text-to-speech.
8. Require manual confirmation.
9. Submit to the backend.
10. Store source, transcript, and optional audio proof.

Do not automatically place the bid after speech recognition.

### 4.27 Voice Bid Payload

```json
{
  "ticketId": "optional-ticket-id",
  "prizeAmount": 450000,
  "discountAmount": 50000,
  "source": "voice",
  "transcript": "prize four lakh fifty thousand",
  "audioDocumentId": "optional-document-id",
  "idempotencyKey": "device-generated-uuid"
}
```

When the customer has only one eligible ticket, the backend may resolve the ticket automatically.

### 4.28 Voice Audit Fields

Extend the bid record where required:

```text
source
transcript
audioDocumentId
clientRequestId
deviceId
ipAddress
submittedByCustomerId
submittedByStaffUserId
```

Recommended source values:

```text
staff_manual
customer_tap
customer_voice
staff_voice
system_lottery
```

### 4.29 Voice Consent

Show a one-time consent message:

```text
Voice is recorded only while you hold the microphone.
A confirmed voice bid is treated as an auction bid and may be retained
with the auction record.
```

Store consent timestamp and version.

### 4.30 Voice Validation

Backend must always validate:

- Parsed amount.
- Ownership.
- Eligibility.
- Minimum and maximum discount.
- Bid increment.
- Auction status.
- Server time.
- Idempotency.

Speech recognition is only an input method. It must never bypass backend validation.

---

## Phase 6 — Real-Time Auction Updates

### Objective

Provide a consistent, near-real-time room for web and mobile.

### 4.31 Recommended Technology

Use:

1. Server-Sent Events for room updates.
2. Secured POST requests for bids and actions.
3. WebSocket only when required for larger chat or scale.

Recommended stream:

```text
GET /api/v1/customer/chits/:groupId/auctions/:auctionId/stream
```

Staff may use a separate secured stream or the same event service.

### 4.32 Event Types

```text
room.opened
room.extended
room.closed
member.joined
member.admitted
member.denied
attendance.changed
bid.accepted
bid.rejected
winner.declared
lottery.started
lottery.completed
message.created
connection.warning
```

### 4.33 Reconnection

On reconnection:

1. Fetch the latest room state.
2. Compare last event ID.
3. Resume event stream.
4. Prevent duplicate bid submission using idempotency.
5. Disable bidding until state is refreshed.

The database remains authoritative.

---

# 5. Security Rules

## 5.1 Customer Isolation

Customers must never be able to:

- View another customer’s memberships.
- Select another member for bidding.
- Read another member’s payment history.
- View full KYC of other members.
- View staff-only auction notes.
- Open or close an auction.
- Confirm or draw a winner.
- Approve security.
- Release payouts.

## 5.2 Staff Isolation

Continue tenant, application, and branch scoping for staff.

Required scope:

```text
tenantId
appType
branchId
```

## 5.3 Bid Ownership

For customer bids:

```text
Authenticated customerId
        ↓
Find active ChitMember
        ↓
Verify requested group and ticket
        ↓
Validate eligibility
        ↓
Accept or reject bid
```

Never accept ownership based only on request payload.

## 5.4 Idempotency

Require an idempotency key for:

- Customer bid submission.
- Customer payment submission.
- Voice bid submission.
- Retry after network failure.

Duplicate retries must return the original result.

## 5.5 Rate Limiting

Apply rate limits to:

- OTP requests.
- Login attempts.
- Join requests.
- Bid submissions.
- Messages.
- Voice uploads.

## 5.6 Audit Logs

Audit:

- Customer login.
- Join/leave.
- Admission.
- Bid submission.
- Bid rejection.
- Voice transcript.
- Auction extension.
- Winner confirmation.
- Payment submission.
- Receipt generation.
- Security status changes.
- Prize payout.

---

# 6. Data Model Updates

Reuse existing models where possible.

## 6.1 Customer Portal Access

Suggested fields if not already available:

```prisma
model CustomerPortalAccess {
  id                String   @id @default(cuid())
  customerId        String   @unique
  isEnabled         Boolean  @default(false)
  passwordHash      String?
  pinHash           String?
  phoneVerifiedAt   DateTime?
  activatedAt       DateTime?
  lastLoginAt       DateTime?
  consentVersion    String?
  voiceConsentAt    DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  customer Customer @relation(fields: [customerId], references: [id])
}
```

Use the existing customer authentication model instead if it already supports equivalent fields.

## 6.2 Auction Bid Enhancements

Add only missing fields:

```prisma
model ChitAuctionBid {
  id                       String   @id @default(cuid())
  auctionId                String
  memberId                 String
  prizeAmount              Decimal
  discountAmount           Decimal
  source                   String
  transcript               String?
  audioDocumentId          String?
  idempotencyKey           String?
  submittedByCustomerId    String?
  submittedByStaffUserId   String?
  submittedAt              DateTime @default(now())

  @@unique([auctionId, idempotencyKey])
}
```

Adjust names to match the current schema.

## 6.3 Waiting Room

Use the existing attendance/admission model where possible.

Required fields:

```text
auctionId
memberId
customerId
status
joinedAt
admittedAt
deniedAt
admittedBy
denialReason
connectionStatus
lastSeenAt
```

## 6.4 Customer Messages

Recommended fields:

```text
auctionId
customerId
staffUserId
senderType
message
createdAt
readAt
```

---

# 7. Web UI Updates

## 7.1 Staff Web Room

Update the current staff room to use the shared room state.

Sections:

1. Auction header.
2. Timer and anti-snipe state.
3. Attendance and waiting room.
4. Bid entry on behalf of members.
5. Bid history.
6. Messages.
7. Tie resolution.
8. Winner confirmation.
9. Security and payout.

## 7.2 Customer Web Portal

Recommended layout:

```text
Desktop:
  Left navigation
  Main content
  Auction status panel

Mobile web:
  Bottom navigation
  Full-width cards
  Sticky bid confirmation
```

Customer navigation:

```text
Dashboard
My Chits
Payments
Receipts
Profile
```

## 7.3 Web Voice Control

Use the browser speech-recognition layer where supported.

Fallback:

- Manual prize entry.
- Manual discount entry.
- No browser voice support message.

Do not block bidding when voice recognition is unavailable.

---

# 8. Mobile UI Updates

## 8.1 Customer Mode

The mobile app should distinguish:

```text
Staff session
Customer session
```

Do not mix staff and customer navigation.

## 8.2 Customer Mobile Tabs

```text
Home
My Chits
Payments
Receipts
Profile
```

## 8.3 Customer Live Room

Recommended layout:

1. Live status and timer.
2. My ticket and eligibility.
3. Current leading bid.
4. Prize and discount entry.
5. Quick-increment buttons.
6. Hold-to-speak microphone.
7. Bid confirmation sheet.
8. My bid history.
9. Organizer messages.
10. Reconnection banner.

## 8.4 Voice Permission

Request microphone permission only when the customer taps the microphone.

Provide:

- Permission explanation.
- Retry.
- Open device settings.
- Manual entry fallback.

---

# 9. Required Customer Credential Behaviour

## 9.1 Staff Creates Customer

Customer creation must not require loan-only fields such as collection route when the application is in Chit Fund mode.

## 9.2 Enrollment Enables Chit Portal

After successful chit enrollment:

- Customer portal module should include `chitfunds`.
- The membership should appear automatically.
- No separate staff-user creation should be required.

## 9.3 Multiple Memberships

One customer may have:

- Multiple tickets in one group.
- Tickets in multiple groups.
- Both loans and chit memberships.

The portal must handle all cases.

## 9.4 Credential Reset

Staff may:

- Resend activation OTP.
- Reset portal access.
- Disable portal access.
- Force logout of all customer sessions.

Staff must not be able to see the customer’s password or PIN.

---

# 10. Acceptance Criteria

## Scenario 1 — Chit-Only Customer Login

**Given** a customer is enrolled in an active chit group and has no loan  
**When** the customer logs in using OTP  
**Then** the customer should enter the Customer Portal  
**And** the Chit Funds module should be visible  
**And** the customer should not be redirected because no loan exists.

## Scenario 2 — Customer Sees Own Membership

**Given** a logged-in customer has one active chit ticket  
**When** the customer opens My Chits  
**Then** the customer should see that ticket  
**And** should not see another customer’s ticket.

## Scenario 3 — Customer Joins Auction

**Given** the customer has an eligible ticket  
**And** the auction is scheduled  
**When** the customer selects Join Waiting Room  
**Then** the customer should be added to the waiting room  
**And** staff should be able to admit or deny the customer.

## Scenario 4 — Customer Places Tap Bid

**Given** the customer is admitted  
**And** the auction room is open  
**When** the customer enters a valid prize or discount and confirms  
**Then** the backend should validate ownership and limits  
**And** accept the bid  
**And** broadcast the updated room state.

## Scenario 5 — Customer Cannot Bid for Another Member

**Given** the customer is authenticated  
**When** the request contains another customer’s member or ticket ID  
**Then** the backend should reject the request  
**And** no bid should be created.

## Scenario 6 — Minimum Discount Validation

**Given** the configured minimum discount is ₹10,000  
**When** the customer offers ₹5,000  
**Then** the bid should be rejected with a clear message.

## Scenario 7 — Maximum Discount Validation

**Given** the configured maximum discount is ₹50,000  
**When** the customer offers ₹60,000  
**Then** the bid should be rejected with a clear message.

## Scenario 8 — Anti-Snipe Extension

**Given** anti-snipe extension is 60 seconds  
**And** a valid bid is placed near the closing time  
**When** the bid is accepted  
**Then** the auction closing time should extend atomically by 60 seconds  
**And** all connected clients should receive the updated time.

## Scenario 9 — Voice Bid Confirmation

**Given** the customer holds the microphone and speaks a valid amount  
**When** speech recognition returns the amount  
**Then** the app should display the interpreted prize and discount  
**And** should not submit until the customer manually confirms.

## Scenario 10 — Voice Audit

**Given** a voice bid is confirmed  
**When** the bid is saved  
**Then** the source should be stored as `customer_voice`  
**And** the transcript should be retained  
**And** the optional audio reference should be linked when enabled.

## Scenario 11 — Duplicate Bid Retry

**Given** the customer submits a bid with an idempotency key  
**When** the same request is retried using the same key  
**Then** the system should return the original result  
**And** should not create a duplicate bid.

## Scenario 12 — Customer Contribution Breakdown

**Given** a contribution includes a dividend adjustment and penalty  
**When** the customer views the contribution  
**Then** base contribution, dividend, penalty, net due, paid, and outstanding should be displayed.

## Scenario 13 — Customer Receipt

**Given** a customer payment is successful  
**When** the customer opens Receipts  
**Then** the receipt should be visible and downloadable.

## Scenario 14 — Web and Mobile State Consistency

**Given** the same customer is logged in on web and mobile  
**When** an auction bid is accepted  
**Then** both clients should show the same leading bid and remaining time.

---

# 11. Test Plan

## 11.1 Backend Tests

Test:

- Customer token authentication.
- Tenant and branch isolation.
- Membership ownership.
- Eligible/ineligible member.
- Previous winner restriction.
- Room admission.
- Bid min/max validation.
- Bid increment.
- Anti-snipe extension.
- Dividend calculation.
- Idempotency.
- Duplicate concurrent requests.
- Voice source and transcript.
- Customer payment.
- Receipt generation.

## 11.2 Web Tests

Test:

- Chit-only customer login.
- Product-based dashboard.
- My Chits list.
- Chit detail.
- Waiting room.
- Join and leave.
- Tap bid.
- Voice bid.
- Bid confirmation.
- Reconnection.
- Receipt download.
- Responsive mobile web layout.

## 11.3 Mobile Tests

Test:

- Customer OTP login.
- Customer token storage.
- Chit module visibility.
- My Chits.
- Auction join.
- Attendance/admission state.
- Tap bid.
- Voice permission.
- Tamil and English parsing.
- Manual confirmation.
- Offline/retry handling.
- Idempotency.
- Reconnection.
- Payment and receipt.

## 11.4 Security Tests

Test:

- Access another customer’s group.
- Change member ID in payload.
- Change ticket ID in payload.
- Replay bid.
- Duplicate bid request.
- Expired token.
- Disabled customer.
- Cross-tenant access.
- Cross-branch access.
- Closed auction bid.
- Client clock manipulation.
- Rate limiting.

## 11.5 Suggested Commands

Run the commands available in the repository, including:

```bash
npm run typecheck
npm run test:rbac-new-modules
npm run test:mobile-parity-api
npm run test:e2e-chits-ui
flutter analyze --no-fatal-infos --no-fatal-warnings
flutter test
```

Document exact environment blockers where a command cannot run.

---

# 12. Migration Requirements

Before production deployment:

1. Create real Prisma migration folders and SQL.
2. Do not rely only on `prisma db push`.
3. Validate migration on a fresh database.
4. Validate migration on a copy of production-like data.
5. Back up the database.
6. Run deployment migration.
7. Validate customer login, auction room, bids, payments, and receipts.

Example:

```bash
npx prisma migrate dev --name customer_chit_portal_live_bidding
npx prisma migrate deploy
npx prisma generate
```

---

# 13. Rollout Plan

## Release 1

- Shared auction DTO.
- Canonical auction-ID APIs.
- Retire old auction routes.
- Align staff web and mobile rooms.
- Persist bid source and transcript.

## Release 2

- General customer authentication.
- Customer dashboard.
- My Chits.
- Contributions and receipts.

## Release 3

- Customer waiting room.
- Customer tap bidding.
- Real-time event stream.
- Bid idempotency.

## Release 4

- Voice bidding.
- Tamil and English parsing.
- Audio/transcript audit.
- Consent flow.

## Release 5

- Online payments.
- Security and payout visibility.
- Performance and scale testing.
- Production rollout.

---

# 14. Final Recommended Direction

The application should not create a separate auction engine for customers.

The correct design is:

```text
Shared auction engine
Shared calculation service
Shared validation service
Shared event service
Separate staff and customer interfaces
```

The existing borrower portal should be generalized into a Customer Portal.

Customer credentials should be tied to the existing `Customer` record and registered phone number.

After a customer is enrolled into a chit group, the Chit Funds module should automatically become available in both web and mobile.

Customers should be allowed to place their own bids using:

- Manual prize amount.
- Manual discount amount.
- Quick increment controls.
- Voice input in Tamil or English.

Every bid must require confirmation and must be validated by the backend before acceptance.
