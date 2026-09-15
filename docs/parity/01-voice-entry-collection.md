# 01 — Voice-Entry Collection (P0)

## Objective
Let a field agent **record a collection by speaking** ("five thousand, cash") in any of the 6 languages, then confirm.
Surpass Vasool by closing the loop with our existing TTS readback — speak-in **and** speak-back, which they don't have.

## Vasool benchmark
Voice-entry loan collection in 6 languages is Vasool's headline moat (marketed as the primary differentiator). It is
speech-to-text **input** to capture a collection.

## Current state (file:line)
- Collection capture: `mobile/lib/features/collection/quick_collect_sheet.dart:25-596` — fields `receivedAmount`,
  `paymentMode` ('cash'|'upi'|'bank'), `instalmentId`, GPS, proof mode.
- Idempotency key: `quick_collect_sheet.dart:106-113` → `"{date}:{instalmentId}:{amount}"`.
- Offline queue: `mobile/lib/data/local/collection_queue.dart:66-128` (Hive, connectivity sync).
- Submit API: `mobile/lib/data/services/collection_service.dart:35` → `POST /api/v1/collection/entry`.
- Voice **output only** today: `mobile/lib/core/a11y/voice_assist.dart:19-97` (`flutter_tts` 4.2.0,
  locales en/ta/hi/te/kn/ml at `:27-34`). **No `speech_to_text` package exists** (`pubspec.yaml`).
- Web collection entry: `app/(dashboard)/[module]/collection/` (self-pay + runs).

## Gap
No speech-to-text anywhere. Need STT input on mobile (primary) and web (secondary), feeding the **existing** collection
pipeline unchanged.

## Design (DB/config-driven)
- **Mobile:** add `speech_to_text` Flutter package. New Riverpod `voiceEntryControllerProvider`
  (`StateNotifier<VoiceEntryState>`) mirroring the `voice_assist.dart` controller style.
  - Locale map **reuses** the exact map at `voice_assist.dart:27-34` (no second copy — export it from there).
  - Pipeline: tap mic on Quick-Collect sheet → listen → transcript → parse → populate `receivedAmount` + `paymentMode`
    → **TTS readback** ("Five thousand rupees, cash. Confirm?") → user taps confirm → existing submit/queue path runs
    **unchanged** (same idempotency key, same offline queue).
  - Parsing is config-driven: number words + payment-mode keywords per language live in `kStrings`
    (`mobile/lib/core/l10n/app_strings.dart`), not inline — e.g. `voice.kw.cash`, `voice.kw.upi`, `voice.kw.bank`.
    Amount parsing uses a locale-aware number parser; ambiguous transcripts fall back to manual entry (never auto-submit).
- **Web:** Web Speech API (`SpeechRecognition`) behind a mic button on the collection entry form; same parse→confirm→submit.
  Degrade gracefully where unsupported (button hidden).
- **No new endpoint.** Voice is purely a client input method onto the current `/api/v1/collection/entry` contract.

## Schema changes
None required. (Optional, Additive, later: `DailyCollection.entryMethod` enum `manual|voice|qr` for analytics —
defaulted `manual`. Not needed for v1.)

## API contract
Unchanged. Same `collection_service.submit({...})`. Optionally pass `entryMethod:'voice'` in `remarks`/meta if the
optional column is added.

## Web UI / Mobile UI
- Mobile: mic FAB inside `quick_collect_sheet.dart`; listening sheet with live partial transcript + amount/mode chips;
  confirm button reuses existing submit handler.
- Web: mic button beside the amount field on the collection entry component.

## i18n keys (6 langs)
Add to `i18n/en.ts` + mirror ta/hi/te/kn/ml, and to mobile `kStrings`:
`voice.entry.start`, `voice.entry.listening`, `voice.entry.confirm`, `voice.entry.retry`,
`voice.entry.notUnderstood`, `voice.kw.cash`, `voice.kw.upi`, `voice.kw.bank`, `voice.readback.template`.

## Scope / RBAC guards
No new data path → inherits existing collection RBAC + `appScope`. Voice toggle reuses the per-user pref store in the
`prefs` Hive box (like `voice_assist.dart:38`).

## Feature-flag & rollout
- Per-user toggle in mobile settings (default on for agents, like voice assist).
- Optional tenant gate: reuse a `TenantSubscription` boolean if voice should be plan-gated; otherwise ship free to
  beat Vasool on value.
- Rollout: mobile first (where it matters), web second.

## No-hardcode checklist
- [ ] Locale list imported from `voice_assist.dart`, not re-declared.
- [ ] Number-words / payment keywords come from `kStrings`/`i18n`, not inline arrays.
- [ ] No literal UI strings — all via `T.of(ref).x()` / `dict`.
- [ ] Confirm-before-submit; never auto-post a parsed amount.

## Test plan
- Unit: amount/keyword parser per language (table-driven, incl. ambiguous → manual fallback).
- Widget: mic flow populates fields, readback fires, confirm calls existing submit.
- Integration: offline voice entry → queued with correct idempotency key → syncs on reconnect (reuse
  `collection_queue` tests).
- Manual: low-network device, each of 6 languages.

## ⚠️ Structure Impact
**Additive only.** New package, new provider, new i18n keys, new UI affordance. Existing collection pipeline untouched.
Optional `entryMethod` column is Additive with default. **No Breaking changes.**
