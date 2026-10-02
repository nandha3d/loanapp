# PARITY-ML — task status (verified 2026-10-02)

Source plans: `PARITY-ML-web-mobile-fix-plan.md`, `PARITY-ML-owner-decisions-2.md`.
Every task below was checked against the code, not the commit message. "Done (owner)" = already implemented and verified; "Fixed in review" = implemented but a defect was found and corrected; "Done (this pass)" = was missing and is now implemented.

Final runs on `merged-all-branches`: `npm run test:ci` green · `npm run test:calc` 185/185 · `npm run test:mobile-parity-api` green · `desktopMobileParity` 24/24 · `approval-notifications` green · `flutter analyze lib` 0 issues · `flutter test` 60/60 · `tsc` clean apart from the 5 errors caused by the owner's staged wallet / cash-settlement WIP.

## Security (SEC)
| Task | Status | Commit(s) / note |
|---|---|---|
| SEC-01 … SEC-21 | Done (owner) | `0cc32d87` … `c46f9adb` (fix(security) series) |
| SEC-08 | Fixed in review | `146148c2` — route module exported non-handlers; key policy moved to `lib/settings/keyPolicy.ts` |
| SEC-15 | Fixed in review | `02dd61f7` — unused collect-cash endpoint removed |

## Money (MON / PEN / CRA)
| Task | Status | Commit(s) / note |
|---|---|---|
| MON-01 | Done (this pass) | `527daf71` — `lib/cashHandover.ts` shared by web + v1 deposit |
| MON-02 | Partial | `3e7faeda` mobile settles runs via reconcile. The shared-transaction part needs `depositToOffice(tx)` in `lib/wallet.ts`, which is the owner's staged WIP (`lib/cashSettlement.ts`) — left to that work |
| MON-03 | Fixed in review | `7321501c`, `4549180d` — owner check had been widened to close/reconcile |
| MON-04 … MON-24 | Done (owner) | see `git log --grep MON-` ; MON-05 deterministic key accepted |
| MON-15 | Fixed in review | `878db9e3`, `23430e98` — edit dropped vehicle-approval / primary-admin flags |
| PEN-01 … PEN-03 | Done (owner) | `deea2704`, `9fe5f3f8`, `bd98ce39`; PEN-01 read-outside-tx race closed in DEC-06 |
| CRA-01 … CRA-03 | Done (owner) | `fd42db64`, `cb44500b`, `3cee8ec9` |

## Time (TIM)
| TIM-01 … TIM-09 | Done (owner) | `f6efb0db` … `a894c401` |
|---|---|---|

## Dashboard / collection / loan detail
| Task | Status | Commit(s) / note |
|---|---|---|
| DASH-01 … DASH-05 | Done (owner) | `ad32538b` … `4db3f4eb` |
| DASH-06 … DASH-11 | Done (this pass) | `f03db01d`, `172d9413`, `3e7b4882`, `a3212e0c`, `a2fba497`, `c64058be` (+ merge fix `b407a1e5`) |
| COL-01 … COL-04 | Done (this pass) | `c26d6625`, `ffb03170` (uses `/collection/handover`, web parity), `9c13c892` |
| LD-01 … LD-04, LD-06 | Done (this pass) | `5ace8b33`, `0964353b`, `5dfc0883`, `b99fe9e2`, `635e7540` |
| LD-05 | Replaced by DEC-01 | — |

## Customers / loans / approvals / KYC
| Task | Status | Commit(s) / note |
|---|---|---|
| CUST-01 … CUST-08 | Done (this pass) | `f39aa146` … `990a2ac8` |
| LOAN-01 … LOAN-04 | Done (this pass) | `6d024147`, `62b46925`, `5daa0dd7`, `0ea84295`. LOAN-01 `counts.active` not added: mobile now loads every page, so its count is exact |
| APR-01, APR-02 | Done (this pass) | `816683ac`, `15c0ac14` |
| APR-03 | Skipped | marked optional in the plan |
| KYC-01 | Done (this pass) | `c46f9adb` |

## Accounting / wallet / runs / tracking
| Task | Status | Commit(s) / note |
|---|---|---|
| ACC-01 … ACC-04 | Done (this pass) | `c1e32cdc`, `8cc8bbaf`, `92a32597`, `2ec0d8fc` |
| WAL-01 … WAL-03 | Done (this pass) | `9415d575` — summary + handover queue + direct collect; own-branch pool warning; ledger note / agent phone. Web wallet page strings → i18n left to I18N-01 |
| RUN-01 | Done (this pass) | `a356a110` — adopts the pending MONEY-10 sort/server-order working-tree change after review |
| RTE-01 | Done (this pass) | `59e1451c` |

## Reports / NPA / notifications / settings
| Task | Status | Commit(s) / note |
|---|---|---|
| RPT-01 | Done (this pass) | `b647047c` — orphan web `reports/agents` page kept: two e2e specs still open it |
| RPT-02, RPT-03 | Done (this pass) | `b5a40862` |
| RPT-04 | Done (this pass) | `8094c10d` |
| RPT-05 | Done (this pass) | `2e1b4e75` — verified `npaClassifier` sets `status: 'npa'` |
| NPA-01, NPA-02 | Done (this pass) | `3b4612fd` — rule NPA-11 |
| NOT-01 … NOT-04 | Done (this pass) | `15d1f496`, `95cbf42e`, `16e5efeb`, `1aca1171` |
| SET-01 … SET-06 | Done (this pass) | `890a8b1e`, `f55e780b`, `aad1e5e3`, `5434e241`, `c6aef006`, `14676a66` |

## Owner decisions (DEC)
| Task | Status | Commit(s) / note |
|---|---|---|
| DEC-01 | Done (this pass) | `44c1b061` — rules PRECLOSE-8/9; calc cases FCL-001…013 updated |
| DEC-02, DEC-04, DEC-07 | Done (owner) | `861ff41d`, `2accbb88`, `be9f2aff` |
| DEC-05 | Done (this pass) | `c64058be` |
| DEC-06 | Done (this pass) | `7cd7e07c` — rules MONEY-32, ACC-11. `creditPenaltyCollection` committed on top of HEAD's `lib/wallet.ts`; the owner's staged WIP copy got the same function so committing it later does not drop it |
| DEC-03 | Done (this pass), rows deferred noted | Part A `be6edafd`. Part B: `df704fc4`, `3dd87f9f`, `dfc38dbc`/`60f8f029`; other rows were already covered by LD/COL/CUST/DASH/ACC/WAL/RPT tasks. Not done: run-sheet per-loan sums from a server loan-level line, and `GET /penalties?groupBy=loan` (mobile sums server `net` per row) |
| FMT-01 | Replaced by DEC-03 | — |

## Not done
| Task | Why |
|---|---|
| I18N-01 | Polish task, one page per commit across every web and mobile screen. All strings added in this pass ship in six locales; existing hardcoded English (e.g. web wallet, run sheet, notification log headers, mobile team / analytics titles) remains. |
| MON-02 (shared tx part) | Blocked by the owner's uncommitted wallet / cash-settlement WIP (plan rule 9). |

## Working tree left as found
Owner's staged WIP (`lib/wallet.ts`, `lib/cashSettlement.ts`, `prisma/schema.prisma`, migration `20260930000000_cash_handover_scope`, `tests/walletAtomicity.test.ts`, plan docs) is untouched and still staged. Unrelated local changes (`docs/audit-parity-verification-report.html`, `mobile/windows/flutter/*` generated files, `test-report/calculation-logic.html` timestamp) are not committed.
