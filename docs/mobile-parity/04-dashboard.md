# 04 · Dashboard

## Web scope (admin)
- Combined **Today's Collection** card (Expected / Collected / Remaining + progress) — collected = today's instalments only.
- **Overdue Collection** card (daily snapshot: Total till today / Collected today / Remaining; re-bases daily).
- Collection split by payment mode (all money today).
- KPI grid: active customers, overdue customers, overdue amount, penalties, approvals, capital, total disbursed, total collected.
- Collection trend (interactive range), route table, overdue alerts, pending UPI verifications, recent activity, best payer / highest borrower.
- Agent dashboard variant.

## Mobile current
- `/api/v1/dashboard` returns activeLoans, overdueLoans, totalCustomers, todayExpected, **todayCollected, todayGap, overdueOutstanding, overdueCollectedToday, overdueTotalTillToday** (added this cycle), pendingPenalties, activeAgents, recentLoans, todayInstalments.
- Mobile dashboard: hero + **swipable Today / Overdue cards** (added), money-flow tiles, alerts, quick actions, up-next pager, recent activity. ✅ Today/Overdue parity.

## Gaps
1. 🟡 Collection split by mode not shown on mobile.
2. 🟡 Collection trend chart (range filter) not on mobile.
3. 🟡 Pending UPI verifications / route table / best payer / highest borrower.
4. 🟡 Capital / total disbursed / total collected KPIs.

## API needed
- Extend `GET /api/v1/dashboard` with: `todayByMode` (cash/upi/online…), `trend` (last 30d expected/collected), `currentCapital`, `totalDisbursed`, `totalCollectedAllTime`, `pendingUpi[]`, `bestPayer`, `highestBorrower`, `routeCollections[]`. Mirror the web `getDashboardData` outputs (server-side; mobile reads only).

## Acceptance
- Mobile dashboard KPIs/cards match web numbers exactly (all from `/api/v1/dashboard`).
