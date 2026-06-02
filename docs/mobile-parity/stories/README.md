# Mobile Parity — Per-Story Implementation Specs

Each file here is a **self-contained, low-level work order** for one story. An AI agent (or developer) should be able to implement it **100% without guessing**, because every spec lists: exact files to touch, real endpoint signatures, real model fields, the existing pattern to copy, i18n keys, and acceptance criteria.

## Global conventions (read once, apply to every story)

1. **No web changes** (`app/(dashboard)/**`, web components, web actions) unless the story explicitly says so. Adding/extending `app/api/v1/**` is allowed — it does not change web UI.
2. **All business math comes from the API.** Never compute scores, restructure rates, P&L, ageing, NPA, totals in Dart. If a number is needed, an `/api/v1/*` endpoint must return it.
3. **Every new capability = (a) Bearer `/api/v1` endpoint if data is needed + (b) Flutter screen/widget + (c) i18n keys in all 6 languages.**
4. **i18n:** add keys to `mobile/lib/core/l10n/app_strings.dart`. Every key needs `en, ta, hi, te, kn, ml`. Access via `final t = T.of(ref); t.x('key')`.
5. **Auth/role:** current user via `ref.watch(authControllerProvider).user`; role enum `UserRole` in `mobile/lib/data/models/user.dart`. Gate developer-only UI on `user?.role == UserRole.developer`.
6. **Networking:** `ref.watch(dioProvider)` (baseUrl already ends `/api/v1`, Bearer auto-attached). Use RELATIVE paths. Unwrap with `unwrapEnvelope(res, (d) => …)` from `mobile/lib/core/network/dio_client.dart`.
7. **Endpoints constants:** `mobile/lib/shared/constants/endpoints.dart`.
8. **Routing:** add routes in `mobile/lib/core/router/app_router.dart`; `_moduleBlocked()` exempts admin/superadmin/developer.
9. **Theme:** `AppColors`, `AppTokens`, `AppTypography` under `mobile/lib/core/theme/`. Reuse `AppTextField`, `AppButton`, `_SectionCard` patterns.
10. **Commit only when the owner asks.**

## Verification checklist (every story must pass)

- [ ] `cd mobile && flutter analyze <changed files>` → no errors.
- [ ] TS endpoints: imports mirror an existing v1 route; no new Prisma fields invented (verify against `prisma/schema.prisma`).
- [ ] i18n: `node` key-parity check shows 0 missing for new keys across 6 langs.
- [ ] Manual: screen renders, happy path works, error + empty states handled.

## Index

| ID | Title | Priority | File |
|---|---|---|---|
| C4 | Customer collection points (UI) | **P0** | [C4-collection-points.md](C4-collection-points.md) |
| J10 | Developer System Settings | **P0** | [J10-system-settings.md](J10-system-settings.md) |
| D4 | Loan edit | P1 | [D4-loan-edit.md](D4-loan-edit.md) |
| F2 | Penalty waive + filters | P1 | [F2-penalty-waive-filters.md](F2-penalty-waive-filters.md) |
| G2 | Approvals full coverage | P1 | [G2-approvals.md](G2-approvals.md) |
| J2 | Settings: penalty config | P1 | [J2-settings-penalty.md](J2-settings-penalty.md) |
| J4 | Settings: payment/UPI | P1 | [J4-settings-payment-upi.md](J4-settings-payment-upi.md) |
| J5 | Settings: notification toggles | P1 | [J5-settings-notifications.md](J5-settings-notifications.md) |
| H | Accounting premium suite | P2 | [H-accounting-suite.md](H-accounting-suite.md) |
| I2 | Chits create/edit/auction | P2 | [I2-chits-write.md](I2-chits-write.md) |
| K | Developer panel | P2 | [K-developer-panel.md](K-developer-panel.md) |
| L | Admin panel | P2 | [L-admin-panel.md](L-admin-panel.md) |
| M | Reports & analytics | P2 | [M-reports-analytics.md](M-reports-analytics.md) |
| N | KYC/subscription/notif-log/statement | P2 | [N-misc.md](N-misc.md) |
| B | Dashboard polish | P2 | [B-dashboard.md](B-dashboard.md) |

> Parent narrative: [../USER-STORIES.md](../USER-STORIES.md).
