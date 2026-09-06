# Audit 04 — Language Completeness (Every User-Visible Word, 6 Languages)

> Status: **NOT IMPLEMENTED** (audit only). Audited 2026-07-17 @ `52add51`. Languages: en, ta, hi, te, kn, ml on both platforms.

## Architecture (as built today)

- **Web:** dictionaries `i18n/{en,ta,hi,te,kn,ml}.ts` loaded by `lib/i18n.ts#getDictionary(tenantId)`; language is a **per-tenant** AppSetting (`language`, default `en`). Missing keys render `undefined` (no per-key fallback) — so key gaps are user-visible bugs, not silent English.
- **Mobile:** flat map `mobile/lib/core/l10n/app_strings.dart` (`'group.key' → {en,ta,hi,te,kn,ml}`), accessor `T.of(ref).x('key')` with per-key fallback English → key. Language is **per-device** (Hive `app_language` via `LanguageController`), never synced with the tenant setting — web and mobile can disagree.

## Findings A — dictionary key gaps

**Web (leaf string entries, en = 1777 baseline):**

| Lang | Keys | Missing vs en |
|---|---|---|
| en | 1777 | — |
| ta | 1777 | 0 ✅ |
| hi | 1777 | 0 ✅ |
| te | 1657 | **~133** (also structurally missing the `trialBalance` section) |
| kn | 1626 | **~153** |
| ml | 1626 | **~153** |

Missing keys concentrate in later-added sections (`title`, `cancel`, `amount`, `pending`, `dueDate`, `paid`, `status`, `edit`, …).

**Mobile (`kStrings`, 886 key-blocks):**

| Lang | Missing | Dominated by |
|---|---|---|
| en | 0 | — |
| ta | **10** | product-finance keys (`lt.product`, `fld.product_*`) |
| hi / te / kn / ml | **38 each** | same product-finance block |

## Findings B — surfaces that bypass i18n entirely (hard-coded English)

**Web chit module** (`dict` imported but ~unused):

| File | Hard-coded user-visible literals | dict refs |
|---|---|---|
| `chits/[id]/auctions/[auctionId]/AuctionDetailClient.tsx` | ~57 + 2 attrs | 1 (import only) |
| `chits/[id]/ChitGroupDetailClient.tsx` | ~54 + 2 attrs | 1 |
| `chits/new/ChitGroupForm.tsx` | ~54 + 10 attrs (placeholders) | 1 |
| `components/chits/PaymentIntentsQueue.tsx` | ~8 | 0 |
| `components/chits/DividendBreakdown.tsx` | ~2 | 0 |
| `chits/[id]/edit/ChitGroupEditForm.tsx` | ~1 | 1 |

(Only `chits/page.tsx` genuinely uses the dictionary — 18 refs.)

**Web borrower portal** (~zero dict usage): `BorrowerDashboardClient.tsx` ~22 literals, `login/page.tsx` ~13, `chits/page.tsx` ~11, `chits/PaymentProofButton.tsx` ~7, `dashboard/ChitOnlyPanel.tsx` ~5. Borrower pages never call `getDictionary` at all.

**Mobile chit screens:**

| File | `T.x()` calls | Raw `Text('…')` literals |
|---|---|---|
| `chits_screen.dart` | 36 ✅ | 1 |
| `chit_detail_screen.dart` | 1 | **~56** |
| `chit_live_auction_screen.dart` | 0 | **~59** |
| `chit_form_screen.dart` | 2 | ~26 |
| `dividend_breakdown.dart` | 0 | ~12 |

**Mobile borrower screens — zero `T.x()` across all five:** `borrower_chit_live_screen` ~28, `borrower_dashboard_screen` ~19, `borrower_chit_contributions_screen` ~14, `borrower_login_screen` ~5, `borrower_pay_screen` ~4.

Examples of raw strings: "Record Payment", "Open bidding room", "Declare $name as the winner and settle this period?", "Confirm Your Bid", "Pending review", "I've paid — upload proof", "You're all caught up."

## Fix plan

### Part A — Web
1. **Fill te/kn/ml gaps** in `i18n/{te,kn,ml}.ts` (+ te `trialBalance` section) — translate from the en baseline, reusing each file's established terminology. Target: key-diff = 0 for all 6.
2. **New key groups** in `i18n/en.ts` → translate ×5:
   - `chits.auction.*` (auction detail: bells, timeline, attendance, security, summary, copy/print),
   - `chits.detail.*` (config/compliance/members/payments/reschedule),
   - `chits.form.*` (all create/edit labels + placeholders + option descriptions),
   - `chits.paymentsQueue.*`, `chits.dividend.*`,
   - `borrower.*` (dashboard tabs, login, pay, chits page, proof dialog).
3. **Wire components:** borrower pages call `getDictionary(tenantId)` server-side and pass `dict` down (pattern already used by `ChitGroupDetailClient`); replace every literal in the 6 chit + 5 borrower files.
4. **Currency:** replace `₹` with tenant `currency_symbol` in the same touched files + `lib/chits/winnerSummary.ts`, `lib/notify/events.ts`, `lib/sms.ts` (doc 02 §D).

### Part B — Mobile
1. **Fill key gaps:** +38 hi/te/kn/ml, +10 ta (product-finance block) in `app_strings.dart`.
2. **New keys** for: `chit_detail_screen` (~56), `chit_live_auction_screen` (~59), `chit_form_screen` (~26), `dividend_breakdown` (~12), all 5 borrower screens (~70) — every key in all 6 languages; convert raw `Text('…')` → `t.x('key')` following `chits_screen.dart`'s pattern.
3. **Currency:** replace literal `₹` in chit/borrower screens with `currencyFmtProvider` output.
4. **Language-source alignment:** on login, if the device has never chosen a language, seed `LanguageController` from the tenant `language` setting (available via the existing theme/settings fetch); explicit device choice always wins thereafter.

### Tooling (write once, keep)
- `scripts/i18n-diff.ts` — compares key sets: web (recursive leaf keys per language file vs en) and mobile (per-language presence in each `kStrings` block); exits non-zero listing missing keys. Add `npm run i18n:check`. This is the "every word has all 6 languages" gate going forward.

## Verification
- `npm run i18n:check` → 0 missing keys, both platforms.
- Set a test tenant `language='ta'` → web chit auction detail, group detail, form, payments queue, borrower portal all render Tamil (spot-check ~10 strings per page).
- Device set to Tamil → mobile chit detail/live/form + all borrower screens render Tamil.
- Fresh install + staff login on an `hi` tenant → app comes up in Hindi without manual selection.
- Grep gate: `grep -rn "Text('" mobile/lib/features/{chits,borrower}` and JSX literal sweep on the 11 web files → only non-user-visible strings remain (keys, codes, interpolations).
