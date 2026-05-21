bash

cat << 'EOF' > /mnt/user-data/outputs/DESIGN.md
# LoanTrack Mobile — Design System
> Google Stitch DESIGN.md · Flutter Mobile App · Microlending & Chit Fund Platform
> **All tokens extracted directly from app globals.css — DO NOT modify colors**

---

## App Overview

**Product:** LoanTrack — a microlending and chit fund management mobile app for field agents and branch administrators.
**Platform:** Mobile (Android + iOS)
**Users:** Field agents (daily collection), branch admins, superadmins
**App Type:** Finance / FinTech — professional, data-dense, amber-accented dark navigation

---

## Colors

- Primary: #F5A623
- Primary Dark: #E8930C
- Primary Light: #FFF3E0
- Background: #F4F6F9
- Surface: #FFFFFF
- Sidebar Background: #1A1D23
- Sidebar Hover: #2A2D35
- Text Primary: #1E293B
- Text Secondary: #64748B
- Text Light: #94A3B8
- Border: #E2E8F0
- Success: #27AE60
- Success Background: #DCFCE7
- Danger: #E74C3C
- Danger Background: #FEE2E2
- Warning: #F59E0B
- Warning Background: #FEF3C7
- Info: #2980B9
- Info Background: #E0F2FE
- Purple: #8B5CF6
- Purple Background: #F3E8FF
- Overlay: rgba(0,0,0,0.5)

---

## Typography

- Font Family: Inter, sans-serif
- Base font size: 14px

- Display / H1: 1.6rem (22.4px), 700 weight
- Section Title: 1.15rem (16.1px), 700 weight
- Body Large: 0.9rem (12.6px), 600 weight
- Body: 0.85rem (11.9px), 400 weight
- Body Small: 0.82rem (11.5px), 400 weight
- Label: 0.8rem (11.2px), 400–600 weight
- Caption: 0.75rem (10.5px), 400 weight
- Tiny: 0.72rem (10.1px), 600 weight (badges)
- Extra Tiny: 0.7rem (9.8px), 400 weight (timestamps)

---

## Spacing

- Base unit: 8px
- Page content padding: 24px 28px (desktop) → 16px (mobile)
- Card padding: 20px 24px → 14px 16px (mobile)
- Gap between KPI cards: 16px
- Gap between grid items: 20px
- Topbar height: 64px
- Sidebar width: 260px

---

## Border Radius

- Default (--radius): 12px — cards, modals, dropdowns
- Small (--radius-sm): 8px — buttons, inputs, tabs, chips
- Tab active radius: 7px
- Badge radius: 20px (pill)
- Avatar radius: 50% (circle)
- KPI icon radius: 10px
- Toggle radius: 12px

---

## Shadows

- Default (--shadow): 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)
- Large (--shadow-lg): 0 4px 24px rgba(0,0,0,0.10)
- Primary button hover shadow: 0 4px 12px rgba(245,166,35,0.30)

---

## Transitions

- Default: 0.2s cubic-bezier(0.4, 0, 0.2, 1)

---

## Components

### Buttons
- Primary: background #F5A623, text white, border-radius 8px, padding 9px 18px, font 0.85rem 600 weight. Hover: background #E8930C, translateY(-1px), shadow 0 4px 12px rgba(245,166,35,0.30)
- Secondary: background #F4F6F9, text #1E293B, border 1px solid #E2E8F0, border-radius 8px
- Danger: background #E74C3C, text white, border-radius 8px
- Ghost: background transparent, text #E8930C, no border. Hover: background #FFF3E0
- Small (btn-sm): padding 5px 12px, font 0.78rem
- Icon button: 36px circle, centered icon
- Disabled state: opacity 0.6, no hover effects

### Cards
- Standard card: background white, border-radius 12px, shadow default, padding 20px 24px
- KPI card: white bg, shadow default, padding 20px, flex row with 14px gap. Hover: translateY(-2px) shadow-lg
- KPI icon container: 44px square, border-radius 10px, colored background + matching icon color
  - Green variant: background #DCFCE7, icon color #27AE60
  - Orange variant: background #FFF3E0, icon color #E8930C
  - Red variant: background #FEE2E2, icon color #E74C3C
  - Blue variant: background #DBEAFE, icon color #2980B9
  - Purple variant: background #F3E8FF, icon color #8B5CF6
- KPI value: 1.5rem, 700 weight
- KPI label: 0.75rem, color #64748B, margin-top 2px

### Status Badges
All badges: inline-flex, align-items center, gap 4px, padding 3px 10px, border-radius 20px, font 0.72rem 600 weight
- active / paid: background #DCFCE7, text #166534
- overdue / missed: background #FEE2E2, text #991B1B
- closed: background #E0F2FE, text #075985
- upcoming / info: background #E0F2FE, text #075985
- pending: background #FFF3E0, text #E8930C
- waived: background #F3E8FF, text #7C3AED
- partial: background #FEF3C7, text #92400E

### Input Fields
- Width: 100%, padding 10px 14px, border 1px solid #E2E8F0, border-radius 8px
- Font: 0.85rem Inter, background white
- Focus: border-color #F5A623, box-shadow 0 0 0 3px rgba(245,166,35,0.15)
- Label: 0.8rem 600 weight, color #1E293B, margin-bottom 6px
- Error text: color #E74C3C, font 0.75rem, margin-top 4px
- Select: custom chevron arrow SVG right 12px, padding-right 36px
- Textarea: min-height 80px, resize vertical

### Navigation — Mobile Bottom Bar
- Background white, border-top 1px solid #E2E8F0, shadow-lg above
- 4–5 items, selected item: filled icon + label in #F5A623 (Primary)
- Unselected: icon + label in #94A3B8 (Text Light)

### Navigation — Sidebar (adapted to mobile drawer)
- Background #1A1D23 (very dark charcoal)
- Nav links: color rgba(255,255,255,0.65), padding 10px 16px, border-radius 8px, font 0.9rem 500 weight
- Active nav link: background #F5A623, color white
- Hover nav link: background #2A2D35, color white
- Brand section: border-bottom 1px solid rgba(255,255,255,0.08), padding 20px 24px
- Brand name: 1.15rem 700 weight, "Track" in Primary color #F5A623
- Footer: border-top rgba(255,255,255,0.08), user avatar 36px circle with Primary bg

### Tabs
- Container: background #F4F6F9, border 1px solid #E2E8F0, border-radius 10px, padding 4px, width fit-content
- Tab item: padding 7px 18px, font 0.85rem 600 weight, border-radius 7px
- Active tab: background white, color #E8930C, box-shadow 0 1px 4px rgba(0,0,0,0.10), border 1px solid #E2E8F0
- Inactive tab: color #64748B, no background

### Progress Bar
- Height: 8px, background #E2E8F0, border-radius 4px, overflow hidden
- Fill: linear-gradient(90deg, #F5A623, #E8930C), border-radius 4px
- Progress text: 0.72rem, color #64748B, margin-top 4px

### Tables
- Header (thead th): background #F4F6F9, border-bottom 1px solid #E2E8F0, font 0.75rem 600 weight uppercase, letter-spacing 0.5px, color #64748B, padding 10px 14px
- Body rows (tbody td): padding 12px 14px, font 0.85rem, border-bottom 1px solid #E2E8F0
- Row hover: background #FAFBFC
- Locked row: opacity 0.5, pointer-events none, background #F9FAFB

### Modal / Bottom Sheet (mobile)
- Background white, border-radius 12px top corners only (mobile sheet)
- Max-height 85vh, position fixed bottom 0, full-width
- Header: padding 20px 24px, border-bottom 1px solid #E2E8F0, title 1.05rem 700 weight
- Body: padding 20px 24px
- Footer: padding 16px 24px, border-top 1px solid #E2E8F0, flex row justify end, gap 10px
- Overlay: rgba(0,0,0,0.5)

### Activity Feed Item
- Flex row, gap 12px, padding 12px 0, border-bottom 1px solid #E2E8F0
- Dot: 8px circle, background #F5A623, margin-top 6px
- Text: 0.82rem
- Timestamp: 0.72rem, color #94A3B8

### Empty State
- Centered, padding 48px 24px
- Icon: 56px, color #94A3B8
- Title: 1.1rem 600 weight, margin 12px 0 6px
- Subtitle: 0.85rem, color #64748B, margin-bottom 20px

### Toast Notification
- Position fixed top-right, z-index 300
- Padding 12px 20px, border-radius 8px, background white, shadow-lg
- Left border 4px solid Primary/success/danger/warning depending on type
- Font 0.85rem, min-width 300px
- Slide in from right animation

### Skeleton Loader
- Background: linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%)
- Background-size: 200% 100%, shimmer animation 1.5s infinite
- border-radius 8px

### Login Screen Specific
- Wrapper: dark background linear-gradient(135deg, #1A1D23 0%, #2D1F0E 50%, #1A1D23 100%)
- Decorative radial glows: rgba(245,166,35,0.15) top-right, rgba(245,166,35,0.10) bottom-left
- Login card: white, border-radius 16px, padding 48px 40px, max-width 420px, shadow-lg, fadeUp animation
- Logo: flex row, app name with "Track" portion in #F5A623
- Error state: background #FEE2E2, text #991B1B, border-radius 8px

---

## Screen Prompts

Use each prompt below independently in Google Stitch. Every prompt references the design tokens above.

---

### Screen 1 — Login Screen

Design a mobile login screen for LoanTrack, a microlending finance app.

Background: full-screen dark gradient — linear-gradient(135deg, #1A1D23 0%, #2D1F0E 50%, #1A1D23 100%). Add two subtle circular amber glow effects: one rgba(245,166,35,0.15) in the top-right corner, one rgba(245,166,35,0.10) in the bottom-left.

Centered white card (border-radius 16px, padding 48px 40px, max-width 420px, shadow 0 4px 24px rgba(0,0,0,0.10), fadeUp entrance animation):

Inside card (top to bottom):
- Logo row: small coin/rupee icon (44px) left + "Loan**Track**" text right — "Loan" in #1E293B bold 1.6rem, "Track" in amber #F5A623
- 32px gap
- Username input (label "Username" above, person icon inside left, border 1px #E2E8F0, focus border #F5A623 with amber glow 0 0 0 3px rgba(245,166,35,0.15))
- 16px gap
- Password input (label "Password" above, lock icon inside left, eye-toggle icon inside right)
- 24px gap
- "Sign In" primary button — full-width, background #F5A623, text white, border-radius 8px, height 48px, font 0.85rem 600 weight
- 12px gap
- "Forgot Password?" ghost link centered — text #E8930C, 0.8rem

Error state (shown above inputs when credentials fail): red banner background #FEE2E2, text #991B1B, border-radius 8px, padding 10px 14px, warning icon + "Invalid username or password" text, 0.82rem font.

---

### Screen 2 — Dashboard (Admin View)

Design a mobile dashboard home screen for LoanTrack. Use Inter font throughout, background #F4F6F9.

Top bar (white, border-bottom 1px solid #E2E8F0, height 64px, horizontal padding 16px):
- Left: hamburger menu icon (opens dark sidebar)
- Center: "Dashboard" in 1.15rem 700 weight #1E293B
- Right: notification bell icon with red badge "3" (background #E74C3C, white text, 18px circle)

Scrollable content (padding 16px):

KPI grid (2×2, gap 16px, margin-bottom 24px): each card white, border-radius 12px, shadow 0 1px 3px rgba(0,0,0,0.08), padding 20px, flex row with icon-container left + text right:
- "Today's Collection" — icon container 44px border-radius 10px background #DCFCE7, icon color #27AE60, value "₹24,500" in 1.5rem 700 weight, label "Today's Collection" in 0.75rem #64748B
- "Pending Approvals" — icon container background #FFF3E0, icon color #E8930C, value "5" in amber #F5A623, label in #64748B
- "Active Loans" — icon container background #E0F2FE, icon color #2980B9, value "142"
- "Overdue Amount" — icon container background #FEE2E2, icon color #E74C3C, value "₹8,200" in red

Section "Today's Schedule" (title "Today's Schedule" 1rem 700 left, "View All" amber ghost link right, 16px top margin):
Horizontal scrollable row of cards (each 200px wide, white, border-radius 12px, padding 12px):
- Customer name bold, loan code in 0.75rem #64748B monospace below
- Due amount "₹850" in 1.1rem 700 #E8930C
- Status badge "partial" (background #FEF3C7, text #92400E, border-radius 20px)
- "Collect" small button (amber bg, white text, border-radius 8px, padding 5px 12px, 0.78rem)

Section "Collection Trend" (white card, border-radius 12px, padding 20px 24px, margin-top 20px):
- Title "Last 7 Days" 1rem 700, subtitle "Collection Overview" 0.75rem #64748B
- Bar chart: 7 vertical bars (Mon–Sun), bars in #FFF3E0 with amber #F5A623 fill, today's bar in #E8930C, smooth gradient fill, rounded top corners, Y-axis labels in 0.72rem #94A3B8, X-axis day labels below

Section "Recent Activity" (white card, margin-top 20px): title "Recent Activity", vertical list of activity items — 8px amber dot left, action text 0.82rem, timestamp 0.72rem #94A3B8, border-bottom #E2E8F0 between items.

Bottom navigation bar: white bg, border-top 1px #E2E8F0, shadow above, 5 items — "Home" (active, amber #F5A623 filled icon + label), "Customers", "Loans", "Collection", "More" (inactive, #94A3B8).

---

### Screen 3 — Customer List Screen

Design a mobile customer list screen for LoanTrack. Font: Inter. Background: #F4F6F9.

App bar (white, border-bottom 1px #E2E8F0, height 64px, padding 0 16px):
- Left: back arrow icon #1E293B
- Title: "Customers" 1.15rem 700 #1E293B
- Right: search icon button + filter icon button, both color #64748B

Search bar (white full-width strip below app bar, padding 8px 16px): input with magnifier icon inside left (color #94A3B8), placeholder "Search by name, code or phone" in #94A3B8, border 1px #E2E8F0 radius 8px, focus border amber #F5A623.

Filter row (horizontal scroll, padding 8px 16px, gap 8px): pill chips — "All" (selected: background #F5A623, text white, border-radius 20px, padding 6px 16px, 0.78rem 600 weight), "Active" / "Pending" / "Suspended" (unselected: background white, border 1px #E2E8F0, text #64748B), "Route A ▾" dropdown chip.

Customer list (padding 0 16px, gap 8px between cards):
Customer tile (white card, border-radius 12px, shadow default, padding 14px, flex row, gap 12px):
- Left: 48px circle avatar, background #F5A623, white initials text 1.1rem 700 (e.g. "RK")
- Center column: name "Rajan Kumar" 0.9rem 600 #1E293B, code "CUS-0042" 0.72rem #94A3B8 monospace below, route chip "Route A" (background #FFF3E0, text #E8930C, border-radius 6px, padding 2px 8px, 0.72rem) below code
- Right: status badge "active" (background #DCFCE7, text #166534), chevron icon #E2E8F0 below badge
Show 5 customer tiles with different names, codes, and statuses (mix active/pending/overdue).

FAB (bottom-right, 56px circle, background #F5A623, white person-add icon, shadow 0 4px 24px rgba(245,166,35,0.30)): label "Add Customer" as extended FAB.

---

### Screen 4 — Loan Detail Screen

Design a mobile loan detail screen for LoanTrack. Font: Inter. Background: #F4F6F9.

App bar (white, border-bottom 1px #E2E8F0, padding 0 16px):
- Back arrow #1E293B left
- Title "Loan Details" 1.15rem 700 center
- Edit icon right (color #64748B)

Scrollable content (padding 16px top):

Header card (white, border-radius 12px, shadow default, padding 20px):
- Top row: "LN-20260042" in 0.9rem monospace 700 #1E293B left, badge "active" (background #DCFCE7, text #166534, border-radius 20px) right
- "Rajan Kumar" in 0.85rem #64748B below, with chevron (tappable link)
- 16px gap, then 4 pill stats in a row (gap 8px, each: border 1px #E2E8F0, border-radius 20px, padding 5px 12px, 0.75rem #64748B):
  "24 Instalments" · "18 Paid" · "6 Remaining" · "0 Overdue"

Repayment progress card (white, border-radius 12px, padding 16px, margin-top 12px):
- Row: "Repayment Progress" 0.8rem #64748B left, "75%" 0.8rem 700 #E8930C right
- Progress bar: height 8px, background #E2E8F0, fill linear-gradient(90deg, #F5A623, #E8930C) width 75%, border-radius 4px, margin-top 8px

Tab bar (background #F4F6F9, border 1px #E2E8F0, border-radius 10px, padding 4px, margin-top 16px, horizontal flex):
"Schedule" (active: white bg, border 1px #E2E8F0, text #E8930C, border-radius 7px) | "Payments" | "Penalties" | "Collateral" (inactive: text #64748B)

Schedule tab — instalment list (white card, radius 12px, padding 0, margin-top 12px, overflow hidden):
Each row (padding 12px 16px, border-bottom 1px #E2E8F0, flex row, align-items center):
- Left: "#18" 0.75rem 700 #94A3B8 in 28px circle background #F4F6F9
- Center: due date "May 20" 0.82rem #1E293B, amount "₹1,200" 0.9rem 700
- Right: received amount "₹1,200" 0.82rem #27AE60, badge "paid"
Show 2 paid rows (normal), 1 partial row (warning colors #FEF3C7 background, amount in #F59E0B), 2 upcoming rows (lighter text #64748B).

Floating bottom bar (white, border-top 1px #E2E8F0, shadow-lg above, padding 16px):
"Record Payment" full-width primary button (background #F5A623, text white, border-radius 8px, height 48px, 0.85rem 600).

---

### Screen 5 — Collection Screen (Agent View)

Design a mobile daily collection screen for a LoanTrack field agent. This is the most-used screen — optimise for speed and one-handed use. Font: Inter. Background: #F4F6F9.

App bar (white, border-bottom 1px #E2E8F0, padding 0 16px, height 64px):
- Left: hamburger icon
- Center: "Collection" 1rem 700 #1E293B, date "Thursday, May 21" 0.75rem #64748B below (two-line)
- Right: sync indicator — green dot (8px) + "Synced" 0.72rem #27AE60

Summary strip (white card, border-radius 12px, margin 12px 16px, padding 14px 16px, flex row, gap 0, border 1px #E2E8F0):
3 stat items separated by vertical dividers:
- "₹18,400" 1.1rem 700 #1E293B above, "Total Due" 0.72rem #64748B below
- "₹12,200" 1.1rem 700 #27AE60 above, "Collected" 0.72rem #64748B below
- "₹6,200" 1.1rem 700 #F59E0B above, "Pending" 0.72rem #64748B below

Filter chips (horizontal scroll, padding 4px 16px, gap 8px): "All" (active: background #F5A623, white text, border-radius 20px) | "Today" | "Overdue" | "Partial" (inactive: white bg, border 1px #E2E8F0, text #64748B)

Route group header (sticky, padding 8px 16px, background #FFF3E0, flex row space-between):
- "Route A" 0.8rem 700 #E8930C left
- "8 customers · ₹6,400 pending" 0.75rem #64748B right

Collection tile (white card, border-radius 8px, margin 6px 16px, padding 14px, shadow 0 1px 3px rgba(0,0,0,0.08)):
Row 1: customer name "Suresh P." 0.9rem 600 #1E293B left, "3 days overdue" 0.75rem #E74C3C right (only if overdue)
Row 2: loan code "LN-20260018" 0.72rem #94A3B8 monospace left, due amount "₹850" 0.9rem 700 right
Row 3: outstanding amount "₹850 outstanding" 0.78rem #F59E0B left, "Collect" small button right (background #F5A623, white text, border-radius 8px, padding 5px 14px, 0.78rem 600)

Show 3 tiles in Route A (1 overdue in red accent, 2 normal), then Route B header, then 2 more tiles.

Collect bottom sheet (slides up on "Collect" tap): white sheet, border-radius 12px 12px 0 0, drag handle at top (40px wide 4px tall #E2E8F0 centered):
- Title "Collect Payment" 1.05rem 700 #1E293B
- Customer + loan info 0.82rem #64748B
- Amount input (large, center-aligned, 1.6rem monospace #1E293B, pre-filled "850", ₹ prefix in #F5A623, border-bottom 2px #F5A623)
- "Payment Mode" label 0.8rem 600, then pill selector row: "Cash" | "UPI" | "Bank" (selected "Cash": background #F5A623, white text; unselected: border 1px #E2E8F0, text #64748B)
- 20px gap
- "Confirm Collection" full-width primary button (amber), "Cancel" ghost link below centered

---

### Screen 6 — New Loan Form — Step 3 of 5 (Loan Terms)

Design a mobile new loan form screen at step 3 of 5, "Loan Terms", for LoanTrack. Font: Inter. Background: #F4F6F9.

App bar (white, border-bottom 1px #E2E8F0, padding 0 16px):
- Back arrow left
- Title "New Loan" 1.15rem 700 center
- "Step 3 / 5" 0.78rem #64748B right

Step progress bar (below app bar, full-width, height 4px): 5 equal segments, 3 filled #F5A623, 2 unfilled #E2E8F0, no gap.

Content (scrollable, padding 16px):

Section heading "Loan Terms" 1.1rem 700 #1E293B, margin-bottom 16px.

Selected customer card (white, radius 12px, padding 14px, margin-bottom 16px, flex row, gap 12px, border 1px #E2E8F0):
- Avatar 44px circle #F5A623, initials white
- Customer name 0.9rem 600, code 0.72rem #94A3B8
- Credit score ring right: 64px circle arc, score "78" 1rem 700 center, arc color #27AE60, "Credit Score" 0.65rem #64748B below

Form card (white, radius 12px, padding 16px):
Form fields stacked, each row: label 0.8rem 600 #1E293B above, input field (height 44px, border 1px #E2E8F0, radius 8px, focus amber), divider line #E2E8F0 between fields:
1. "Principal Amount" — input with "₹" prefix in #F5A623, value "50,000" right-aligned monospace
2. "Interest Rate" — input with "% per period" suffix, value "2"
3. "Repayment Frequency" — 3 pill buttons in a row: "Daily" | "Weekly" (selected amber bg white text) | "Monthly" (unselected)
4. "Number of Instalments" — number input, value "52"
5. "Start Date" — tappable field with calendar icon right, value "Jun 1, 2026" in #1E293B
6. "Penalty Rate" — input with "% per day" suffix, value "1.5"

Computed summary card (white, radius 12px, padding 16px, margin-top 12px, border-left 4px solid #F5A623):
- "₹2,420" 1.4rem 700 #E8930C — "per instalment"
- "₹1,25,840 total repayment" 0.85rem #1E293B
- "₹75,840 total interest" 0.82rem #64748B

Bottom bar (white, border-top 1px #E2E8F0, padding 16px, flex row gap 12px):
- "Back" secondary button left (flex 1, border 1px #E2E8F0, text #1E293B)
- "Next: Disbursement" primary button right (flex 2, background #F5A623, white text)

---

### Screen 7 — Approvals Screen

Design a mobile approvals queue screen for LoanTrack admin users. Font: Inter. Background: #F4F6F9.

App bar (white, border-bottom 1px #E2E8F0, height 64px, padding 0 16px):
- Back arrow left
- Title "Approvals" 1.15rem 700 center
- Badge "7" right (background #E74C3C, white text, 22px circle, 0.72rem 700)

Tab bar (background #F4F6F9, border 1px #E2E8F0, radius 10px, padding 4px, margin 12px 16px, horizontal flex):
"Loans (4)" (active: white bg, text #E8930C) | "Customers (2)" | "Branch Req. (1)" (inactive: text #64748B)

Content list (padding 0 16px, gap 10px):

Approval card (white, radius 12px, shadow default, padding 16px):
Top row: entity chip "LOAN" (background #FFF3E0, text #E8930C, radius 6px, padding 3px 8px, 0.7rem 600) left, date "May 20" 0.75rem #94A3B8 right
Customer name "Meena Raj" 0.9rem 700 #1E293B, code "LN-20260041" 0.72rem #94A3B8 monospace below
Details "₹75,000 · Weekly · 52 instalments" 0.82rem #64748B, margin-top 4px
Requester "Requested by Karthik (Agent)" 0.78rem #94A3B8, italic, margin-top 4px
Action row (margin-top 14px, padding-top 12px, border-top 1px #E2E8F0, flex row, gap 10px):
- "Reject" button: border 1px #E74C3C, text #E74C3C, bg white, border-radius 8px, padding 8px 20px, flex 1
- "Approve" button: background #F5A623, text white, border-radius 8px, padding 8px 20px, flex 1

Show 3 approval cards (2 loans, 1 customer).

Approve dialog (modal overlay rgba(0,0,0,0.5)): white card radius 12px, padding 24px, max-width 340px centered:
Title "Approve Loan?" 1.05rem 700 centered, details 0.82rem #64748B centered, "Add a note (optional)" textarea input below (border 1px #E2E8F0, radius 8px, 80px min-height), action row: "Cancel" ghost left, "Approve" primary amber right.

---

### Screen 8 — Analytics Screen

Design a mobile analytics and reporting screen for LoanTrack. Font: Inter. Background: #F4F6F9.

App bar (white, border-bottom 1px #E2E8F0, height 64px, padding 0 16px):
- Hamburger left
- "Analytics" 1.15rem 700 center
- Share/export icon right (color #64748B)

Period selector (white card, margin 12px 16px, padding 10px 14px, radius 8px, border 1px #E2E8F0, horizontal flex, gap 6px):
"Today" | "Week" | "Month" (selected: background #F5A623, text white, radius 20px, padding 6px 16px) | "Custom ▾" (unselected: border 1px #E2E8F0, text #64748B, radius 20px)

Collection trend card (white, radius 12px, padding 20px, margin 0 16px, margin-top 4px):
Title "Collection Trend" 1rem 700, subtitle "May 2026" 0.75rem #64748B
Bar chart (height 160px): 15 daily bars, bar color #FFF3E0 background with #F5A623 fill, recent bars taller, today bar #E8930C, Y-axis labels 0.7rem #94A3B8 left, X-axis date labels 0.7rem below, rounded top corners on bars.

Loan status card (white, radius 12px, padding 20px, margin 12px 16px 0):
Title "Loan Status" 1rem 700
Donut chart (160px): Active segment amber #F5A623 65%, Overdue segment #E74C3C 20%, Closed segment #E0F2FE 15%, center text "142 Loans" 1rem 700 #1E293B
Legend below (3 rows, flex): colored 10px circle + label 0.82rem + count 0.82rem 700 right

Agent performance card (white, radius 12px, padding 20px, margin 12px 16px 0):
Title "Agent Performance" 1rem 700
Horizontal bar list (4 agents): agent name 0.82rem left, horizontal bar fills to % (amber fill, background #F4F6F9, height 8px, radius 4px), percentage 0.78rem #64748B right

---

### Screen 9 — Notifications Screen

Design a mobile notifications screen for LoanTrack. Font: Inter. Background: #F4F6F9.

App bar (white, border-bottom 1px #E2E8F0, height 64px, padding 0 16px):
- Back arrow left (color #1E293B)
- "Notifications" 1.15rem 700 center
- "Mark all read" text button right (color #E8930C, 0.82rem)

Content (scrollable):

Group header "TODAY" (padding 12px 16px 6px, font 0.72rem 600 #94A3B8, letter-spacing 1px, uppercase)

Notification tile (white card, border-radius 10px, margin 4px 16px, padding 12px, flex row, gap 10px):
- Left: 40px circle icon container (background varies: #FEE2E2 for overdue, #DCFCE7 for paid, #FFF3E0 for pending), icon inside 18px matching color (#E74C3C / #27AE60 / #E8930C)
- Center: title "Overdue Instalment" 0.85rem 600 #1E293B, body "Rajan Kumar — LN-20260042 · ₹850 due" 0.78rem #64748B 2 lines max, timestamp "2h ago" 0.7rem #94A3B8 below
- Right: 8px circle dot #2980B9 if unread (nothing if read)

Show 2 unread tiles (with blue dot), then group header "YESTERDAY", then 3 read tiles (no dot, body text slightly lighter).

Empty state (when no notifications, full-screen centered):
Bell icon 56px #94A3B8, "All caught up!" 1.1rem 600 #1E293B margin-top 16px, "You have no new notifications" 0.85rem #64748B below.

---

### Screen 10 — Customer Detail Screen

Design a mobile customer profile screen for LoanTrack showing full customer detail. Font: Inter.

Header (background linear-gradient(135deg, #1A1D23, #2D1F0E), padding 32px 20px 24px, safe-area-top):
- Back arrow white top-left, 3-dot menu white top-right
- 72px circle avatar centered, background #F5A623, white initials "RK" 1.6rem 700
- "Rajan Kumar" 1.3rem 700 white centered, margin-top 10px
- "CUS-0042" 0.8rem rgba(255,255,255,0.60) monospace centered below
- Row (centered, gap 8px): small amber ring chart (48px, arc #27AE60, center "78" 0.82rem 700 white) + "Credit Score: 78/100" 0.78rem rgba(255,255,255,0.80)
- Status badge "active" centered (background #DCFCE7, text #166534) below

Tab bar (white bg, border-bottom 1px #E2E8F0, padding 4px 16px): "Overview" (active: text #E8930C, border-bottom 2px #F5A623) | "Loans" | "KYC Docs" (inactive: text #64748B)

Overview tab content (scrollable, background #F4F6F9, padding 16px):
Info card (white, radius 12px, padding 16px):
- Section label "CONTACT" 0.7rem 600 #94A3B8 uppercase, letter-spacing 1px
- Row: phone icon #64748B + "+91 98765 43210" 0.85rem #1E293B, call-button icon right in amber
- Row: location icon + "12, Gandhi St, Chennai 600001" 0.85rem #1E293B
- Divider #E2E8F0
- Section label "ASSIGNMENT"
- Row: "Route" label #64748B + route chip "Route A" (background #FFF3E0, text #E8930C, radius 6px, padding 3px 10px)
- Row: "Agent" label #64748B + "Karthik Kumar" 0.85rem #1E293B

Active loans summary card (white, radius 12px, padding 16px, margin-top 12px, flex row space-between, align-items center):
- Left: "2 Active Loans" 0.9rem 700 #1E293B, "₹1,25,000 outstanding" 0.78rem #E74C3C below
- Right: chevron icon #E2E8F0

Bottom action bar (white, border-top 1px #E2E8F0, shadow-lg above, padding 16px, flex row, gap 12px):
- "Suspend" button (flex 1, border 1px #E74C3C, text #E74C3C, background white, radius 8px, height 46px)
- "Edit Profile" primary button (flex 2, background #F5A623, text white, radius 8px, height 46px)
EOF
echo "Done — $(wc -l < /mnt/user-data/outputs/DESIGN.md) lines written"
Output

Done — 525 lines written
