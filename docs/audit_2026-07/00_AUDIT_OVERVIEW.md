# Full-App Audit — July 2026 — Overview & Implementation Order

> Audited 2026-07-17 on `merged-all-branches` @ `52add51`. Read-only audit; **nothing in these four docs is implemented yet.** Each doc is self-contained: findings with file:line evidence, the agreed fix design, and verification steps.

## Scope requested

1. Data leaks between tenants and app types (multi-tenant / module isolation).
2. Hard-coded values (credentials, hosts, currency, business numbers).
3. Feature gaps between the web app and the Flutter mobile app.
4. Language completeness — every user-visible word through i18n, all 6 languages (en, ta, hi, te, kn, ml).

## Coverage

- 196 API route files (`app/api/v1/**`, `app/api/borrower/**`, `app/api/files/**`).
- 94 dashboard server-action/page files (`app/(dashboard)/**`).
- All auth/context helpers read in full (`lib/api/v1-auth.ts`, `lib/api/borrower-mobile.ts`, `lib/chits/access.ts`, `lib/fileAccessPolicy.ts`, `lib/borrowerAuth.ts`).
- Full web page tree vs full mobile route/screen tree.
- Both i18n systems (`i18n/*.ts` web, `mobile/lib/core/l10n/app_strings.dart` mobile) key-diffed per language.

## The four audit docs

| Doc | Area | Severity of worst finding |
|---|---|---|
| `01_TENANT_APPTYPE_DATA_ISOLATION.md` | Cross-tenant / cross-customer data isolation | **High** — borrower can fetch any same-tenant customer's KYC/proof file by filename; 3 cross-tenant write bugs in premium accounting |
| `02_HARDCODED_VALUES.md` | Credentials, hosts, currency, magic numbers | **High** — `'fallback-secret'` JWT fallback; `loantrack@ybl` UPI fallback that can misroute real money |
| `03_WEB_MOBILE_PARITY_GAPS.md` | Feature parity, both directions | **High (functional)** — borrowers submit payment proofs from mobile but staff cannot review them on mobile |
| `04_LANGUAGE_COMPLETENESS_I18N.md` | i18n completeness, all languages, every word | Medium — te/kn/ml ~130–155 web keys short; entire chit + borrower surfaces hard-coded English on both platforms |

## Recommended implementation order (when we implement)

1. **Security first** (doc 01 fixes + doc 02 items 1–2): file-access authorization, 3 tenant-guard fixes, remove `'fallback-secret'`, remove `loantrack@ybl` fallback. Small diffs, highest risk reduction.
2. **Parity critical path** (doc 03): mobile staff payment-proof queue — closes the broken borrower→staff loop for the live chit client. Then the quick wins: auction reschedule, winner-summary copy, member-edit sheet, borrower statement.
3. **Language web** (doc 04 part A): fill te/kn/ml dictionary gaps; key up + translate the chit and borrower surfaces; thread tenant currency symbol through `winnerSummary.ts` and `notify/events.ts`.
4. **Language mobile** (doc 04 part B): fill product-finance key gaps; key up + translate 4 chit screens + 5 borrower screens; currency via `currencyFmtProvider`; seed device language from tenant setting on first login.

Every step ships through the existing gate: `npx tsc --noEmit` + `npm run test:chits` + `flutter analyze` (0 new errors/warnings) → `claude/github-web-editing-lkc19k` → ff-merge `merged-all-branches` → deploy + build-apk → pinned `deliver-apk`.

## Already fixed before this audit (context)

- `public/test_db.php` leaked the production MySQL password publicly — file removed @ `52add51`; **password rotation still pending on the operator side** (it remains in public git history).
- Chit module `appType` scoping was fixed earlier (hard-pinned `'chitfunds'`, data-repair migration applied) — re-verified clean in this audit.
