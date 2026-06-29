# LoanTrack vs Vasool — Parity-&-Ahead Implementation Doc Set

> **Mission:** Make LoanTrack *strictly ahead of [vasool.app](https://vasool.app) on every single element*,
> and rework pricing to win head-to-head — **without hardcoding anything** and **without changing the current
> structure unless the change is explicitly signed off**.

This folder is the **build specification**. It is documentation only. No code, schema, or config is changed by
reading or producing these docs. Each section file is self-contained and ends with a verification + no-hardcode
checklist that the implementer runs.

---

## The two non-negotiable rules

1. **NEVER HARDCODE.** Every value that can vary (prices, limits, rates, feature flags, copy, module lists) lives in
   a DB table, an `AppSetting`, the pricing catalog, `TenantSubscription`, or an i18n dictionary — never inline in a
   page/component. See [`00-constraints-and-conventions.md`](./00-constraints-and-conventions.md).
2. **NO STRUCTURE CHANGE WITHOUT SIGN-OFF.** Every doc carries a `⚠️ Structure Impact` block classifying each change
   as **Additive** (safe, backward-compatible) or **Breaking** (needs explicit user approval before implementation).
   Nothing in the Breaking column is built until the user says go.

---

## Section files

| # | File | Priority | Type |
|---|---|---|---|
| — | [`00-constraints-and-conventions.md`](./00-constraints-and-conventions.md) | — | Rules + reuse patterns |
| 1 | [`01-voice-entry-collection.md`](./01-voice-entry-collection.md) | **P0** | Close gap (Vasool leads) |
| 2 | [`02-offline-first-hardening.md`](./02-offline-first-hardening.md) | **P0** | Surpass (perception gap) |
| 3 | [`03-gold-loan-completion.md`](./03-gold-loan-completion.md) | P1 | Close gap (mobile) |
| 4 | [`04-property-loan-vertical.md`](./04-property-loan-vertical.md) | P1 | New vertical |
| 5 | [`05-product-financing-vertical.md`](./05-product-financing-vertical.md) | P1 | New vertical |
| 6 | [`06-pricing-rework.md`](./06-pricing-rework.md) | **P0** | De-hardcode + compete |
| 7 | [`07-surpass-parity-elements.md`](./07-surpass-parity-elements.md) | P2 | Pull ahead everywhere |
| 8 | [`08-play-store-aso.md`](./08-play-store-aso.md) | P2 | Go-to-market (non-code) |

---

## Element scorecard — current vs target

Legend: ✅ Ahead · 🟰 Parity · ⚠️ Weaker · ❌ Behind. **Target column is all ✅.**

| Element | Now | Target | Driven by section |
|---|---|---|---|
| Voice-ENTRY (speech-to-text) | ❌ | ✅ | 01 |
| Voice-OUTPUT (TTS) | ✅ | ✅ | 01 (closed-loop) |
| Offline-first (full app) | 🟰 | ✅ | 02 |
| Gold loan (web) | ✅ | ✅ | 03 |
| Gold loan (mobile) | ❌ | ✅ | 03 |
| Property loan | ❌ | ✅ | 04 |
| Product/consumer financing | ❌ | ✅ | 05 |
| Microfinance / auto / chit | ✅ | ✅ | — (already lead) |
| Pricing vs ₹699 flat | ⚠️ | ✅ | 06 |
| Pricing de-hardcode | ❌ | ✅ | 06 |
| GPS / route / reports / notif / biometric / multi-lang | 🟰 | ✅ | 07 |
| Bureau / NPA / accounting / borrower portal / anti-fraud | ✅ | ✅ | 07 (deepen) |
| Play Store presence / ASO | ⚠️ | ✅ | 08 |

---

## Build sequencing (dependency order)

```
P0 ─┬─ 06 pricing de-hardcode      (fix the 3 hardcodes first — unblocks honest pricing)
    ├─ 01 voice-entry              (Vasool's loudest moat — erase it)
    └─ 02 offline-first hardening  (we have the engine; generalize + market)

P1 ─┬─ 03 gold-loan completion     (finish what's half-built)
    ├─ 04 property vertical        (new module — sign-off gate)
    └─ 05 product-finance vertical (new module — sign-off gate)

P2 ─┬─ 07 surpass every element    (continuous; per-element)
    └─ 08 play-store ASO           (parallel, non-engineering)
```

---

## How to read a section file

Every section uses the same skeleton so they are scannable and executable:

1. **Objective** — what "ahead of Vasool" means here.
2. **Vasool benchmark** — exactly what they ship.
3. **Current state (file:line)** — verified pointers into our code.
4. **Gap** — the delta.
5. **Design (DB/config-driven)** — the approach, reusing existing mechanisms.
6. **Schema changes** — additive migrations only, called out explicitly.
7. **API contract** — endpoints/payloads.
8. **Web UI / Mobile UI** — where it plugs in.
9. **i18n keys** — strings for all 6 languages.
10. **Scope / RBAC guards** — `appScope`, `requireModule`, role checks.
11. **Feature-flag & rollout** — how it's gated and shipped.
12. **No-hardcode checklist** — pass before merge.
13. **Test plan** — how to verify end-to-end.
14. **⚠️ Structure Impact** — Additive vs Breaking (Breaking ⇒ sign-off).
