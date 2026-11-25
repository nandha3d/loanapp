# CHIT MODULE — Implementation Context
> Token-optimized reference for Claude Sonnet. Read this before editing any `/chits` file.

---

## STACK
Next.js 14 App Router · Prisma ORM · MySQL · TypeScript · Server Actions (no API routes for chits)

---

## FILE MAP
```
app/(dashboard)/chits/
  page.tsx                        # List page (server component)
  actions.ts                      # ALL server actions (3 total)
  new/
    page.tsx                      # New group page (server component)
    ChitGroupForm.tsx              # Create form (client component)
  [id]/
    page.tsx                      # Detail page (server component)
    ChitGroupDetailClient.tsx      # Detail UI + modals (client component)
```

---

## DB SCHEMA (4 models)

```prisma
ChitGroup        { id, tenantId, branchId?, appType="chitfunds", name, chitValue Decimal,
                   monthlyContrib Decimal, totalMembers Int, durationMonths Int,
                   commissionPct Decimal=5, startDate Date, status="active",
                   members ChitMember[], auctions ChitAuction[] }

ChitMember       { id, chitGroupId, customerId, memberNumber Int, hasWon=false,
                   wonAt?, subscriptions ChitSubscription[] }

ChitAuction      { id, chitGroupId, periodNumber Int, auctionDate Date,
                   winnerMemberId?, prizeAmount?, bidDiscount?, commission?,
                   dividend?, status="pending" }
                   UNIQUE: [chitGroupId, periodNumber]

ChitSubscription { id, memberId, periodNumber Int, dueDate Date,
                   dueAmount Decimal, paidAmount=0, status="upcoming", paidAt? }
                   status values: upcoming | paid | missed
```

---

## EXISTING SERVER ACTIONS (`actions.ts`)

### `createChitGroup(formData)`
1. Validate memberIds.length === totalMembers
2. Verify all customers: active + same tenantId/appType
3. Create ChitGroup
4. Create N ChitMembers (memberNumber: 1..N)
5. Create N×N ChitSubscriptions (all members × all periods), dueDate = startDate + (period-1) months
6. Create N ChitAuction stubs (status=pending), auctionDate = startDate + (period-1) months
7. AuditLog → redirect to /chits/[id]

### `recordAuctionWinner(auctionId, winnerMemberId, prizeAmount)`
- Validate: auction exists, belongs to tenant, status≠completed, member.hasWon=false
- Compute: bidDiscount = chitValue - prizeAmount
- Compute: commission = bidDiscount × commissionPct / 100
- Compute: dividend = (bidDiscount - commission) / (totalMembers - 1)
- Transaction: update ChitAuction (status=completed, all fields) + ChitMember (hasWon=true, wonAt)
- AuditLog

### `recordChitPayment(memberId, periodNumber, paidAmount)`
- Find ChitSubscription via memberId+periodNumber (tenant-scoped join)
- Update: paidAmount, status=paid, paidAt=now()
- AuditLog

---

## PAGE SPECS

### PAGE 1 — `/chits` (List)
**KPI Cards:** activeCount | completedCount | totalMembers (sum across groups)
**Filter:** `?q=` (name contains) + `?status=` (active|completed|cancelled) — GET form
**Table cols:** name | chitValue | monthlyContrib | members(x/y) | auctionsDone(x/y) | startDate | status badge | View btn
**Header action:** `+ New Chit Group` → /chits/new (hidden for agent role)

### PAGE 2 — `/chits/new` (Create)
**Group fields (required):**
| Field | Rule |
|---|---|
| name | text, required |
| chitValue | number, min 1000 |
| monthlyContrib | number, min 100 |
| totalMembers | number, 2–100; also sets durationMonths |
| commissionPct | number, 0–20, step 0.5, default 5 |
| startDate | date, required |

**Members section:**
- Dynamic slots: selectedMembers[] state, length must === totalMembers to enable submit
- Each slot: select from active customers (same tenant/appType), deduplication enforced
- Add slot btn (disabled when full) + remove (×) per slot
- Submit disabled unless ALL slots filled

### PAGE 3 — `/chits/[id]` (Detail)
**KPI Cards:** chitValue | monthlyContrib | members(enrolled/total) | auctions(completed/total)

**Auction History table (60% col):**
cols: periodNumber | auctionDate | winner name | prizeAmount | dividend | status | [Record Winner btn if pending]

**Members table (40% col):**
cols: memberNumber | customer name+code (link to /customers/[code]) | hasWon badge

**Member Payments table (full width):**
cols: member name | periodNumber | dueDate | dueAmount | paidAmount | status | [Record Payment btn if ≠paid]

**Modal A — Record Winner:**
- Select: members where hasWon=false only
- Input: prizeAmount (default=chitValue, max=chitValue)
- Computed display: bidDiscount + commission breakdown
- Action: recordAuctionWinner()

**Modal B — Record Payment:**
- Input: amount (pre-filled with dueAmount, editable)
- Action: recordChitPayment()

---

## AUTH & ACCESS
```ts
requireAdmin()  // redirects agents → /collection
requireModule(tenantId, 'chitfunds')  // redirects if module not in subscription
```
All chit actions require admin/superadmin role. Agent role cannot access /chits.

---

## KEY PATTERNS (reuse these)
```ts
// Tenant isolation — always include in where clause
const where = { tenantId, appType }
if (branchId) where.branchId = branchId

// Currency display
formatCurrency(Number(value), currencySymbol)  // from lib/utils

// Date display  
formatDate(date)  // from lib/utils

// i18n
const dict = await getDictionary(tenantId)
dict.chits.* // all chit strings

// Module gate
await requireModule(tenantId, 'chitfunds')
```

---

## WHAT'S MISSING — BUILD THESE

### P0 — Bugs / Core Gaps
```
[ ] chitValue validation: must equal monthlyContrib × totalMembers (no check exists)
[ ] Partial payment: paidAmount < dueAmount still sets status='paid' (wrong)
[ ] Dividend reduction: after auction, future subscriptions should reduce dueAmount by dividend
[ ] branchId never set on createChitGroup() — field in schema unused
```

### P1 — Missing Actions
```
[ ] cancelChitGroup(id) → status='cancelled', pending auctions → 'cancelled'
[ ] markPaymentMissed(subscriptionId) → status='missed'
[ ] updateChitGroup(id, {name, commissionPct}) → edit page needed
```

### P2 — Missing Pages
```
[ ] /chits/[id]/edit  — ChitGroupEditForm.tsx + updateChitGroup() action
[ ] /api/chits/[id]/statement — PDF export (follow /api/loans/[id]/receipt pattern)
[ ] /api/export/chits — Excel/CSV export (follow /api/export/loans pattern)
```

### P3 — Integrations
```
[ ] Dashboard page.tsx — add chit KPIs (active groups, total chit value, overdue payments)
[ ] AnalyticsClient.tsx — add Chit Funds tab with monthly collection vs target chart
[ ] Customer profile /customers/[id] — add Chit Groups tab showing memberships
[ ] Cron: mark overdue subscriptions as 'missed' (follow /api/cron/accrue-penalties pattern)
```

---

## BUILD ORDER (paste into Claude Code)

```
Step 1: Fix chitValue validation in ChitGroupForm.tsx — add client check: chitValue === monthlyContrib × totalMembers
Step 2: Fix partial payment — update recordChitPayment() to set status='partial' when paidAmount < dueAmount
Step 3: Add branchId to ChitGroupForm.tsx and createChitGroup() action
Step 4: Add markPaymentMissed() action + "Mark Missed" button in ChitGroupDetailClient.tsx
Step 5: Add dividend reduction — after recordAuctionWinner(), bulk-update future ChitSubscription.dueAmount -= dividend for non-winner members
Step 6: Add cancelChitGroup() action + Cancel button on detail page
Step 7: Create /chits/[id]/edit page — copy new/page.tsx pattern, add updateChitGroup() action
Step 8: Create /api/chits/[id]/statement — PDF receipt (copy /api/loans/[id]/receipt/route.tsx)
Step 9: Add chit KPIs to dashboard page.tsx
Step 10: Add Chit Funds tab to AnalyticsClient.tsx
```

---

## COMPUTED FIELDS REFERENCE
```
durationMonths     = totalMembers          (set equal on create)
auction.dueDate    = startDate + (period - 1) months
subscription.dueDate = startDate + (period - 1) months
bidDiscount        = chitValue - prizeAmount
commission         = bidDiscount × commissionPct / 100
dividend           = (bidDiscount - commission) / (totalMembers - 1)
netContrib         = monthlyContrib - dividend   ← NOT applied yet (P0 bug)
```

---

## STATUS VALUES
| Model | Field | Values |
|---|---|---|
| ChitGroup | status | active \| completed \| cancelled |
| ChitAuction | status | pending \| completed |
| ChitSubscription | status | upcoming \| paid \| missed |
| ChitMember | hasWon | true \| false |
