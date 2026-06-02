# C4 — Customer Collection Points (mobile UI)

**Priority:** P0 · **Status:** API ✅ done · UI ❌ (this story)
**Persona:** Agent / Admin creating or editing a customer.

## Story
As an **agent**, I want to add **multiple collection points** (home, shop, office…) to a customer, each with a label, address, optional GPS lat/lng, and one marked **primary**, so the route covers every place the customer pays from.

## Background facts (verified — do not re-derive)
- **Prisma model** `CustomerCollectionPoint` (`prisma/schema.prisma:333`): fields `name String`, `address String @db.Text`, `latitude Float?`, `longitude Float?`, `isPrimary Boolean @default(false)`. Relation on `Customer.collectionPoints` (`schema.prisma:321`).
- **API DONE:** `app/api/v1/customers/route.ts` POST already accepts `collectionPoints?: Array<{name,address,latitude,longitude,isPrimary}>`, normalises (drops entries missing name/address, coerces lat/lng to number|null), and nested-creates them. Response `include`s `collectionPoints`.
- **Edit path:** `app/api/v1/customers/[id]/route.ts` PATCH — collection points are **NOT** yet handled there. For edit-mode parity you must extend the PATCH (see §4). For CREATE, nothing more is needed server-side.
- **Web reference UI:** `app/(dashboard)/[module]/customers/new/CustomerForm.tsx` — collection point rows have: Point Name/Label*, isPrimary checkbox, Address*, Latitude (optional), Longitude (optional). Persistence shape in `app/(dashboard)/[module]/customers/actions.ts:167`.
- **Mobile form file:** `mobile/lib/features/customers/new_customer_screen.dart` (`_NewCustomerScreenState`). It already has the pattern to copy: `_GuarantorEntry` class, `_guarantors` list, `_SectionCard`, `_extendedFields(logoUrl)` builder, and `create(... extra: …)`.
- **Service create:** `mobile/lib/data/services/customer_service.dart` `create({... Map<String,dynamic> extra = const {}})` spreads `...extra` into the POST body. So passing `collectionPoints` inside `extra` reaches the API unchanged.

## 1. Local model (add to new_customer_screen.dart, near `_GuarantorEntry`)
```dart
class _CollectionPointEntry {
  _CollectionPointEntry()
      : name = TextEditingController(),
        address = TextEditingController();
  final TextEditingController name;
  final TextEditingController address;
  double? lat;
  double? lng;
  bool isPrimary = false;
  void dispose() { name.dispose(); address.dispose(); }
}
```

## 2. State (in `_NewCustomerScreenState`)
- Add: `final List<_CollectionPointEntry> _collectionPoints = [];`
- In `dispose()`: `for (final cp in _collectionPoints) cp.dispose();`
- **Edit prefill:** add `final List<CustomerCollectionPoint>? collectionPoints` to the mobile `Customer` model (parse from `json['collectionPoints']`); in `initState` when editing, map them into `_collectionPoints` (set controllers, lat, lng, isPrimary). If you keep edit out of scope for v1, gate the section the same way other create-only sections are gated (`if (!_isEdit)`), but prefer including it.

## 3. UI — new `_SectionCard` after the Company section, before Documents
Mirror the Guarantors section pattern. Each row:
- TextField "Point Name / Label *" (`cp.name`).
- Checkbox/Switch "Primary" (`cp.isPrimary`) — enforce single primary: when one is toggled true, set others false in `setState`.
- TextField "Address *" (`cp.address`, maxLines 2).
- Row: "Latitude" + "Longitude" read-only-ish text + a **"Use my GPS"** button that calls `ref.read(gpsServiceProvider).currentPosition()` (`mobile/lib/core/gps/gps_service.dart`, returns `Position?` with `.latitude/.longitude`) and fills `cp.lat/cp.lng`; show `cp.lat`/`cp.lng` formatted to 5dp or "—".
- Delete icon → remove + dispose.
- "Add Collection Point" `OutlinedButton.icon` (Icons.add_location_alt_outlined) → `setState(() => _collectionPoints.add(_CollectionPointEntry()))`.

Use existing `_SectionCard(icon: Icons.place_outlined, title: t.x('sec.collection_points'), child: …)`.

## 4. Submit wiring
In `_extendedFields(String? logoUrl)` (already exists) append, before `return m;`:
```dart
final cps = _collectionPoints
    .where((cp) => cp.name.text.trim().isNotEmpty && cp.address.text.trim().isNotEmpty)
    .map((cp) => {
          'name': cp.name.text.trim(),
          'address': cp.address.text.trim(),
          if (cp.lat != null) 'latitude': cp.lat,
          if (cp.lng != null) 'longitude': cp.lng,
          'isPrimary': cp.isPrimary,
        })
    .toList();
if (cps.isNotEmpty) m['collectionPoints'] = cps;
```
- **Create:** already passes `extra: _extendedFields(logoUrl)` → reaches API. No change.
- **Edit (PATCH):** the current PATCH whitelist (`app/api/v1/customers/[id]/route.ts` `CUSTOMER_UPDATE_FIELDS`) ignores unknown keys, so `collectionPoints` would be silently dropped. To support edit you must: in that route, after the scalar update, if `body.collectionPoints` is an array, `deleteMany({where:{customerId:id}})` then `createMany`/nested `create` the normalised points (same normaliser as POST). Wrap in the existing try. Keep it inside the tenant-scoped update (verify the customer belongs to `ctx.tenantId` first — the route already loads it).

## 5. i18n keys (add to `mobile/lib/core/l10n/app_strings.dart`, all 6 langs)
`sec.collection_points` = "Collection Points" · `fld.point_label` = "Point Name / Label" · `fld.point_primary` = "Primary" · `btn.add_collection_point` = "Add Collection Point" · `btn.use_my_gps` = "Use my GPS" · `fld.latitude` = "Latitude" · `fld.longitude` = "Longitude".
(Translate each; follow the existing entry style. en/ta/hi/te/kn/ml.)

## 6. Acceptance criteria
- [ ] Create customer with 2 points (one primary) → GET customer detail shows both, primary flagged.
- [ ] Point missing name OR address is dropped silently (not sent).
- [ ] "Use my GPS" fills lat/lng; denying permission leaves them null and still saves.
- [ ] Only one primary at a time.
- [ ] Edit customer loads existing points and saves changes (if §4-edit done).
- [ ] `flutter analyze` clean. No Dart-side math.

## 7. Files touched
- `mobile/lib/features/customers/new_customer_screen.dart` (model, state, UI, submit).
- `mobile/lib/data/models/customer.dart` (add `collectionPoints` parse for edit prefill + a `CustomerCollectionPoint` dart class).
- `mobile/lib/core/l10n/app_strings.dart` (7 keys × 6 langs).
- *(edit support only)* `app/api/v1/customers/[id]/route.ts`.
