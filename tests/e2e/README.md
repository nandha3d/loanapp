# LoanTrack Web E2E (Playwright)

Covers every web module: nav, forms (valid + invalid), actions, RBAC, negative paths.

## Prerequisites
The fresh-wipe DB only has `developer`. Seed the standard test users + sample data first:

```bash
npm run db:seed        # creates superadmin/super123, admin/admin123, agent karthik/agent123, branches, samples
npm run build && npm run start   # or: npm run dev
```

## Run
```bash
npx playwright test                 # all
npx playwright test customers       # one module
npx playwright test --headed        # watch
npx playwright show-report
```

## Env overrides
| Var | Default |
|---|---|
| `E2E_BASE_URL` | http://localhost:3000 |
| `TEST_MODULE` | microlending |
| `SUPERADMIN_EMAIL` / `_PASS` | superadmin / super123 |
| `ADMIN_EMAIL` / `_PASS` | admin / admin123 |
| `AGENT_EMAIL` / `_PASS` | karthik / agent123 |

## Structure
- `auth.setup.ts` — logs in each role → `playwright/.auth/*.json`.
- `helpers/app.ts` — shared helpers (`goto`, `fill`, `select`, `seeText`, `seeSuccess`, role storage).
- `accounting/*` — existing premium-accounting suite (15 pages).
- `<module>.spec.ts` — one file per module. Each test is tagged `MOD-NN` matching `PARITY_AND_E2E_TESTS.md §4`.

## Notes
- Default role = superadmin. Specs needing admin/agent use `test.use({ storageState: STORAGE.admin | .agent })`.
- Form selectors use `[name="..."]` (stable) + role/text for buttons/nav. Tune button text to your i18n labels if needed.
- Multi-tenant: `getDefaultTenantId()` resolves the single seeded tenant, so plain `localhost:3000` works in dev. For subdomain tenants set `E2E_BASE_URL` to the tenant host.
