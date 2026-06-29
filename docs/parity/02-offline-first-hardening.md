# 02 — Offline-First Hardening (P0)

## Objective
Make the whole agent app usable offline — not just collections — so we **decisively surpass** Vasool's marketed
"works fully offline", and make our offline story visible (we have the engine; we under-market it).

## Vasool benchmark
Markets "works even fully offline" with automatic sync as a headline capability across the field workflow.

## Current state (file:line)
- Real offline engine exists, but **only for collections**: `mobile/lib/data/local/collection_queue.dart:66-128`
  (Hive box `collection_queue`, idempotency `date:instalmentId:amount`, lifecycle pending→synced→failed).
- Sync trigger: `CollectionSyncController` on `Connectivity().onConnectivityChanged` (`:138`).
- Other writes (customer create, loan create, penalty) go straight to API with no offline fallback.
- Our marketing site does **not** mention offline (under-sold).

## Gap
1. Offline coverage is collection-only; Vasool implies app-wide.
2. No offline indicator UX / pending-sync visibility surfaced prominently.
3. Marketing omits offline entirely.

## Design (DB/config-driven)
- **Generalize the queue.** Extract the proven pattern in `collection_queue.dart` into a reusable
  `OfflineQueue<T>` (Hive-backed, idempotency-keyed, pending/synced/failed) under `mobile/lib/data/local/`.
  Each write feature registers a queue + a `submit(item)` resolver. No behavioural change to collections — they
  become the first consumer of the generalized queue.
- **New consumers (each Additive):** customer-create, loan-create (incl. gold fields from §03), penalty record.
  Idempotency keys follow the same `{type}:{naturalKey}:{discriminator}` shape.
- **Conflict policy:** server stays source of truth; 409 → terminal `failed` with reason (same as today). Reads use
  last-synced cache where available; writes queue.
- **Sync controller** generalized to drain all registered queues on reconnect, with backoff.
- **Offline UX:** a global connectivity banner + a "pending sync (N)" badge, driven by queue counts (Riverpod
  `pendingSyncCountProvider`). Strings via `kStrings`.

## Schema changes
None server-side required for v1. (Server already idempotent on collection entry; ensure customer/loan/penalty
create endpoints accept an `idempotencyKey` — verify, add Additive support if missing.)

## API contract
Reuse existing create endpoints; require they honor an `idempotencyKey` (Additive request field, ignored if already
present). Confirm per endpoint before wiring its offline consumer.

## Web UI / Mobile UI
- Mobile: connectivity banner + pending-sync badge in the app shell; per-record "queued" chips.
- Web: optional service-worker read cache later (not v1; web is usually online).

## i18n keys (6 langs)
`offline.banner.offline`, `offline.banner.syncing`, `offline.pending.count`, `offline.synced.ok`,
`offline.failed.reason` — `i18n/*` + `kStrings`.

## Scope / RBAC guards
Queued items carry `tenantId` + `appType`; on sync they hit the same `appScope`-guarded endpoints. No new exposure.

## Feature-flag & rollout
Roll out per write-type behind a mobile build flag; collections already live, add customer → loan → penalty
incrementally. No tenant gate (offline is a universal value prop).

## Marketing follow-through (ties to §08)
Add "Works fully offline — auto-syncs when back online" to the site + store listing. We can claim it truthfully once
coverage is generalized.

## No-hardcode checklist
- [ ] Queue box names / retry/backoff constants in a single config object, not scattered literals.
- [ ] All banner/badge strings via i18n.
- [ ] Idempotency key builders centralized (one helper), not re-implemented per feature.

## Test plan
- Unit: `OfflineQueue<T>` enqueue/sync/fail transitions; idempotency dedupe.
- Integration: airplane-mode create customer + loan + collection, reconnect, assert single server row each.
- Regression: existing `collection_queue` behaviour unchanged after extraction.

## ⚠️ Structure Impact
**Additive.** Refactor of `collection_queue` into a generic queue is internal (collections behaviour preserved by
test). New queue consumers + UX are additive. **Breaking (needs sign-off):** none, *unless* a create endpoint must
change response shape to return idempotency status — if so, that specific endpoint change is itemized for approval
before implementation.
