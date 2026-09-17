# 08 — Play Store Presence & ASO (P2, non-code)

## Objective
Close the only non-engineering gap: Vasool is a **live, ranked** Play Store listing; our store presence is
unverified/under-leveraged. Win discoverability and trust.

## Vasool benchmark
`com.vasool.app` — live on Google Play, ranked, with screenshots, reviews, install traction; positions on
voice-entry + offline + GPS.

## Current state
- Mobile app exists (Flutter, Android + iOS — `mobile/`), with `codemagic.yaml` CI and keystore present.
- Store listing presence/installs not confirmed. Marketing site omits offline + voice (see §02).

## Gap
1. Verify/ship a polished Play Store (and App Store) listing.
2. ASO: keywords, title, screenshots, video.
3. Reviews/ratings flywheel.
4. Messaging that out-positions Vasool on what we uniquely have.

## Plan (no code; marketing + release ops)
- **Listing:** confirm `com.<brand>` package live; complete title/subtitle, long description, 6-language localization
  (we already support the languages — localize the listing too).
- **ASO keywords:** "loan collection app", "microfinance software", "chit fund app", "gold loan software",
  "vasool", "EMI collection", "field agent GPS collection" — target terms Vasool ranks on **plus** ours-only
  (chit, gold, auto, bureau, NPA).
- **Screenshots/video:** lead with **voice-entry (§01)**, **fully-offline (§02)**, live GPS map, borrower portal,
  multi-product dashboard — visually show what Vasool can't (chit/auto/accounting/bureau).
- **Differentiator banners:** "Works fully offline", "Voice entry in 6 languages", "Micro + Auto + Gold + Chit in one
  app", "Credit bureau + RBI NPA built-in", "Free plan available" (Vasool has no free tier).
- **Reviews flywheel:** in-app review prompt after a successful collection streak (Flutter `in_app_review`),
  gated/config-driven; never spammy.
- **Comparison page:** a public "ZoloFund vs Vasool" page on the marketing site (reuse analysis in
  `docs/vasool-vs-zolofund.html`) — honest, lead with free tier + multi-product + compliance.

## Dependencies
- §01 voice + §02 offline must ship (or be demoable) before headlining them in store creatives.
- §06 free tier / Collector plan strengthens the "free plan available" hook.

## No-hardcode checklist
- In-app review prompt thresholds (streak count) from config, not inline.

## Test / verification
- Listing live + localized; ASO keywords indexed; install + review funnel tracked.
- Marketing site shows offline + voice + comparison page.

## ⚠️ Structure Impact
**None (non-code).** Optional `in_app_review` package is Additive on mobile. No structural changes.
