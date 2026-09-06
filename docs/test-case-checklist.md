# Test Case Checklist (per module)

Every module under `app/api/v1/*` and its matching UI gets a spec covering
all categories below, not just the happy path. Used by
`scripts/self-heal/generate-tests.mjs` as the prompt contract — keep this
file in sync if you add a category.

Modules (from `app/api/v1/`): accounting, admin, agents, analytics,
approvals, auth, chits, collection, customers, dashboard, fcm-token, gold,
gps, kyc, loans, nach, notifications, npa, packages, payment, penalties,
pricing, profile, receipts, reports, routes, settings, theme, upload,
vehicles, wallet.

## Categories

1. **Happy path** — create/read/update/delete (whichever apply) with valid
   data, assert success response/UI state.
2. **RBAC boundary** — every role that should be denied gets a 403/redirect;
   every role that should be allowed succeeds. See
   `lib/scope.ts` and [[module-apptype-isolation]] memory — also assert
   cross-tenant/cross-appType data never leaks into the response.
3. **Validation / bad input** — missing required field, wrong type, out of
   range (negative amounts, future dates where not allowed), oversized
   payload, malformed JSON.
4. **Empty state** — list/dashboard views with zero records render without
   erroring.
5. **Pagination / large data** — page past the end, page size boundaries.
6. **Concurrent edit / idempotency** — double-submit a create, two updates
   racing — assert no duplicate records or corrupted state.
7. **Negative / unauthorized** — unauthenticated request, expired/garbage
   token, wrong tenant ID in path.
8. **Error surfaces in UI** — failed API call shows a user-visible error,
   not a blank screen or unhandled exception.
9. **Link integrity** — every nav link / button-as-link on the module's
   pages resolves (see `e2e/link-check.spec.ts`, not regenerated per
   module — it crawls everything in one pass).
10. **Money/number correctness** (where applicable — loans, accounting,
    gold, wallet, penalties, nach, receipts) — rounding, currency
    formatting, interest/penalty calc matches the documented formula.

## Generating a module's spec

```
node scripts/self-heal/generate-tests.mjs <module>
```

Writes `e2e/<module>/<module>.spec.ts` (refuses to overwrite an existing
file — pass `--force` to regenerate). Review every generated test before
trusting it; the generator drafts against the checklist above, it doesn't
know your business rules by itself.
