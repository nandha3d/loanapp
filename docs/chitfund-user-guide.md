# ChitFund Module — Complete Page-by-Page Guide

This is a plain-language walkthrough of every screen in the Chit Funds module, in the order you'd normally use them: **List → Create → Detail → Auction → Edit**. It also explains the money math (commission, dividend, prize) and who is allowed to do what.

---

## 1. Lifecycle at a glance

```mermaid
flowchart LR
    A[Create group\n(draft)] --> B[Add/verify members\nticket no, agreement, nominee]
    B --> C[Activate Group]
    C --> D[Auctions run\nperiod 1..N]
    D --> E[Winner decided\nbid / draw]
    E --> F[Security submitted\n& approved]
    F --> G[Prize payout released]
    G --> D
    D --> H[All periods done\nGroup completed/cancelled]
```

A chit group has one entry per "period" (month, week, etc. — however many periods as `Total Members`). Each period runs its own auction, has a winner, and every member pays their installment for that period.

---

## 2. List page — `/chits`

**Purpose:** See all chit groups, filter, and jump into one.

- **KPI cards:** Active Groups, Completed Groups, Total Members (sum across all listed groups).
- **Filters:** Search by name (`?q=`), filter by status — All / Active / Completed / Cancelled.
- **Table columns:** Name · Chit Value · Installment · Members (enrolled/total) · Auctions Done (completed/total) · Start Date · Status badge · **View**.
- **Branch scoping:** If you're scoped to a branch, you only see that branch's groups (plus org-wide ones with no branch).
- **+ New Chit Group** button (hidden for agents) → takes you to the create page.
- Agents cannot open this page at all — they're redirected to Collection.

---

## 3. Create page — `/chits/new`

Everything here can still be changed later while the group is a **draft** (before you hit Activate).

### Basic details
| Field | Notes |
|---|---|
| Group Name | Free text |
| Chit Value (₹) | Total pot size. **Must equal** `Installment × Total Members` — the form checks this and tells you the expected value if it doesn't match. |
| Installment Amount (₹) | Amount due from each member, every period |
| Total Members | Also sets the number of periods (a 10-member chit runs 10 periods) |
| Start Date | Date period 1 is due/auctioned |
| Chit Type | `Unregistered` (default, no legal paperwork required) or `Registered` (must be registered with the Registrar of Chits — extra compliance fields appear, see below) |

### Chit style
| Field | Options | Meaning |
|---|---|---|
| Auction Type | Open auction (manual entry) · Open live (online bidding room) · Sealed tender · Lottery · Fixed rotation | How the period's winner/discount is decided |
| Frequency | Monthly (default) · Fortnightly · Weekly · Daily | How often a period/auction happens |
| Auction Day | Optional — day of week (weekly) or day of month |
| Fixed Discount % | Only for **Lottery** / **Fixed rotation** — a pre-agreed discount % applied to every draw instead of a bid |

### Registration & approval (Registered chits only)
Registration No, Registration Date, Registrar Office, By-law No, Commencement Certificate, GST % on Commission, Approved Bank Name, Approved Bank A/C No. These are **not required to save a draft**, but you can't Activate a registered chit without them.

### Foreman & commission
| Field | Meaning |
|---|---|
| Foreman Name | The organizer/company running the chit (required for registered chits) |
| Commission % | The foreman's cut, default 5%, 0–20 |
| Commission Basis | `% of bid discount` (default) or `% of chit value` |
| Commission Cap % | Optional ceiling — commission % can never exceed this |
| Foreman/Company Holds a Ticket | If checked, one ticket belongs to the foreman and automatically wins **period 1 without an auction** (no bidding needed) |

### Bid & dividend rules
| Field | Applies to | Meaning |
|---|---|---|
| Min / Max Discount % | Open auctions | The allowed range for how much a member can discount their prize by when bidding |
| Bid Increment (₹) | Open auctions | Minimum amount a new bid must beat the current highest by |
| Tie Break at Cap | Open auctions | `Earliest bid` wins ties, or `Lottery among tied` picks randomly |
| Dividend Shared By | All | `All members` (winner included) or `Non-winners only` |
| Dividend Distribution | All | `Reduces next installment` (default) · `Paid out in cash` · `Accumulated to closure` |
| Dividend Rounding | All | Round dividend down to nearest ₹0/₹1/₹10; the leftover rounding becomes extra foreman income |

### Members
Pick customers into ticket slots (one dropdown per slot, duplicates blocked). You don't have to fill every slot immediately — you can save fewer members than `Total Members` and add the rest later by editing the group **while still in draft**. Ticket numbers are assigned automatically in the order you add members (member 1 → ticket "1", etc.) but can be changed per-member afterward.

Submitting creates the group in **draft** status, creates one `ChitMember` row per selected customer (with an auto ticket number and full 1.00 share), and takes you to the group's detail page.

---

## 4. Detail page — `/chits/[id]`

This is the main control room for a group, before and after activation.

### KPI cards
Chit Value · Installment (+ frequency) · Members Enrolled (x/total) · Auctions Completed (x/total).

### Chit configuration box
Read-only summary of everything chosen at creation: type + auction style, commission (+ GST if any), dividend policy/distribution/rounding, bid rules (open auctions) or fixed discount (draw auctions), and a note if a foreman ticket exists.

### Compliance box
For registered chits, shows Registration No/Registrar/By-law/Commencement Cert/Approved Bank/Foreman — any blank one shows in red as **"missing"** so you know exactly what's stopping activation. Unregistered chits just show "registration details not required."

### Top action buttons
| Button | When shown | What it does |
|---|---|---|
| **Edit** | Always | Goes to `/chits/[id]/edit` |
| **Auto-assign ticket numbers (N)** | Draft, and N members have no ticket number | Fills in the lowest free ticket numbers for members missing one — it never overwrites a ticket number that's already set |
| **Activate Group** | Draft | Validates everything (see below), then generates every period's subscriptions and auction stubs |
| **Cancel Group** | Active | Confirms, then cancels the group and any still-pending auctions |

### Activation checklist
Activation fails with a message listing everything still missing, checked from `validateChitGroupActivation`:
- At least one member, and **all** member slots filled (enrolled = total)
- Every member has a ticket number
- Ticket shares for any shared/split ticket must add up to exactly 1.00
- All members' agreements are **signed or verified** (not pending/rejected)
- If registered: registration no, date, registrar office, by-law no, commencement certificate, approved bank name, foreman name all present
- If a foreman ticket is enabled: **exactly one** member is marked as the foreman ticket
- Commission % doesn't exceed the commission cap (if set)

On success: group → `active`, subscriptions are generated for every member × every period (`due = installment × ticket share`), an auction stub is created per period, and — if there's a foreman ticket — period 1 is immediately resolved in the foreman's favor without needing a bid.

### Auction History table
One row per period: Period · Date · Winner · Prize · Dividend · Status badge · Payout badge · **Manage** link (→ auction detail page) and, for draw-type chits, an inline **Draw/Resolve** shortcut button.

### Members table
Ticket (shows fraction/foreman star if applicable) · Customer (linked) · Share · Agreement status (with inline **Sign**/**Verify** button) · Nominee · Subscriber status · Won badge · **Edit** button.

**Edit member modal** — see the earlier explanation of each field: Ticket No, Fraction No, Ticket Share, Subscriber Status, Agreement Status, Introduced By, Nominee Name/Relation/Phone, and Foreman Ticket checkbox (only visible if the group has a foreman ticket).

### Member Payments table
Member · Period · Due Date · Due Amount · Dividend · Paid · Receipt No · Status (paid/partial/missed/upcoming) · **Record Payment** / **Missed** buttons.

**Record Payment modal:** Amount Paid (defaults to the remaining due), Payment Mode (cash/UPI/bank/cheque), Reference No (for non-cash), Notes. Partial payments are allowed — the status becomes `partial` until the full due is collected, and each payment gets its own receipt number. **Missed** can only be applied to a subscription that hasn't been paid at all yet.

---

## 5. Auction detail page — `/chits/[id]/auctions/[auctionId]`

Opened via **Manage** from the Auction History table. Handles everything for one period: bidding/draw, attendance, deciding the winner, security, and payout.

### Summary cards
Chit Value · Auction Date · Attendance (present/total) · Status + payout status.

### Notice
**Mark auction notice sent** button records that members were notified.

### Bidding area (open auctions)
- **Add bid:** pick an eligible member (hasn't won yet, active subscriber), enter their Prize Amount — the discount (`chit value − prize`) is shown live. The system rejects bids outside the min/max discount % range, and (if a bid increment is set) bids that don't beat the current highest by enough.
- **Open live auctions** additionally get a **live bidding room**: set a duration + anti-snipe extension (seconds added if someone bids right before time runs out), open it, and a countdown timer + live bid table update automatically while it's open.
- **Sealed tender:** bid amounts stay hidden in the bid list until the auction is decided — you only see a count of sealed bids received.
- **Bid history table:** every bid with time, ticket, member, prize, discount, and status (winning/valid/other); a **Select winner** button lets staff manually pick among valid bids.

### Attendance
Present / Absent / Proxy per member (with a name field for proxy). Read-only badges once the auction is locked (confirmed/paid/cancelled).

### Decide period
- **Draw-type chits (Lottery / Fixed rotation):** a **Draw winner** / **Resolve next in rotation** button. Lottery uses an auditable random draw; fixed rotation always takes the lowest ticket number that hasn't won yet.
- **Bid-based chits:** **Confirm highest bid** picks the earliest bid at the highest discount (or runs a lottery among tied top bids if the tie-break rule is set to lottery).
- Confirming a winner **never releases money** — the prize amount stays locked until security is approved.
- Optional custom "Minutes" text can be entered to override the auto-generated auction minutes.

### Prize & Security (once a winner is set)
Shows winner, prize amount, commission (+GST), and per-member dividend. Staff record security details — Type (guarantor/property/gold/FD/salary/cheque/other), Value, Guarantor Name/Phone, Details — then move it through **Submit → Verify → Approve** (only superadmin/developer can Approve or Reject).

### Prize payout
Once security is **approved**, a **Release {amount}** button appears (Payout Mode + Reference No) — restricted to superadmin/developer. Releasing it marks the auction `paid` and the payout `paid`.

---

## 6. Edit page — `/chits/[id]/edit`

Lets you change the **Group Name** and **Commission %** after creation. If the group is already **active**, only superadmin/developer can edit it (regular admins get "Only superadmin/developer can edit active compliance metadata"). Draft groups can be edited freely by any admin.

---

## 7. Who can do what

| Action | Roles allowed |
|---|---|
| View list/detail | admin, superadmin, developer (agents blocked from `/chits` entirely) |
| Create / activate / edit / auto-assign tickets / edit member details | admin, superadmin, developer |
| Add bid / confirm / draw winner / mark attendance / open-close live room | admin, superadmin, developer |
| Submit / verify security | admin, superadmin, developer |
| **Approve/reject security, release prize payout** | superadmin, developer only |
| Record a member's payment | agent, admin, superadmin, developer |
| Mark payment missed / cancel group | admin, superadmin, developer |

Non-tenant-wide roles (regular admin/agent) are scoped to their active branch — they only see and act on groups/members in that branch (plus org-wide groups without a branch).

---

## 8. The money math

**Auction settlement, per period:**
```
bidDiscount = chitValue − prizeAmount
commissionBase = chitValue          (if Commission Basis = "% of chit value")
              or bidDiscount        (if Commission Basis = "% of bid discount")
commission     = commissionBase × commissionPct / 100
gstAmount      = commission × gstPct / 100                (if GST % set)
distributable  = bidDiscount − commission
eligibleCount  = totalMembers                              (Dividend Shared By = All members)
              or totalMembers − 1                          (Dividend Shared By = Non-winners only)
dividend       = floor(distributable / eligibleCount, roundingStep)
roundingIncome = distributable − (dividend × eligibleCount)   → extra foreman income
```

*Example:* Chit ₹1,00,000, prize ₹90,000, commission 5% of discount, 20 members, GST 12%.
`bidDiscount = 10,000` → `commission = 500` → `gst = 60` → `distributable = 9,500` → `dividend = 9,500 / 20 = 475` per member.

**Draw-type / fixed-discount prize:**
```
bidDiscount = chitValue × fixedDiscountPct / 100
prizeAmount = chitValue − bidDiscount
```

**Dividend distribution choice:**
- *Reduces next installment:* next period's due amount is reduced by the dividend.
- *Paid out in cash:* dividend is paid to each eligible member as a cash receipt.
- *Accumulated to closure:* dividend accrues and is settled when the chit finishes.

Dividend is prorated by ticket share for split tickets (e.g. a 0.5-share member gets half the full dividend).

**Payment status per subscription:**
```
newPaid ≥ due     → "paid"
0 < newPaid < due → "partial"
newPaid = 0       → "upcoming" (or "missed" if explicitly marked)
```

---

## 9. Quick troubleshooting

- **"Cannot activate chit group. Missing/invalid: …"** → open the Members table and fix whatever's listed (usually a missing ticket number, an unsigned agreement, or a missing compliance field for registered chits). Use **Auto-assign ticket numbers** for a one-click fix on blank tickets.
- **Blank breadcrumb showing a raw ID instead of the group name** → fixed; the topbar breadcrumb now shows the chit group's actual name on both the group detail and auction pages.
- **Can't release a prize payout** → security must be `approved` (superadmin/developer only) and payout status must be `ready` first.
