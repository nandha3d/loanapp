# Mobile Client-Side Calculations & Business Logic Audit (Micro Lending)

**Scope:** `mobile/lib/**` (Flutter) vs Web (`app/(dashboard)/[module]/**`) & Backend (`app/api/v1/**`, `lib/**`) for `appType === 'microlending'`.  
**Generated:** 2026-10-01  
**Reference:** `ENGINEERING_REFERENCE.md` (§0–§5, §10, §16.0), `PARITY-ML-web-mobile-fix-plan.md`.

---

## Executive Summary

In multiple critical paths of the Micro Lending vertical, the Flutter mobile app computes business metrics, repayment waterfalls, delinquency states, and aggregations **locally on the device** instead of consuming canonical, authoritative values computed by the server API.

This architectural antipattern leads to:
1. **Divergent Financial Values:** Different numbers displayed on Web vs Mobile for the exact same loan, customer, or collection run (e.g. ₹7,000 payoff on Web vs ₹9,000 on Mobile; customer outstanding ignoring collections).
2. **Device Timezone & Clock Skew:** Instalments flipping between `due_today`, `missed`, and `upcoming` based on the phone's physical clock (`DateTime.now()`) rather than the server's business cutoff in Indian Standard Time (IST).
3. **Data Loss / Multi-Call Concurrency:** Distributing payments across instalments or penalties in client-side loops rather than a single atomic backend database transaction.
4. **Fabricated Analytics & Fallbacks:** Charts synthesizing trends with hardcoded weights, fake fallback constants, or subtracting loans from total customers.

The comprehensive catalog below documents every identified client-side calculation across all Micro Lending submodules.

---

## 1. Loan Detail, Repayment & Foreclosure Settlement

### 1.1 Preclosure Payoff Amount & Payoff Minimum Validation
* **Mobile Location:** [`mobile/lib/features/loans/loan_detail_screen.dart:2645-2647`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/loans/loan_detail_screen.dart#L2645-L2647), [`lines 2732-2733, 2767-2769`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/loans/loan_detail_screen.dart#L2732-L2769)
* **What Mobile Calculates Locally:**
  ```dart
  final totalCollected = loan.totalCollected;
  final totalRepayable = loan.totalPayable;
  final outstanding = totalRepayable - totalCollected;
  ...
  final amountController = TextEditingController(text: outstanding.toStringAsFixed(2));
  ...
  if (parsed < outstanding) {
    return 'Must be at least the outstanding: ${fmt.format(outstanding)}';
  }
  ```
  Mobile treats preclosure as paying off the entire scheduled contract amount (contractual principal + all future unearned interest).
* **Authoritative Server / Web Calculation:**
  Web Admin calls `GET /api/loans/[id]/foreclosure-calc` &rarr; [`lib/foreclosure.ts:121-140`](file:///v:/pers/Freelance/loanapp/lib/foreclosure.ts#L121-L140) (`buildForeclosureCalculation`):
  $$\text{Principal Outstanding} = \max(0, \text{Original Principal} - \text{Total Collected})$$
  $$\text{Payoff Quote} = \text{Principal Outstanding} + \text{Net Penalties Due} - \text{Discount}$$
* **Divergence & Business Impact:**
  On a ₹10,000 loan with ₹2,000 interest and ₹3,000 collected, Web quotes **₹7,000** (early principal rebate). Mobile quotes **₹9,000** and validator actively prevents the agent from submitting any amount less than ₹9,000.
* **Remediation Task:** **LD-05 (Question Q1)** in `PARITY-ML-web-mobile-fix-plan.md`. Expose `precloseQuote` on `GET /api/v1/loans/[id]`.

---

### 1.2 Client-Side Dynamic Overdue Calculation Engine
* **Mobile Location:** [`mobile/lib/features/loans/loan_detail_screen.dart:913-964`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/loans/loan_detail_screen.dart#L913-L964)
* **What Mobile Calculates Locally:**
  When `loan.metrics` is absent or null, Flutter executes a 50-line custom overdue calculation:
  ```dart
  final payable = loan.instalments.where((i) => i.status != 'waived').toList();
  // Iterates past dues, computes cToday vs cPrior, distributes across pastDueInsts,
  // offsets excess collections from today, clamps against outstanding.
  ```
* **Authoritative Server / Web Calculation:**
  Backend calculation is [`calculateDynamicOverdueAmount`](file:///v:/pers/Freelance/loanapp/lib/repayments.ts#L156-212) (`lib/repayments.ts`), executed using database dates and normalized transaction histories.
* **Divergence & Business Impact:**
  The Dart engine uses `DateTime.now()` on the client device. Any phone timezone difference shifts "today" boundaries, producing overdue amount mismatches against the ledger and cash book.
* **Remediation Task:** **LD-01 & LD-03**. Server `GET /api/v1/loans/[id]` provides `metrics.overdueAmount`; delete client fallback.

---

### 1.3 Instalment Waterfall Cash Re-Distribution
* **Mobile Location:** [`mobile/lib/features/loans/loan_detail_screen.dart:653-680`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/loans/loan_detail_screen.dart#L653-L680) (`_computeDisplayInstalments`)
* **What Mobile Calculates Locally:**
  ```dart
  double remaining = loan.instalments.fold(0.0, (sum, i) => sum + i.receivedAmount);
  for (var i = 0; i < dist.length; i++) {
    final due = dist[i].dueAmount;
    if (remaining >= due) {
      dist[i] = dist[i].copyWith(receivedAmount: due, status: 'paid');
      remaining -= due;
    } else if (remaining > 0) {
      dist[i] = dist[i].copyWith(receivedAmount: remaining, status: 'partial');
      remaining = 0;
    } else {
      dist[i] = dist[i].copyWith(receivedAmount: 0, status: ...);
    }
  }
  ```
* **Authoritative Server / Web Calculation:**
  Server-side repayment allocation in [`reallocateLoanRepayments`](file:///v:/pers/Freelance/loanapp/lib/repayments.ts#L32-L110) (`lib/repayments.ts`).
* **Divergence & Business Impact:**
  Wipes individual payment allocations from the database and replaces them with a synthetic linear fill. If a payment was collected on day 5 specifically, Dart may reallocate it to day 1, masking skipped payments or specific instalment receipts.
* **Remediation Task:** **LD-02 & LD-03** (Resolved — DEC-03). Server exposes canonical `distributedInstalments` via `distributeScheduleView` (`lib/repayments.ts`) on `GET /api/v1/loans/[id]`. Mobile and Web bind directly to `loan.distributedInstalments`; all client-side cash redistribution loops removed.

---

### 1.4 Dynamic Instalment Status by Local Device Clock
* **Mobile Location:** [`mobile/lib/data/models/instalment.dart:73-94`](file:///v:/pers/Freelance/loanapp/mobile/lib/data/models/instalment.dart#L73-L94) (`Instalment.dynamicStatus`)
* **What Mobile Calculates Locally:**
  ```dart
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final due = DateTime(dueDate.year, dueDate.month, dueDate.day);
  if (due.isBefore(today)) return 'missed';
  if (due.isAtSameMomentAs(today)) return 'due_today';
  return 'upcoming';
  ```
* **Authoritative Server / Web Calculation:**
  Server uses business time in IST from [`lib/businessTime.ts`](file:///v:/pers/Freelance/loanapp/lib/businessTime.ts) (`startOfBusinessToday`, `startOfBusinessDayUtc`).
* **Divergence & Business Impact:**
  If the phone clock is UTC or set incorrectly, instalments flip to `missed` hours before the IST business day closes, or stay `upcoming` when they are already overdue.
* **Remediation Task:** **TIM-06**. Server sends normalized status; mobile parses server timestamps and converts via `.toLocal()`.

---

### 1.5 Paid Periods & Remaining Dues Estimation
* **Mobile Location:** [`mobile/lib/features/loans/loan_detail_screen.dart:1318-1321`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/loans/loan_detail_screen.dart#L1318-L1321)
* **What Mobile Calculates Locally:**
  ```dart
  final dynamicRemainingCount =
      perInstalment > 0 ? (outstanding / perInstalment).ceil() : 0;
  final dynamicPaidCount = (loan.instalmentCount - dynamicRemainingCount)
      .clamp(0, loan.instalmentCount);
  ```
* **Authoritative Server / Web Calculation:**
  Computed authoritatively on the server taking into account waived rows, partial instalments, and loan extensions (`metrics.paidPeriod`, `metrics.remainingExtended`, `metrics.remainingActual`).
* **Divergence & Business Impact:**
  Loans with partial collections, penalties, or waived rows calculate fractional counts that misrepresent borrower progress (e.g. showing 24 days paid out of 30 when 26 have elapsed with minor deductions).
* **Remediation Task:** **LD-01 & LD-03**. Bind directly to `loan.metrics.paidPeriod` and `loan.metrics.remaining*`.

---

### 1.6 Progress Ring Completion Percentage
* **Mobile Location:** [`mobile/lib/features/loans/loan_detail_screen.dart:194-197`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/loans/loan_detail_screen.dart#L194-L197), [`lines 1241-1251`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/loans/loan_detail_screen.dart#L1241-L1251)
* **What Mobile Calculates Locally:**
  ```dart
  final paid = loan.instalments.where((i) => i.dynamicStatus == 'paid').length;
  final progress = loan.instalmentCount == 0 ? 0.0 : paid / loan.instalmentCount;
  ```
* **Authoritative Server / Web Calculation:**
  Progress must reflect `metrics.paidPeriod / totalInstalments` (including restructured/extended schedule terms).
* **Divergence & Business Impact:**
  Waived rows are not `dynamicStatus == 'paid'`, so a loan settled early with 5 waived rows displays only 83% complete on its circular progress ring despite being fully closed!
* **Remediation Task:** **LD-03**. Progress ring = `metrics.paidPeriod / totalInstalments`.

---

### 1.7 "Due Now" Calculation & Tenure Over Fallback
* **Mobile Location:** [`mobile/lib/features/loans/loan_detail_screen.dart:45-61`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/loans/loan_detail_screen.dart#L45-L61) (`_dueNowForLoan`)
* **What Mobile Calculates Locally:**
  ```dart
  final rawDue = loan.instalments.where((inst) {
    return !due.isAfter(todayStart) && inst.dynamicStatus != 'paid';
  }).fold<double>(0, (sum, inst) => sum + (inst.dueAmount - inst.receivedAmount));
  if (rawDue > 0) return rawDue;
  if (loan.status != 'closed' && totalOutstanding > 0) {
    return math.min(loan.perInstalment, totalOutstanding);
  }
  ```
* **Authoritative Server / Web Calculation:**
  Server returns `dueNow` and `overdueAmount` in `loan.metrics`.
* **Divergence & Business Impact:**
  Client fabricates a `perInstalment` due when no actual instalment is due today, confusing agents in the field about whether an instalment is scheduled today.
* **Remediation Task:** **LD-01 & LD-03**.

---

### 1.8 Loan Restructure Model Key Mismatch Fallback
* **Mobile Location:** [`mobile/lib/data/models/loan.dart:141-160`](file:///v:/pers/Freelance/loanapp/mobile/lib/data/models/loan.dart#L141-L160) (`LoanRestructure.fromJson`)
* **What Mobile Calculates Locally:**
  Dart model expects keys:
  `restructuredRate, arrears, futureInstalmentsCount, isApplicable`
  While server `GET /api/v1/loans/[id]` sends:
  `restructuredRate, outstanding, remainingPeriods, available`
* **Divergence & Business Impact:**
  `arrears` and `futureInstalmentsCount` parse as `0` and `false`. Restructuring terms, finishing rates, and actual remaining periods fail to render, falling back to client guesses.
* **Remediation Task:** **LD-03**. Update `LoanRestructure.fromJson` key mapping.

---

## 2. Collection Screen & Field Operations

### 2.1 Collection Summary & KPI Foldings
* **Mobile Location:** [`mobile/lib/features/collection/collection_screen.dart:499-512`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/collection/collection_screen.dart#L499-L512)
* **What Mobile Calculates Locally:**
  ```dart
  final totalDue = todaysRows.fold<double>(0, (s, r) => s + r.dueAmount);
  final totalCollected = todaysRows.fold<double>(0, (s, r) => s + math.min(r.receivedAmount, r.dueAmount));
  final pendingCount = todaysRows.where((r) => !r.isResolved).length;
  final overdueOutstanding = overdueRows.fold<double>(0, (s, r) => s + r.overdueOutstanding);
  final overdueCount = overdueRows.where((r) => !r.isResolved).length;
  ```
* **Authoritative Server / Web Calculation:**
  Web reads `/collection/dashboard` which returns authoritative aggregates `collectionSummary` and `collectionSummaryByRoute`.
* **Divergence & Business Impact:**
  Client folds only the loaded subset of rows (often truncated at 1,000 rows), missing out-of-scope branch items, resulting in summary tiles that differ from the manager's dashboard.
* **Remediation Task:** **COL-01**. Mobile reads `/collection/dashboard` and renders server summary headers.

---

### 2.2 Invented "Due Today" Fallback
* **Mobile Location:** [`mobile/lib/features/collection/collection_screen.dart:1793-1802`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/collection/collection_screen.dart#L1793-L1802) (`CustomerGroup.todayDue`)
* **What Mobile Calculates Locally:**
  ```dart
  double get todayDue {
    final sum = _todayCollectible.fold(0.0, (s, r) => s + r.outstanding);
    if (sum > 0) return sum;
    if (_overdueCollectible.isNotEmpty) {
      final per = _overdueCollectible.first.dueAmount;
      return math.min(per, overdueDue);
    }
    return 0.0;
  }
  ```
* **Authoritative Server / Web Calculation:**
  Today's due is strictly instalments whose due date is the current business day.
* **Divergence & Business Impact:**
  If a customer has missed instalments but has no instalment due today, the mobile app artificially manufactures a "Due Today" value equal to one instalment, displaying false expectations to the collection agent.
* **Remediation Task:** **COL-02**. Drop invented `todayDue` fallback.

---

### 2.3 Local Device Overdue/Today Date Bucket Splitting
* **Mobile Location:** [`mobile/lib/data/models/collection_entry.dart:93-108`](file:///v:/pers/Freelance/loanapp/mobile/lib/data/models/collection_entry.dart#L93-L108)
* **What Mobile Calculates Locally:**
  ```dart
  int get daysOverdue {
    final today = DateTime.now();
    final due = DateTime(dueDate.year, dueDate.month, dueDate.day);
    final t = DateTime(today.year, today.month, today.day);
    return t.difference(due).inDays;
  }
  bool get isTodayBucket => daysOverdue <= 0;
  bool get isOverdueBucket => daysOverdue > 0;
  ```
* **Divergence & Business Impact:**
  `daysOverdue <= 0` groups future instalments (tomorrow, next week) into the "Today" bucket whenever future rows are fetched! Uses local device time rather than server business date.
* **Remediation Task:** **COL-01 & TIM-06**.

---

### 2.4 Run Sheet Multi-Instalment Waterfall Allocation
* **Mobile Location:** [`mobile/lib/features/collection/run_sheet_screen.dart:45-48, 90-100`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/collection/run_sheet_screen.dart#L45-L48)
* **What Mobile Calculates Locally:**
  ```dart
  // Client auto-splits lump sum across instalments:
  List<RunSheetRow> get oldestFirst =>
      [...rows]..sort((a, b) => b.daysOverdue.compareTo(a.daysOverdue));
  ...
  for (final r in g.oldestFirst) {
    if (remaining <= 0) break;
    final toPay = remaining < r.outstanding ? remaining : r.outstanding;
    lines.add({'instalmentId': r.instalmentId, 'receivedAmount': toPay, ...});
    remaining -= toPay;
  }
  ```
* **Authoritative Server / Web Calculation:**
  Rule **MONEY-10**: The loan-level allocation order is **today's due first**, then **oldest arrears first**, then future dues.
* **Divergence & Business Impact:**
  Mobile run sheet prioritizes oldest overdue and starves today's due. If borrower pays today's instalment, mobile posts it to 30-day overdue instalment, keeping today's instalment marked unpaid.
* **Remediation Task:** **RUN-01**. Match MONEY-10 server allocation order.

---

### 2.5 Client-Side Maximum Collection Cap
* **Mobile Location:** [`mobile/lib/features/collection/collection_screen.dart`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/collection/collection_screen.dart)
* **What Mobile Calculates Locally:**
  Mobile client validated that collection amount cannot exceed the single instalment due amount.
* **Authoritative Server / Web Calculation:**
  Backend collection engine allows collecting multiple instalments or advance payments in a single transaction.
* **Divergence & Business Impact:**
  Agents in the field cannot collect 2 or 3 instalments when a borrower wants to pay ahead, forcing multiple manual transactions or offline workarounds.
* **Remediation Task:** **MON-06**. Remove mobile client cap on collect amount.

---

## 3. Dashboard Analytics & Synthetic Cards

### 3.1 Fabricated Delinquency Ageing Tiers
* **Mobile Location:** [`mobile/lib/features/dashboard/widgets/overdue_aging_card.dart:18-36`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/dashboard/widgets/overdue_aging_card.dart#L18-L36)
* **What Mobile Calculates Locally:**
  ```dart
  final totalOverdue = summary.overdueOutstanding > 0 ? summary.overdueOutstanding : 70320.0;
  // Hardcoded percentages!
  final p0 = totalOverdue * 0.263; // 18,500 / 70,320
  final p1 = totalOverdue * 0.388; // 27,300 / 70,320
  final p2 = totalOverdue * 0.202; // 14,200 / 70,320
  final p3 = totalOverdue * 0.097; // 6,800 / 70,320
  final p4 = totalOverdue * 0.050; // 3,520 / 70,320
  ```
* **Authoritative Server / Web Calculation:**
  Web builds real ageing buckets via [`buildOverdueAgeing`](file:///v:/pers/Freelance/loanapp/lib/dashboard/overdueAgeing.ts) by querying real delinquent instalments.
* **Divergence & Business Impact:**
  Mobile displays **100% fabricated data** for portfolio aging! The numbers and counts are mathematical simulations with zero relation to the actual portfolio risk.
* **Remediation Task:** **DASH-05**. Expose server `overdueAgeing` on `GET /api/v1/dashboard`; delete synthetic generator.

---

### 3.2 Synthesized Disbursement Trends & Hardcoded Months
* **Mobile Location:** [`mobile/lib/features/dashboard/widgets/disbursement_trend_card.dart:33-60`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/dashboard/widgets/disbursement_trend_card.dart#L33-L60)
* **What Mobile Calculates Locally:**
  ```dart
  final baseDisbursed = widget.summary.totalDisbursed > 0 ? widget.summary.totalDisbursed : 1280000.0;
  // Hardcoded weights and month names:
  final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  final weights = [0.12, 0.18, 0.14, 0.22, 0.20, 0.14, 0.0];
  final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  final weights30 = [1.8, 2.4, 1.9, 3.2, 2.8, 2.1];
  ```
* **Authoritative Server / Web Calculation:**
  Web groups actual loan disbursement transactions by day/month from the general ledger / loan table.
* **Divergence & Business Impact:**
  Disbursement trends on mobile are entirely simulated. Month names are hardcoded in English regardless of the active locale or the actual calendar month.
* **Remediation Task:** **DASH-05**. Delete synthetic generator; consume server disbursement series.

---

### 3.3 Invented Completed Loans Count
* **Mobile Location:** [`mobile/lib/features/dashboard/widgets/interactive_portfolio_donut_card.dart:57`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/dashboard/widgets/interactive_portfolio_donut_card.dart#L57)
* **What Mobile Calculates Locally:**
  ```dart
  final active = s.activeLoans;
  final overdueLoan = s.overdueLoans;
  final completed = math.max(0, s.totalCustomers - (active + overdueLoan));
  final totalLoans = active + overdueLoan + completed;
  ```
* **Authoritative Server / Web Calculation:**
  Completed loans = `loans.count({ where: { status: 'closed' } })`.
* **Divergence & Business Impact:**
  Mobile subtracts loan counts from **total customers**! A tenant with 500 customers and 100 active loans will display 400 "completed loans" even if not a single loan has ever closed!
* **Remediation Task:** **DASH-05**. Add `portfolioHealth` to v1 payload.

---

### 3.4 Agent Dashboard Hit Rate & KPIs
* **Mobile Location:** [`mobile/lib/features/dashboard/dashboard_screen.dart`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/dashboard/dashboard_screen.dart)
* **What Mobile Calculates Locally:**
  Rounds hit rate on client (`summary.hitRate.round()`), calculates `pending = todayExpected - todayCollected`.
* **Remediation Task:** **DASH-11**. Agent dashboard unified with server metrics.

---

## 4. Customer Profiles & Credit Metrics

### 4.1 Customer Outstanding Balance Calculation
* **Mobile Location:** [`mobile/lib/features/customers/customer_detail_screen.dart:1148-1150`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/customers/customer_detail_screen.dart#L1148-L1150), [`mobile/lib/features/customers/widgets/customer_tile.dart:29-31`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/customers/widgets/customer_tile.dart#L29-L31)
* **What Mobile Calculates Locally:**
  ```dart
  final all = customer.loans;
  final active = all.where((l) => l.status == 'active').toList();
  final outstanding = active.fold<double>(0, (s, l) => s + l.principal);
  ```
* **Authoritative Server / Web Calculation:**
  [`calculateCreditScore(c.loans).stats.outstanding`](file:///v:/pers/Freelance/loanapp/lib/creditScore.ts):
  $$\text{Outstanding} = \sum_{\text{status} \in \{\text{active}, \text{overdue}\}} \max(0, \text{totalPayable} - \text{totalCollected})$$
* **Divergence & Business Impact:**
  1. It sums the **original principal** instead of remaining payable balance. If customer borrowed ₹1,00,000 and has paid ₹95,000, mobile displays "Outstanding: ₹1,00,000"!
  2. It excludes all loans with `status == 'overdue'`, meaning defaulting customers who owe money are shown with ₹0 outstanding!
* **Remediation Task:** **CUST-01 & CUST-04**. Expose `outstanding` in credit stats and consume on mobile.

---

### 4.2 Active Loan Count Definition
* **Mobile Location:** [`mobile/lib/features/customers/widgets/customer_tile.dart:29-30`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/customers/widgets/customer_tile.dart#L29-L30)
* **What Mobile Calculates Locally:**
  Filters `l.status == 'active'`, ignoring `overdue`.
* **Authoritative Server / Web Calculation:**
  Owner Decision **D7**: Active loans on customer cards are defined as non-closed collectible loans (`COLLECTIBLE_LOAN_STATUSES` = `active` or `overdue`).
* **Remediation Task:** **CUST-01**.

---

## 5. Penalties Management

### 5.1 Client-Side Penalty Settlement Waterfall Loop
* **Mobile Location:** [`mobile/lib/features/penalties/penalties_screen.dart:656-668`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/penalties/penalties_screen.dart#L656-L668) (`_settleGroup`)
* **What Mobile Calculates Locally:**
  ```dart
  var remaining = amount;
  for (final p in pend) {
    if (remaining <= 0) break;
    final pNet = p.grossPenalty - p.settledAmount - p.waivedAmount;
    if (pNet <= 0) continue;
    final pay = remaining < pNet ? remaining : pNet;
    await svc.settle(id: p.id, amount: pay); // Sequential HTTP mutations in a client loop!
    remaining -= pay;
  }
  ```
* **Authoritative Server / Web Calculation:**
  [`settlePenalty`](file:///v:/pers/Freelance/loanapp/lib/penalties.ts) (`lib/penalties.ts`) atomically settles penalties inside a single database transaction with audit logging and GL postings.
* **Divergence & Business Impact:**
  If network drops after 2 out of 5 HTTP calls, the loan is left in an inconsistent half-settled state. Furthermore, each call creates duplicate receipt logs.
* **Remediation Task:** **PEN-01**. Settle full loan penalties in a single server call.

---

### 5.2 Omission of "Partial" Penalty Status
* **Mobile Location:** [`mobile/lib/features/penalties/penalties_screen.dart:167, 356-373`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/penalties/penalties_screen.dart#L167)
* **What Mobile Calculates Locally:**
  Filters `['all', 'pending', 'settled', 'waived']`. Omits `'partial'`. If a penalty is partially paid, mobile treats it as unhandled or excludes it from open status chips.
* **Authoritative Server / Web Calculation:**
  Partially settled penalties are active open liabilities (`ACTIVE_PENALTY_STATUSES` = `pending | partial`).
* **Remediation Task:** **PEN-02**. Treat `partial` as open on mobile.

---

## 6. Loans Listing & Creation

### 6.1 In-Memory Closed Loan Filtering & Pagination
* **Mobile Location:** [`mobile/lib/features/loans/loans_screen.dart:82-88`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/loans/loans_screen.dart#L82-L88), [`loan_service.dart:23-55`](file:///v:/pers/Freelance/loanapp/mobile/lib/data/services/loan_service.dart#L23-L55)
* **What Mobile Calculates Locally:**
  Mobile pulls up to 50 pages (5,000 records) sequentially, then filters `l['status'] != 'closed'` in Dart memory.
* **Authoritative Server / Web Calculation:**
  Database filters via `hideClosed=1` (`status: { not: 'closed' }`).
* **Divergence & Business Impact:**
  Enormous network bandwidth waste, high latency on cold start, and battery drain on field agents' devices.
* **Remediation Task:** **LOAN-01 (Owner Decision D4)**. Pass `hideClosed=1` to server API.

---

### 6.2 Inaccurate Active Loan Counts
* **Mobile Location:** [`mobile/lib/features/loans/loans_screen.dart:95`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/loans/loans_screen.dart#L95)
* **What Mobile Calculates Locally:**
  ```dart
  activeCount: loans.length - closedCount
  ```
* **Authoritative Server / Web Calculation:**
  Count of loans with `status == 'active'`.
* **Divergence & Business Impact:**
  `loans.length - closedCount` includes `pending_review`, `rejected`, `overdue`, and `cancelled` loans, inflating the "Active loans" indicator in the app header.
* **Remediation Task:** **LOAN-01**. `status == 'active'`.

---

### 6.3 Weekly/Monthly Due Day Offsets
* **Mobile Location:** [`mobile/lib/features/loans/new_loan_screen.dart:645-652, 1527-1538`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/loans/new_loan_screen.dart#L645-L652)
* **What Mobile Calculates Locally:**
  Maps weekdays 1–7 (Monday=1, Sunday=7) and monthly 1–31.
* **Authoritative Server / Web Calculation:**
  Server schedule generator expects weekly 0–6 (Sunday=0) and monthly 1–28 (clamped for February).
* **Divergence & Business Impact:**
  Weekly schedules generated from mobile shift by one day or a full week; monthly schedules on the 31st crash or overflow into next month.
* **Remediation Task:** **MON-20**. Server & client unified on 0–6 weekly, 1–28 monthly.

---

## 7. Reports & Analytics

### 7.1 Truncated Client-Side Sorting
* **Mobile Location:** [`mobile/lib/features/reports/reports_screen.dart:30-36`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/reports/reports_screen.dart#L30-L36) (`_overdueProvider`)
* **What Mobile Calculates Locally:**
  ```dart
  final items = await ref.watch(reportsServiceProvider).fetchOverdueReport();
  final sorted = [...items]..sort((a, b) => b.outstanding.compareTo(a.outstanding));
  return sorted;
  ```
* **Authoritative Server / Web Calculation:**
  Server queries database sorted `orderBy: { overdueAmount: 'desc' }` with cursor pagination.
* **Divergence & Business Impact:**
  The server endpoint was returning only the first 50 unsorted rows. Sorting in Dart only sorted those 50 rows; borrowers with larger outstanding balances in rows 51–500 were completely omitted from the mobile report!
* **Remediation Task:** **RPT-02**. Add `orderBy` to server query and paginate on mobile.

---

### 7.2 Agent Performance Metrics Synthesis
* **Mobile Location:** [`mobile/lib/features/analytics/analytics_screen.dart:654-661`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/analytics/analytics_screen.dart#L654-L661)
* **What Mobile Calculates Locally:**
  Dart computes efficiency thresholds (`hitRate >= 90 ? success : warning`) and formats performance text locally without server performance context.
* **Authoritative Server / Web Calculation:**
  Server provides [`buildAgentPerformance`](file:///v:/pers/Freelance/loanapp/lib/reports/builders/agent-performance.ts).
* **Remediation Task:** **RPT-01**. Delegate to server catalog builder.

---

## 8. Currency Precision & Formatting

### 8.1 Truncation of Fractional Paise
* **Mobile Location:** [`mobile/lib/core/currency/currency_controller.dart:43`](file:///v:/pers/Freelance/loanapp/mobile/lib/core/currency/currency_controller.dart#L43)
* **What Mobile Calculates Locally:**
  ```dart
  return NumberFormat.currency(
    locale: lang.formatLocale,
    symbol: sym,
    decimalDigits: 0, // Strips all paise!
  );
  ```
* **Authoritative Server / Web Calculation:**
  Web formats financial figures with 2 decimal places (`paise`).
* **Divergence & Business Impact:**
  Amounts like ₹1,234.75 appear as ₹1,235 or ₹1,234 on mobile, causing end-of-day cash reconciliation discrepancies where collected cash doesn't match bank receipts.
* **Remediation Task:** **FMT-01 (Question Q3)**. Standardize decimal precision across both platforms.

---

## 9. Accounting & Float Workflows

### 9.1 Direct Instant Deposit vs Handover Reconciliation
* **Mobile Location:** [`mobile/lib/features/wallet/wallet_screen.dart:114-118`](file:///v:/pers/Freelance/loanapp/mobile/lib/features/wallet/wallet_screen.dart#L114-L118)
* **What Mobile Calculates Locally:**
  Agent "Deposit Cash" button triggers `walletServiceProvider.deposit(...)`, instantly updating the agent balance.
* **Authoritative Server / Web Workflow:**
  Rule **MON-01**: Field cash handovers must create a `pending` `CashHandover` record that a branch manager verifies and accepts before float is released.
* **Remediation Task:** **MON-01 & WAL-01**.

---

## Comprehensive Summary Table

| # | Domain | Mobile File & Lines | Local Calculation / Assumption | Server Canonical Source | Risk / Failure Mode |
|---|---|---|---|---|---|
| 1 | **Preclose Payoff** | `loan_detail_screen.dart:2645, 2733` | `totalPayable - totalCollected` | `lib/foreclosure.ts` (`buildForeclosureCalculation`) | Quotes ₹9,000 vs ₹7,000; blocks early settlement discount |
| 2 | **Dynamic Overdue** | `loan_detail_screen.dart:913-964` | 50-line Dart loop allocating past dues | `lib/repayments.ts` (`calculateDynamicOverdueAmount`) | Timezone skew, mismatched overdue numbers |
| 3 | **Instalment Waterfall** | `loan_detail_screen.dart:672` | ~~Linear client re-distribution~~ **Resolved**: server `distributedInstalments` | `lib/repayments.ts` (`distributeScheduleView`) | None (resolved; reads server-computed schedule) |
| 4 | **Instalment Status** | `instalment.dart:73-94` | `dueDate vs DateTime.now()` | `lib/businessTime.ts` (IST business day) | Instalments flip to missed prematurely |
| 5 | **Paid / Remaining** | `loan_detail_screen.dart:1318-1321` | `(outstanding / perInstalment).ceil()` | `loan.metrics.paidPeriod / remaining*` | Fractional/incorrect counts on waived or restructured loans |
| 6 | **Progress Ring** | `loan_detail_screen.dart:196, 1251` | `paid / totalInstalments` | `metrics.paidPeriod / totalInstalments` | Closed loans with waived rows never show 100% |
| 7 | **Due Now Fallback** | `loan_detail_screen.dart:55-60` | `math.min(perInstalment, totalOutstanding)` | `loan.metrics` | Invented dues when nothing is due today |
| 8 | **Loan Restructure** | `loan.dart:141-160` | Old keys `arrears, futureInstalmentsCount` | `outstanding, remainingPeriods, available` | Restructuring terms fail to render |
| 9 | **Collection Summary** | `collection_screen.dart:499-512` | Dart `.fold()` across filtered rows | `GET /collection/dashboard` (`collectionSummary`) | Missing route totals, inaccurate header figures |
| 10 | **Invented Today Due** | `collection_screen.dart:1793-1802` | `math.min(per, overdueDue)` fallback | Scheduled business day dues | Fabricates today dues for overdue-only loans |
| 11 | **Overdue Date Bucket** | `collection_entry.dart:93-108` | `daysOverdue <= 0` using local device clock | Server business day cutoff | Puts future instalments into "Today" bucket |
| 12 | **Run Sheet Allocator** | `run_sheet_screen.dart:45, 90-100` | Oldest overdue first sort | Rule MONEY-10 (Today first, then overdue) | Starves today's due; incorrect instalment allocation |
| 13 | **Collection Cap** | `collection_screen.dart` | Cap at single instalment due | Server multi-instalment policy | Blocks advance and multi-period payments |
| 14 | **Delinquency Ageing** | `overdue_aging_card.dart:18-36` | Fake percentages (26.3%, 38.8%) + 70320 | `lib/dashboard/overdueAgeing.ts` | 100% fabricated visual charts |
| 15 | **Disbursement Trends** | `disbursement_trend_card.dart:33-60`| Fake weights + hardcoded months | Real GL transaction history | Simulated charts unrelated to real volume |
| 16 | **Completed Loans** | `interactive_portfolio_donut_card.dart:57`| `totalCustomers - (active + overdue)` | `status == 'closed'` count | Subtracts loans from customers; completely bogus |
| 17 | **Customer Outstanding**| `customer_detail_screen.dart:1150` | `activeLoans.fold(principal)` | `calculateCreditScore().stats.outstanding` | Ignores collections; excludes overdue loans entirely |
| 18 | **Active Loan Count** | `customer_tile.dart:29` | `l.status == 'active'` only | Owner Decision D7 (`active + overdue`) | Omits overdue collectible loans |
| 19 | **Penalty Settlement** | `penalties_screen.dart:656-668` | Client loop firing multiple HTTP calls | `lib/penalties.ts` (`settlePenalty` in 1 tx) | Non-atomic partial failures, duplicate receipts |
| 20 | **Partial Penalties** | `penalties_screen.dart:167` | Filter excludes `'partial'` | `ACTIVE_PENALTY_STATUSES` | Partial penalties hidden or treated as closed |
| 21 | **Closed Loan Filter** | `loans_screen.dart:82-88` | Downloads 5,000 loans, filters in Dart | Server query `hideClosed=1` | Heavy bandwidth, slow load, battery drain |
| 22 | **Active Loans Header**| `loans_screen.dart:95` | `loans.length - closedCount` | `status == 'active'` count | Inflates count with pending & rejected loans |
| 23 | **Due Day Mapping** | `new_loan_screen.dart:645-652` | Weekly 1–7 (Mon=1, Sun=7) | Server weekly 0–6 (Sun=0) | Weekly schedules shift by one day or week |
| 24 | **Overdue Sorting** | `reports_screen.dart:30-36` | Client `.sort()` on pre-cut 50 rows | Server database `orderBy` | Hides largest delinquent borrowers past row 50 |
| 25 | **Paise Precision** | `currency_controller.dart:43` | `decimalDigits: 0` | 2 decimal places (paise) | Cash reconciliation mismatches against web |
| 26 | **Cash Deposit** | `wallet_screen.dart:114` | Direct instant balance increase | `CashHandover` approval queue | Skips manager verification and audit trail |
