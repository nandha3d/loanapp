# Task 08 — Milestone 2: Chat, Admission Control & Voice-Bid Audio Proof

**Owner:** 1 agent (or split chat / admission / audio across three if needed). **Depends on:** Milestone 1 merged (tasks 01–07).
**Read** `00_OVERVIEW_AND_DEPENDENCIES.md` first.

Covers user points **8** (auto-admit vs approve), **14** (record sound), **16** (chat public/private), **17** (no recording outside bidding).

## Schema (migration `chit_room_experience_m2`)

Generate via `migrate diff` (see task 01 method). Add:

### New model `ChitRoomMessage`
```prisma
model ChitRoomMessage {
  id             String   @id @default(cuid())
  tenantId       String   @map("tenant_id")
  auctionId      String   @map("auction_id")
  senderUserId   String?  @map("sender_user_id")     // staff/organizer sender
  senderMemberId String?  @map("sender_member_id")   // subscriber sender (M3)
  senderName     String   @map("sender_name")        // denormalized for cheap render
  visibility     String   @default("public")          // public | organizer
  body           String   @db.Text
  createdAt      DateTime @default(now()) @map("created_at")

  auction ChitAuction @relation(fields: [auctionId], references: [id], onDelete: Cascade)

  @@index([auctionId, createdAt])
  @@map("chit_room_messages")
}
```
Add the back-relation `roomMessages ChitRoomMessage[]` to `ChitAuction`.

### `ChitGroup` — admission policy
```prisma
  roomAdmission String @default("auto") @map("room_admission") // auto | approval
```

### `ChitAuctionAttendance` — admission state (reuse attendance as presence)
```prisma
  admissionStatus String @default("admitted") @map("admission_status") // waiting | admitted | denied
```
(model at ~line 1402; it already has `auctionId`, `memberId`, `status`.)

### `ChitBid` — link to audio proof
```prisma
  audioDocumentId String? @map("audio_document_id") // → ChitDocument(documentType='bid_audio')
```

## Backend

### Chat routes
`app/api/v1/chits/[id]/auctions/[auctionId]/messages/route.ts` (`[auctionId]` = **period number**, System-B convention):
- `GET ?since=<cursor>` → messages after cursor. Visibility filter: staff see all; a member sees `public` + their own `organizer` messages (M3). Cap 100, order asc.
- `POST { body, visibility }` → create a message. `visibility='organizer'` = private-to-organizer. `senderUserId=ctx.userId`, `senderName` from user. Trim body ≤ 500, reject empty.
Piggyback recent chat on the hot poll: in `buildLiveState` add `latestMessages` (last 30, `public` only for the generic payload; the client fetches `organizer`-visible via the messages route) — keeps the room to one hot request (point 18).

### Admission routes
- `POST .../join` (`[auctionId]`=period): upsert `ChitAuctionAttendance` for the caller's member. If group `roomAdmission='auto'` → `admissionStatus='admitted'`; else `'waiting'`. Return current admission status. (Staff auto-admitted.)
- `POST .../admit` body `{ memberId, decision: 'admit'|'deny' }` (staff only) → set that attendance row `admitted|denied`, log a `ChitAuctionEvent`.
- `buildLiveState` gains `waiting: [{memberId, name}]` (members with `admissionStatus='waiting'`) so the organizer UI shows a waiting room. Only include for staff viewers (or always include; client shows it to organizer only).

### Audio upload + bid link
- Extend `ALLOWED_UPLOAD_MIME_TYPES` in **both** `app/api/v1/upload/route.ts` and `app/api/upload/route.ts` (and the magic-byte table in `lib/fileUpload.ts`) with: `audio/mp4`, `audio/m4a`, `audio/aac`, `audio/webm`, `audio/mpeg`. Add a **1 MB** cap for audio (short clips) — keep the 5 MB image cap. Add magic-byte signatures (m4a/mp4 `ftyp` at offset 4; webm `1A45DFA3`; mp3 `ID3`/`FFFB`). If a signature is impractical, at minimum enforce the MIME allowlist + size + extension.
- `app/api/v1/chits/[id]/auctions/[auctionId]/bid/route.ts` — accept optional `audioDocumentId` (a `ChitDocument.id` already uploaded) and store it on the created `ChitBid`. Validate the doc belongs to the tenant + has `documentType='bid_audio'`.
- Persist the clip as a `ChitDocument` (`entityType='bid'`, `documentType='bid_audio'`, `fileUrl`, `mimeType`, `sizeBytes`) when uploaded, then reference its id on the bid.

### Point 17 enforcement (design rule, enforce in mobile capture)
Recording happens **only** inside the push-to-talk bid gesture. No ambient/continuous capture. The clip is discarded if the bid is not submitted. State this in a code comment at the capture site and in `docs/chitfund_implementation_markdown/12_LIVE_AUCTION_ROOM_POLLING.md`.

## Mobile

- Add `record: ^5.x` to `mobile/pubspec.yaml` (audio capture). Keep `speech_to_text` for transcript.
- **Push-to-talk bid button**: while held → start STT **and** start `record` to a temp `.m4a` (AAC). On release → stop both. If STT parsed a valid member+amount (via existing `voice_bid_parser.dart`): upload the clip (`Endpoints.upload`, multipart) → get `ChitDocument.id` → `submitBid(..., source:'voice', transcript: parsed, audioDocumentId: id)`. If parse failed → keep the typed/chip fallback; **discard** the clip (point 17). Never record outside this gesture.
- **Chat drawer** in both live screens: a bottom sheet / side drawer with a public message list (poll `latestMessages` from state + the messages route for history) and a composer; a toggle "Send to organizer" flips `visibility='organizer'`. Poll messages on the same 1.5s tick.
- **Waiting room** (organizer view): when `roomAdmission='approval'`, show `state.waiting` with Admit/Deny buttons calling `.../admit`.

## Web

- `AuctionDetailClient.tsx`: chat panel (list + composer + organizer-private toggle), and, for the organizer, a waiting-room list with Admit/Deny when the group is `approval`. Reuse the 1.5s poll; add `latestMessages`/`waiting` handling.
- Group **edit** form: expose `roomAdmission` (Auto-admit / Organizer approves).
- Web audio: optional (browser MediaRecorder → upload). If deferring, note it; mobile is the primary voice surface.

## Acceptance criteria

- Members can post public and organizer-private chat; organizer sees both; other members never see another member's private-to-organizer message.
- `roomAdmission='approval'` puts joiners in a waiting room; organizer Admit/Deny works; `auto` admits instantly.
- A voice bid stores an audio clip as a `ChitDocument` linked via `ChitBid.audioDocumentId`; playback works from web/mobile; upload rejects non-audio and >1 MB.
- Mic never records outside the push-to-talk bid gesture.
- `npm run typecheck`, `dart analyze` clean; migration is ALTER/CREATE-new-table only.

## Commit(s)

```
feat(chit): live-room chat with public/organizer visibility
feat(chit): room admission control (auto vs organizer approval)
feat(chit): voice-bid audio proof (record clip, ChitDocument, bid link)
```
