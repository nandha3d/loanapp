# PERF-04 — Fix GPS Live Endpoint Query

**Priority:** 🟠 HIGH  
**Category:** Performance — N+1 / Full table scan  
**Effort:** 30 min

---

## Problem

`app/api/v1/gps/live/route.ts` fetches the latest ping for each agent with this pattern:

```typescript
const pings = await prisma.agentLocationPing.findMany({
  where: {
    tenantId: ctx.tenantId,
    agentId: { in: agents.map(a => a.id) },
    // time filter is COMMENTED OUT
  },
  orderBy: { capturedAt: 'desc' },
});
```

**Issues:**
1. **No time filter** — loads ALL pings ever for all agents. With 50 agents running for 1 year at 1 ping/minute, this is 26 million rows per request.
2. **In-memory dedup** — deduplication happens in JS, not DB. All 26M rows are transferred to Node RAM.
3. **No index on `(tenantId, agentId, capturedAt)`** — even with a time filter, this would be slow.

The time filter was commented out in the code with a note "// Optionally filter by recent pings only to avoid scanning large tables".

---

## Files Affected

- `app/api/v1/gps/live/route.ts`
- `prisma/schema.prisma` — add index on `AgentLocationPing`

---

## Step-by-Step Instructions for AI Agent

### Step 1 — Add DB index to schema

In `prisma/schema.prisma`, find the `AgentLocationPing` model. Add at the bottom:

```prisma
  @@index([tenantId, agentId, capturedAt(sort: Desc)])
```

Then run `npx prisma db push`.

### Step 2 — Rewrite the live query

Open `app/api/v1/gps/live/route.ts`. Replace the pings fetch block with a raw SQL query that gets the latest ping per agent in a single DB round trip:

```typescript
// Get latest ping per agent using a correlated subquery — single DB round trip.
// Falls back to graceful empty array if AgentLocationPing table is empty.
const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h lookback
const latestPings = await prisma.$queryRaw<Array<{
  agent_id:    string;
  lat:         number | null;
  lng:         number | null;
  accuracy:    number | null;
  captured_at: Date;
}>>`
  SELECT alp.agent_id, alp.lat, alp.lng, alp.accuracy, alp.captured_at
  FROM agent_location_pings alp
  INNER JOIN (
    SELECT agent_id, MAX(captured_at) AS max_at
    FROM agent_location_pings
    WHERE tenant_id = ${ctx.tenantId}
      AND captured_at >= ${cutoff}
    GROUP BY agent_id
  ) latest ON alp.agent_id = latest.agent_id AND alp.captured_at = latest.max_at
  WHERE alp.tenant_id = ${ctx.tenantId}
`;

// Build lookup map
const latestPingsMap = new Map(latestPings.map(p => [p.agent_id, p]));
```

Then update the result-mapping block to use `latestPingsMap.get(agent.id)` (note: key is `agent_id` not `agentId` from raw SQL — map accordingly).

### Step 3 — Remove the in-memory dedup loop

Delete the old `for (const ping of pings)` dedup loop — the SQL query already returns one row per agent.

### Step 4 — Update field name references

Raw SQL returns snake_case. Update the result mapper:

```typescript
const result = agents.map((agent) => {
  const ping   = latestPingsMap.get(agent.id);
  const coll   = collMap.get(agent.id);
  const online = ping != null && now - new Date(ping.captured_at).getTime() <= ONLINE_MS;
  return {
    agentId:        agent.id,
    agentName:      agent.name,
    agentPhone:     agent.phone,
    lat:            ping?.lat ?? null,
    lng:            ping?.lng ?? null,
    capturedAt:     ping?.captured_at ?? null,
    online,
    todayCollected: coll?.total ?? 0,
    todayEntries:   coll?.count ?? 0,
  };
});
```

### Step 5 — Apply same time filter to collectionEntry query

The `collectionEntry` fetch already has `submittedAt: { gte: todayStart }` — that's fine.

---

## Verification

- `GET /api/v1/gps/live` → returns correct data with max 1 row per agent
- MySQL `EXPLAIN` on the subquery shows index usage on `agent_location_pings`
- Response time improves from seconds to <100ms on large datasets
- `npx tsc --noEmit` → 0 errors
