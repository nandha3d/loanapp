# H — Accounting Premium Suite (mobile)

**Priority:** P2 (large — phase it). **Persona:** Accountant/Admin.
**Status:** mobile has a single `accounting_screen.dart` summary only; web has 13 sub-pages.

## Guardrails
- **All figures from API.** Mobile renders; never sums ledgers or computes P&L in Dart (🔢). Web computes these in server code/actions — those must be exposed as Bearer `/api/v1/accounting/**` endpoints.
- i18n: all `pa.*` keys already exist in 6 languages (done). Use them.
- Web source dir: `app/(dashboard)/[module]/accounting/premium/**` — each sub-page + its `actions.ts` is the spec of record. Read the action to learn the exact computation, then expose it as a v1 endpoint returning the **already-computed** result.

## Existing API
- `app/api/v1/accounting/route.ts` (summary), `app/api/v1/accounting/statements/route.ts`. Everything else below is **new**.

## Sub-stories (each = new endpoint + screen)

| ID | Web page | New endpoint(s) | Screen | Notes |
|---|---|---|---|---|
| H1 | `premium/` dashboard | `GET /v1/accounting/premium/dashboard` | `accounting/premium/dashboard_screen.dart` | net profit, assets, liabilities, cash, pending bills, recent JEs |
| H2 | `premium/coa` | `GET/POST/PATCH /v1/accounting/coa` | `coa_screen.dart` | list+add/edit account, classes, activate/deactivate |
| H3 | `premium/journal`(+new,+[id]) | `GET/POST /v1/accounting/journal`, `POST /v1/accounting/journal/[id]/{post,reverse,approve,reject}` | `journal_list_screen.dart`, `journal_new_screen.dart`, `journal_detail_screen.dart` | multi-line balanced entry; status lifecycle; audit trail |
| H4 | `pnl`,`balance-sheet`,`trial-balance`,`cashflow` | `GET /v1/accounting/{pnl,balance-sheet,trial-balance,cashflow}?period=` | one `statements_screen.dart` w/ tabs | period filter; server computes |
| H5 | `bank-rec`(+[bankAccountId]) | `GET /v1/accounting/bank-rec`, import + match endpoints | `bank_rec_screen.dart` | import statement, match/unmatch, create JE |
| H6 | `budget` | `GET/POST /v1/accounting/budget` | `budget_screen.dart` | variance vs actual (actual from API) |
| H7 | `tax` | `GET /v1/accounting/tax?type=gstr3b|gstr1|tds`, `POST mark-filed`, `POST challan` | `tax_screen.dart` | GST/TDS |
| H8 | `vendors` | `GET/POST /v1/accounting/vendors`, bill `post/pay/cancel` | `vendors_screen.dart` | AP lifecycle |
| H9 | `period-lock`,`export`,`approvals` | `GET/POST /v1/accounting/{period-lock,export,approvals}` | respective screens | period close transfers net profit; export Tally/Excel/JSON |

## Build order (phased PRs)
1. H1 dashboard (read-only) → proves the endpoint+screen pattern.
2. H2 COA → H3 journal (write path) → H4 statements.
3. H5 bank-rec → H7 tax → H8 vendors → H6 budget.
4. H9 period-lock + export + approvals.

## Per-sub-story acceptance criteria (template)
- [ ] Endpoint returns the **same numbers** the web page shows for the same tenant/period (diff-tested).
- [ ] No computation in Dart.
- [ ] `pa.*` i18n used; screen has loading/empty/error states.
- [ ] Write actions (journal post, bill pay, period close) call server which performs the mutation + audit.

## Files touched (per sub-story)
- NEW `app/api/v1/accounting/**` route(s) (logic copied from the matching web `actions.ts`).
- NEW `mobile/lib/features/accounting/premium/<screen>.dart` + models + service methods + routes.
- Reuse existing `pa.*` i18n.

> Because H is large, treat each row as its **own** PR with its **own** acceptance test against the web page. Do not batch.
