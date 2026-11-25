# Activity Report — Jul 1–4, 2026

Covers all branches, last 3 days (`git log --since="3 days ago" --all`), 50 commits.

## Newly Added

- **Web-mobile parity** (ad36290): Chit Funds CRUD, e-NACH panel, analytics upgrade, dashboard enhancements, borrower portal — mobile now matches web feature set.
- **Third-party integrations settings** (fdb2912): Digio KYC, Email, SMS, WhatsApp integration screens on web + mobile.
- **Map location picker** (2296ebc): per-customer "Pin on map" (search via OSM Nominatim, GPS, drag pin, reverse-geocode); collection route map now shows customer photo pins instead of plain markers.
- **Account profile + collection workflow + automation** (4469351): account profile page, password change/OTP endpoints, collection "today" endpoint, pre-push git hook, Playwright CI workflow, devcontainer.
- **Customer photos** (58352c9, 12314d3): profile photos in customer list, loans list, dashboard, and collect-sheet.
- **Square photo crop + disk cache** (dc78d3b): crop for profile/guarantor/logo photos; disk-cached authed images.
- **VPS diagnostics** (dc0f1a9, 6bf1c70): read-only photo-pipeline diagnostic workflow, one-time DB hotfix workflow.
- **Devcontainer** (f0d2af9): one-click GitHub Codespaces setup.
- **69 missing i18n keys** (69feda4) added across languages.

## Changed / Improved

- **Mobile perf**: tab data cached across navigation for instant screen loads (0698d2f).
- **Nav restructure**: Customers tab replaces "More" in bottom nav (12314d3); back-button/permission/PDF-error fixes, nav merge, portal access (5df4137).
- **UI polish**: Customer 360 header compacted (photo left, identity right) (29a6e73); loan-detail header merged into card (b5323ed); duplicate customer identity removed from loan summary (98f5bf4); dashboard "Up Next" deduped by customer (b5323ed).
- **Uploads**: moved outside app checkout dir via `UPLOAD_DIR` so deploys can't wipe photos (c7e3156).
- **Repayment allocation**: restored oldest-first order so overdue status is consistent everywhere (eab6fbf/7573638).
- **Login robustness**: mobile login hardened for flaky networks; mobile pushes no longer restart the server (aef8311).
- **APK default domain**: switched to HTTPS `app.animazon.in` instead of plain-HTTP IP (27c45ca), after diagnosing phone connectivity (5d1b04a, 95720f7, 3df77fd).
- **Version bumps**: 0.1.0+8 → +10 → +18 tracking photo/crop/map features.
- Splash-screen freeze fix + server-URL config dialog (2b82a94); 10 mobile bugs fixed in restructured rate/payments/GPS/nav (65570ed); account profile, collection workflows, automation enhancements (4469351).
- Dependency bump: `image_cropper` added, `crypto` promoted transitive→direct (5ce4c51, this session).

## Fixed (bugs)

- Customer photos not loading in mobile app (d8da1d7, 1e74020).
- Release build break: `const` removed from `LinearGradient` in customer_tile (08334ba) and `AlwaysStoppedAnimation` (24a83a7).
- Duplicate i18n keys causing compile error — 9 keys dropped (22205c6).
- First-login-after-install bug + collect-sheet photo consistency (a446743).
- devcontainer compose file excluded by `*.yml` gitignore rule — re-committed (d25cf26).
- Windows local e2e test timeouts — webkit project commented out (54c06a5).

## Removed

- 9 duplicate i18n keys (22205c6) — were already defined, caused const-map compile error.
- Webkit Playwright project disabled for local Windows runs (54c06a5) — not deleted, just excluded.

## CI / Infra

- Playwright workflow added (4469351).
- VPS diagnostic + DB hotfix one-time workflows added then presumably used for connectivity debugging (5d1b04a → 27c45ca chain).
- `.mcp.json`, `.githooks/pre-push`, `.env.example` additions (4469351).

## Contributors this window

- **Claude** (automated commits via sessions) — bulk of mobile feature/fix work.
- **vigneshsinna** — web-mobile parity, integrations settings.
- **nandha3d** (you) — mobile bug fixes, profile/collection features, this session's dep regen commit.
