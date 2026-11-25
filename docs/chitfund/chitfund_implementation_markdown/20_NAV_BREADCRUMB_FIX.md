# Step 20 — Fix Navigation: Auction Room Back/Breadcrumb Lands on Chit Home

> **Implementation status (2026-07-14): BUG, root cause verified.** No schema/backend change — this is a frontend nav-structure fix. **User-confirmed direction**: from the auction room, back/breadcrumb navigation currently lands on the chit-groups list ("home"); it must instead return to that specific chit group's page.

## Root cause (verified)

`components/layout/Topbar.tsx:63-84` `getBreadcrumbs()`:

```ts
function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const parts = pathname.split('/').filter(Boolean);
  const crumbs: BreadcrumbItem[] = [{ label: dict.sidebar.dashboard, href: '/dashboard' }];
  if (parts[0] && parts[0] !== 'dashboard') {
    const id = parts[0];
    const label = (dict.sidebar as any)[id] || id.charAt(0).toUpperCase() + id.slice(1);
    if (parts.length > 1) {
      crumbs.push({ label, href: `/${parts[0]}` });
      if (parts[1] === 'new') { crumbs.push({ label: dict.loans.newLoan }); }
      else { crumbs.push({ label: breadcrumbLabels[parts[1]] || parts[1] }); }
    } else { crumbs.push({ label }); }
  }
  return crumbs;
}
```

For the auction detail URL `/chits/{groupId}/auctions/{auctionId}`, `parts = ['chits', groupId, 'auctions', auctionId]`. This function only ever looks at `parts[0]` and `parts[1]` — **it has no concept of a 3rd or 4th path segment**, so the auction page produces exactly two crumbs: `Dashboard` (href `/dashboard`) and the group's label (`breadcrumbLabels[groupId]`, **no `href`** — `crumbs.push({ label: ... })` never sets one, see the `else` branch and the "Chits" middle crumb both being link-only via `parts[0]`). Rendered breadcrumb: `Dashboard / Chits / {Group Name}` where **only "Chits" is a clickable link** (→ `/chits`, the group list = "home") — the group-name crumb, which is what the user actually wants to click back to, is plain text with no `href`. That's the entire bug: there is no way to navigate from the auction page back to the specific group via breadcrumb, only back to the full list.

Secondary contributor: `AuctionDetailClient.tsx` (`855`-area, confirmed at line `22, 42`) has no explicit "back to group" link/button of its own (`router.back()` or otherwise) — the page relies entirely on the (broken) breadcrumb for upward navigation.

Label registration itself is correct and not the bug: `AuctionDetailClient.tsx:42` calls `useRegisterBreadcrumbLabel(group.groupCode ?? group.id, group.name)`, and the URL's `parts[1]` is whatever `id` was used to navigate there (either the raw id or the groupCode, since `chits/[id]/page.tsx:19` resolves by `OR:[{id},{groupCode:id}]`) — so `breadcrumbLabels[parts[1]]` does resolve to the right name today. The label is right; it's just not a link, and the deeper `auctions/{auctionId}` segment is dropped entirely.

## Fix design

Rewrite `getBreadcrumbs` as a generic deep-path walker instead of a hardcoded 2-level function:

```ts
// Segments that don't have their own index page and should collapse into the
// PREVIOUS crumb rather than render as a separate (dead-end) breadcrumb link.
const COLLAPSE_SEGMENTS = new Set(['auctions']);

function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const parts = pathname.split('/').filter(Boolean);
  const crumbs: BreadcrumbItem[] = [{ label: dict.sidebar.dashboard, href: '/dashboard' }];
  if (!parts[0] || parts[0] === 'dashboard') return crumbs;

  let hrefAcc = '';
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    hrefAcc += `/${seg}`;
    const isLast = i === parts.length - 1;

    if (COLLAPSE_SEGMENTS.has(seg)) continue; // e.g. 'auctions' — no index page, skip as its own crumb

    let label: string;
    if (i === 0) label = (dict.sidebar as any)[seg] || seg.charAt(0).toUpperCase() + seg.slice(1);
    else if (seg === 'new') label = dict.loans.newLoan;
    else label = breadcrumbLabels[seg] || seg;

    // Every crumb except the last gets a link; the last is plain text (current page).
    crumbs.push(isLast ? { label } : { label, href: hrefAcc });
  }
  return crumbs;
}
```

For `/chits/{groupId}/auctions/{auctionId}`: `parts = ['chits', groupId, 'auctions', auctionId]` → produces `Dashboard(/dashboard) / Chits(/chits) / {Group Name}(/chits/{groupId}) / {Auction Label}` — the group crumb is now a real link to the group page, and the auction crumb (last, current page) is plain text. This directly satisfies the user's confirmed requirement: clicking the group name from the auction page returns to that group.

Register a label for the auction segment too, so the last crumb reads "Period 3" instead of the raw cuid — add `useRegisterBreadcrumbLabel(auction.id, `Period ${auction.periodNumber}`)` in `AuctionDetailClient.tsx` alongside the existing group-label registration at line 42.

Audit **other** multi-level detail clients using the same context (`components/layout/BreadcrumbLabelContext.tsx` consumers: `ChitGroupDetailClient.tsx`, `VehicleDetailClient.tsx`, `LoanDetailClient.tsx`, `CustomerProfileClient.tsx`) for the same 2-level assumption — any of them with a 3rd-level child route (e.g. a loan's repayment-schedule sub-page, if one exists) has the identical bug and benefits from this same generic rewrite. Fix `Topbar.tsx` once; it fixes all of them.

## Secondary fix: explicit "back to group" affordance

Even with breadcrumbs fixed, add an explicit back link at the top of `AuctionDetailClient.tsx` (mirroring the existing pattern already used one level up in `chits/[id]/page.tsx:45-48`, "Back to Chit Groups"): `Link href={`/chits/${group.groupCode ?? group.id}`}` labeled "Back to {group.name}". This keeps the affordance visible without depending on the user noticing the breadcrumb, and matches the existing UX convention already established for the group page itself.

Also replace any bare `router.back()` calls used for cancel/back actions on chit forms (per the original exploration, chit create/update actions redirect via `redirect()` server-side at `actions.ts:256`/`1337` already — verify no client-side `router.back()` usage exists elsewhere in the chits UI that could land somewhere unexpected depending on browser history state; if found, replace with an explicit `href`).

## Edge cases

- Deep-linking directly to the auction URL (fresh tab, no prior client-side navigation history) — the fix must work purely from the URL path (it does; `getBreadcrumbs` only reads `pathname`, no dependency on navigation history).
- Group accessed via `groupCode` vs raw `id` in the URL — both resolve to the same registered label since `chits/[id]/page.tsx:19` looks up by either and `AuctionDetailClient.tsx:42` registers under `group.groupCode ?? group.id` — whichever the URL actually used as `parts[1]` must match the registration key. Since the page component receives `group` resolved from either identifier but the **URL itself** retains whatever the user/link originally used, confirm the registered key is always the literal URL segment value, not a normalized one — read `group.groupCode ?? group.id` against the actual `id` route param, not just the DB's preferred display key, to guarantee an exact match. (If a mismatch is found during implementation — e.g. someone navigated via raw `id` but registration keys off `groupCode` — register under **both** `group.id` and `group.groupCode` to be safe, same as the `OR` lookup already does.)
- `new` segment handling (`chits/new`) — preserved as-is (existing special case for "New X" labeling), just folded into the generic loop instead of the old hardcoded `if (parts[1] === 'new')`.

## Verification steps

- Manual: navigate Dashboard → Chits → a group → an auction; confirm breadcrumb shows all 4 levels with the group name as a working link back to the group page (not `/chits`).
- Manual: open the auction URL directly in a fresh tab (paste URL, no prior navigation) — breadcrumb still renders correctly from a cold load.
- Regression: existing loans/customers/vehicles breadcrumbs (2-level cases) render identically to before — the generic loop must produce the same output as the old hardcoded function for exactly 2 `parts`.
- Regression: `chits/new` still shows "New Loan"-style label (verify the `dict.loans.newLoan` reuse for the chit "new" path is actually correct copy, or if chits has/needs its own "new" label key — flag if the current shared key is loan-specific wording bleeding into chits, and fix if so since this doc touches that line anyway).

## Dependencies

None — pure frontend fix, no schema/migration. Ship in Phase 0 (no-migration quick win) alongside doc 21 (reports catalog exposure).
