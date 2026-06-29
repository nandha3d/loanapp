# Gold Loan — Competitor Comparison & Gap Analysis

Source: competitor PDF (20 pages) — **2Dot Loan Manager / N-GOLD LOAN** (primary) and
**Rajapalayam MKR Finance / PawnSoftware** (secondary). Maps every competitor screen → what we HAVE vs NEED.

---

## 0. The core architectural gap (read first)

Competitor = **interest-only pledge / pawn-broking** model:
- Loan = a **pledge** of gold ornaments for a principal.
- **Monthly interest** (e.g. 2%/month) accrues; customer pays **interest cycles** (not EMIs).
- **Part payments** reduce principal; **closure/redemption** = outstanding principal + due interest.
- Extras: **bank repledge**, **take-over/renewal**, **notices** (warning/auction), **audit** (deleted/modified/restored).

Ours = **EMI / instalment** model (daily/weekly/monthly instalments, oldest-first allocation).

➡️ **A full gold system needs the pledge/interest engine — our instalment engine does not fit gold.** This is the
biggest build item. It is **additive** (new repayment mode for `appType=goldloan`), must NOT change the existing
instalment engine used by micro/auto.

---

## 1. Feature/screen matrix — HAVE vs NEED

Legend: ✅ have · 🟡 partial · ❌ need.

### A. Loan / Pledge creation
| Competitor element (screen) | Ours | Status |
|---|---|---|
| Loan No auto (A0048), Category GOLD/SILVER, Interest %/month, Date+Time | loan code + appType | 🟡 (no silver, no per-month interest) |
| Inline new-customer create in loan entry (name, S/O·W/O·D/O·H/O·C/O, address+place, gender, proof type, photo) | customer create (separate) | 🟡 |
| Proof types: Aadhaar/Smart/DL/Voter/Passport/Bank Passbook/PAN/Others | KYC fields | 🟡 (not a typed list from master) |
| **Multi-ornament line items**: Ornament type, Specification, Qty, **Gross wt, Wastage, Net wt, Rate/gram, Value(auto)** | single JSON blob (grams/carat/items) | ❌ |
| Bank (SELF LOCKER…) + New Bank, Ref No per item | — | ❌ |
| Customer photo + Ornament photos + Proof document upload | gold photo/doc fields exist (unused) | 🟡 |
| Payment mode CASH/UPI/BOTH | cash/upi/bank | 🟡 |
| Interest scheme (months) | — | ❌ |
| Loan Amount, **Processing fee (−)**, Amount given (rounded), Interest preview | principal/deduction exists | 🟡 |
| Preview Bill | PDF statement | 🟡 |

### B. Pledge servicing (interest model)
| Competitor | Ours | Status |
|---|---|---|
| **Pending Interests & EMIs** (All/Overdue/Ageing, totals, Excel/PDF) | instalment list | ❌ (different model) |
| **Pay Interest** modal (amount, paid on, mode, **paid by third person** name/mobile) | collection entry | ❌ |
| **Interest Payment Receipt** (principal, outstanding, rate/month, monthly interest, months+days due, next due) | receipt PDF | ❌ |
| **Part Payment** (reduce principal) + history + total | — | ❌ |
| **Close Loan / redemption** (amount to be paid) | foreclosure exists | 🟡 |
| **Take Over Loan**, **Renewal** (renewal difference) | renewal exists | 🟡 |
| **Bank Repledge** (bank, date, ref, amount by bank, interest, fee, staff) | — | ❌ |
| Paid Interests table, Pending Interests with Bulk Pay | — | ❌ |

### C. Reports (gold-specific)
| Competitor | Ours | Status |
|---|---|---|
| Recent Pledges (search by mobile) | loans list | 🟡 |
| Pending Interests report | — | ❌ |
| Pledge Reports / Closed Pledges / Paid Interests | reports | 🟡 |
| Notice Reports (warning/auction) | — | ❌ |
| **Audit Reports** — Deleted / Modified / Restored | audit log exists | 🟡 (no UI tabs) |
| **Bank Report** (by bank, bank-wise ornament gross/net wt) | — | ❌ |
| **Ornaments Report** (category, qty, gross/wastage/net wt, current value) | — | ❌ |
| **Daily Summary Report** (outgoing: issued/interest/fees; collection: part/interest/closing/total) | reports | 🟡 |
| Accounts: Ledger, Transaction, Day Book, Day Entry | premium accounting | 🟡 (web only) |

### D. Dashboard (gold)
| Competitor | Ours | Status |
|---|---|---|
| No. of loans (gold/silver), store rate gold/silver | dashboard KPIs | 🟡 |
| Total loan amt, interest paid, expenses, closing amt, part payments, **profit**, cash balance, pending interest | KPIs | 🟡 |
| Active/Closed ornament weight (gross/net) | — | ❌ |
| Bank-wise ornaments, expenses chart, today's daily summary | — | ❌ |

### E. Master data & settings
| Competitor | Ours | Status |
|---|---|---|
| **Master: Ornament Types, Ornament Specifications, Bank Names** | — | ❌ (these are the no-hardcode source for dropdowns) |
| Settings → Rates & Interest (gold/silver rate/g, interest %, scheme months, processing fee + rules, **auto rate per gm karat-based**) | AppSetting (partial) | 🟡 |
| Settings → Shop Details (name, contact, license, address, logo size, T&C per receipt type) | branding settings | 🟡 |
| Settings → Billing & Language (bill prefix, ornament/invoice language, **Tanglish keyboard**, remarks toggle) | i18n + settings | 🟡 |
| Settings → Security (admin/staff passwords, **staff users + per-user permissions**: modify/delete/dashboard/reports/closing) | RBAC | 🟡 |
| Settings → Data & Backup | backup export exists | 🟡 |

### F. Expenses
| Competitor | Ours | Status |
|---|---|---|
| Expense Entry (voucher, date, type, amount, multi-row) + Today's Expenses | expense tracking | 🟡 |
| Expense Reports | reports | 🟡 |

### G. Receipts (printable, Tamil + English)
| Competitor | Ours | Status |
|---|---|---|
| Jewel Loan Receipt (customer + office copy, photos, ornament table, amount given, next due, T&C) | loan receipt PDF | 🟡 (not gold-shaped) |
| Loan Closing Receipt, Part Payment Receipt, Interest Bill Receipt | receipts | ❌ (gold-specific) |
| Customer Payment History Report (printable) | — | 🟡 |

### H. Customer
| Competitor | Ours | Status |
|---|---|---|
| Customer details + loans taken + total loan + total net weight (active) | customer profile | 🟡 |
| Payment History (all loans / specific loan, transactions) | — | 🟡 |

---

## 2. What we already have (reuse, don't rebuild)
- Customer mgmt + KYC + photos, GPS (lat/lng), multi-tenant + appScope, RBAC, audit log, branches, expenses,
  notifications, reports framework, PDF receipts, accounting (web), `GoldLoanCollateral` model, `lib/gold/valuation.ts`.

## 3. What we NEED (build, in priority order)
1. **Pledge/interest repayment engine** for `goldloan` (monthly interest accrual, pay-interest cycles, part-payment,
   redemption, take-over/renewal) — additive new mode; does NOT touch the instalment engine. *(biggest)*
2. **Multi-ornament line items** persisted to a new `GoldOrnamentItem` child of `GoldLoanCollateral`
   (type, spec, qty, gross/wastage/net wt, rate/gram, value, bank, ref) — gated migration.
3. **Master data**: Ornament Types, Ornament Specifications, Bank Names — DB tables + admin CRUD (the no-hardcode
   source for all dropdowns).
4. **Pledge servicing UI**: pay-interest, part-payment, close/redeem, bank repledge, take-over/renewal — web + mobile.
5. **Gold reports**: pending interests, recent/closed pledges, paid interests, bank report, ornaments report,
   daily summary, notices, audit (deleted/modified/restored tabs).
6. **Gold dashboard**: ornament weights, bank-wise, profit, cash balance, store rate, pending interest.
7. **Receipts** (gold-shaped, EN + TA from templates): loan, closing, part-payment, interest bill.
8. **Settings**: rates & interest (auto karat rate), shop/T&C per receipt, billing & language, staff permissions.
9. **Silver** support alongside gold (Category GOLD/SILVER) — rate/interest per metal from settings.

## 4. Mobile scope (per user: NO accounting on mobile)
Pledge create (ornament line items, photos, GPS), pay-interest, part-payment, close/redeem, pledge list/detail,
gold reports summary, receipts view. **Exclude**: ledger/day-book/day-entry/transaction accounting.

## 5. Strict rules carried over (from GOLD-BUILD-SPEC.md)
No hardcoding — ornament types/specs/banks/rates/interest/proof-types all from **master tables / AppSetting via the
API layer**. Additive only; the pledge engine is a new mode gated to `goldloan`, never altering the instalment
engine. Every string in 6 languages. Our theme (gold/amber palette). No mobile accounting.

## 6. Theme note
Build in OUR gold theme (`APP_CONFIGS.goldloan`: amber/gold), our component library — same *capabilities* as the
competitor, our look. Not a visual clone.
