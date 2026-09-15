# GPS Collection Tracking — Implementation Guide

**For:** ZoloFund Micro Lending — Admin, Superadmin, Field Agent Roles  
**Type:** Fraud Prevention & Operational Module  
**Purpose:** Location stamp every collection entry. Live route progress map for admin. Eliminate ghost collections.

---

## Table of Contents

1. [The Problem — What Ghost Collections Are](#1-the-problem--what-ghost-collections-are)
2. [What We Are Building](#2-what-we-are-building)
3. [Architecture Overview](#3-architecture-overview)
4. [How GPS Works in a Browser/PWA](#4-how-gps-works-in-a-browserpwa)
5. [Database Schema Changes](#5-database-schema-changes)
6. [Backend Implementation](#6-backend-implementation)
7. [Agent-Side Frontend — Location Capture](#7-agent-side-frontend--location-capture)
8. [Admin Live Map — Route Progress View](#8-admin-live-map--route-progress-view)
9. [Location Verification Logic](#9-location-verification-logic)
10. [Privacy & Legal Considerations](#10-privacy--legal-considerations)
11. [Offline Handling](#11-offline-handling)
12. [API Routes](#12-api-routes)
13. [Prisma Schema Changes](#13-prisma-schema-changes)
14. [Hostinger VPS — Real-time with SSE](#14-hostinger-vps--real-time-with-sse)
15. [Testing Strategy](#15-testing-strategy)
16. [Rollout Plan](#16-rollout-plan)

---

## 1. The Problem — What Ghost Collections Are

A **ghost collection** is when an agent records a payment in the system without physically visiting the borrower. This happens when:

- An agent fabricates a collection entry from home or the office
- An agent collects cash from a borrower but enters it in the system days later from a different location
- A manager enters collections on behalf of agents who were absent
- An agent collects, pockets the cash, then enters a zero or partial amount from anywhere

Without location data, there is no way to distinguish a legitimate field collection from a fabricated one. The system only has a timestamp and an amount — both trivially faked.

### The Scale of the Problem in Indian MFI Field Operations

- Industry estimates put field agent fraud at 3–8% of MFI portfolios
- Ghost collections are the most common fraud vector — easier than forging KYC documents
- The fraud typically surfaces only during borrower verification audits or when overdue amounts suddenly spike
- By the time it is discovered, the agent has fabricated dozens of entries across weeks or months

### What GPS Tracking Solves

GPS does not eliminate fraud entirely, but it creates a verifiable paper trail that:

1. **Deters fraud** — agents know every collection entry is stamped with coordinates
2. **Enables anomaly detection** — admin can flag entries where GPS coordinates are far from the borrower's registered address
3. **Supports audit** — every collection has an evidence record showing where the agent was
4. **Provides live oversight** — admin sees route progress in real time, not just end-of-day reconciliation

---

## 2. What We Are Building

### Agent Side

```
When agent clicks "Submit" on a collection entry:
  → App requests GPS coordinates from device
  → Coordinates are captured and sent with the collection entry
  → If GPS is denied or unavailable: entry is flagged, not blocked
  → Agent sees a small location indicator confirming capture
```

### Admin Side

```
Admin opens "Route Tracker" view:
  → Sees all agents on their branch as pins on a map
  → Each pin shows: agent name, last seen time, collections done today
  → Clicking an agent shows their route path for the day
  → Red pins = agent has not moved in > 2 hours during working hours
  → Entries flagged as location-mismatched are highlighted
```

### Passive Background Tracking (Optional, Consent-Based)

```
When agent is on duty (opted in):
  → App sends a GPS heartbeat every 10 minutes
  → Admin sees smooth route path, not just collection points
  → Agent can pause tracking (lunch break, personal time)
```

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Agent Device                               │
│                      (Mobile Browser / PWA)                         │
│                                                                      │
│  ┌─────────────────┐      ┌──────────────────────────────────────┐  │
│  │  Collection     │      │  Background GPS Heartbeat            │  │
│  │  Modal Submit   │      │  (every 10 min, when on duty)        │  │
│  │                 │      │                                      │  │
│  │  navigator      │      │  Queues in localStorage if offline   │  │
│  │  .geolocation   │      │  Syncs when connectivity restored    │  │
│  │  .getCurrentPos │      │                                      │  │
│  └────────┬────────┘      └──────────────┬───────────────────────┘  │
│           │                              │                           │
└───────────┼──────────────────────────────┼───────────────────────────┘
            │  HTTPS POST                  │  HTTPS POST
            ▼                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Hostinger VPS                                 │
│                      Next.js App Server                             │
│                                                                      │
│  /api/collection          → saves lat/lng with entry                │
│  /api/gps/heartbeat       → saves location ping                     │
│  /api/gps/route-progress  → SSE stream for admin live map          │
│                                                                      │
│  Location Verifier        → compares entry coords vs               │
│                             borrower address coords                 │
└─────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────┐   ┌──────────────────────────────────────┐
│   PostgreSQL             │   │  Admin Map UI                        │
│                          │   │  (Leaflet.js — free, no API key)     │
│  CollectionEntry         │   │                                      │
│  + lat, lng, accuracy    │   │  Live agent pins                     │
│  + locationStatus        │   │  Route path polyline                 │
│                          │   │  Mismatch flags                      │
│  AgentLocationPing       │   │  Collection point markers            │
│  (heartbeat log)         │   └──────────────────────────────────────┘
└──────────────────────────┘
```

### Map Provider Decision — Leaflet + OpenStreetMap

Do not use Google Maps. It requires a billing account and charges per map load. For a field operations map used internally by admins:

- **Leaflet.js** (open source, free) + **OpenStreetMap tiles** (free for reasonable usage) = zero cost
- Sufficient accuracy and detail for Indian districts and rural areas
- No API key required
- Works offline with tile caching if needed later

---

## 4. How GPS Works in a Browser/PWA

### The Browser Geolocation API

```javascript
// This is what runs on the agent's phone when they submit a collection
navigator.geolocation.getCurrentPosition(
  (position) => {
    const { latitude, longitude, accuracy } = position.coords
    // accuracy is in metres — < 50m is good, > 200m is poor
  },
  (error) => {
    // PERMISSION_DENIED (1), POSITION_UNAVAILABLE (2), TIMEOUT (3)
  },
  {
    enableHighAccuracy: true,   // use GPS chip, not just cell tower
    timeout: 10000,             // wait max 10 seconds
    maximumAge: 60000,          // accept a cached position up to 1 min old
  }
)
```

### Accuracy Expectations in Field Conditions

| Condition | Typical Accuracy | Usable? |
|---|---|---|
| Outdoor, clear sky, GPS on | 3–15 metres | Excellent |
| Outdoor, GPS + mobile network | 15–50 metres | Good |
| Indoor / ground floor | 30–100 metres | Acceptable |
| Dense urban canyon (tall buildings) | 50–200 metres | Marginal |
| Rural with weak signal, GPS off | 200–2000 metres (cell tower only) | Poor — flag it |

### Permission Model

The agent must grant location permission once. After that the browser remembers it. If they deny:

- Do **not** block the collection submission
- Flag the entry as `location_denied`
- Admin sees it differently from a normal entry — not the same as a clean collection

---

## 5. Database Schema Changes

### Extend CollectionEntry

```prisma
model CollectionEntry {
  // ── existing fields (unchanged) ──
  id              String   @id @default(cuid())
  tenantId        String
  loanId          String
  instalmentId    String
  agentId         String
  receivedAmount  Decimal
  paymentMode     String
  createdAt       DateTime @default(now())

  // ── GPS fields (new) ──
  latitude          Float?     // decimal degrees, e.g. 13.0827
  longitude         Float?     // decimal degrees, e.g. 80.2707
  gpsAccuracy       Float?     // metres — lower is better
  gpsTimestamp      DateTime?  // when the fix was captured (device time)
  gpsAltitude       Float?     // metres above sea level (optional)

  // ── Location verification ──
  locationStatus    String  @default("not_captured")
  // 'verified'        — coords within threshold of borrower address
  // 'mismatch'        — coords too far from borrower address
  // 'unverifiable'    — borrower has no geocoded address on file
  // 'location_denied' — agent denied GPS permission
  // 'gps_timeout'     — GPS timed out on device
  // 'not_captured'    — old entries before GPS feature shipped

  distanceFromBorrower Float? // calculated distance in metres
  borrowerLat          Float? // snapshot of borrower coords at time of entry
  borrowerLng          Float? // (in case borrower address is later changed)

  @@index([agentId, createdAt])
  @@index([tenantId, locationStatus])
}
```

### New Table: AgentLocationPing

```prisma
// Background heartbeat pings — builds the route path for admin map
model AgentLocationPing {
  id          String    @id @default(cuid())
  tenantId    String
  agentId     String
  latitude    Float
  longitude   Float
  accuracy    Float?
  pingType    String    // 'heartbeat' | 'collection' | 'duty_start' | 'duty_end'
  deviceTime  DateTime  // timestamp from device
  serverTime  DateTime  @default(now())
  isOnDuty    Boolean   @default(true)

  agent       User      @relation(fields: [agentId], references: [id])

  @@index([agentId, serverTime])
  @@index([tenantId, serverTime])
  @@map("agent_location_pings")
}
```

### New Table: CustomerGeocode

```prisma
// Geocoded coordinates for borrower addresses
// Used for distance verification at collection time
model CustomerGeocode {
  id          String    @id @default(cuid())
  customerId  String    @unique
  latitude    Float
  longitude   Float
  accuracy    String    // 'rooftop' | 'street' | 'approximate' | 'district'
  source      String    // 'manual' | 'google_geocoding' | 'opencage' | 'mapbox'
  rawAddress  String    // the address string that was geocoded
  geocodedAt  DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  customer    Customer  @relation(fields: [customerId], references: [id])

  @@map("customer_geocodes")
}
```

---

## 6. Backend Implementation

### `lib/gps/locationVerifier.ts`

```typescript
/**
 * Verifies whether a collection entry's GPS coordinates are
 * consistent with the borrower's registered address.
 *
 * Uses the Haversine formula — no external API call needed.
 * Pure math, works offline, zero cost.
 */

export type LocationStatus =
  | 'verified'
  | 'mismatch'
  | 'unverifiable'
  | 'location_denied'
  | 'gps_timeout'
  | 'not_captured'

export interface LocationVerificationResult {
  status: LocationStatus
  distanceMetres: number | null
  thresholdMetres: number
  withinThreshold: boolean
}

// How far from borrower address is acceptable
// 500m covers a typical field collection block
// Adjustable per tenant in settings
const DEFAULT_THRESHOLD_METRES = 500

/**
 * Haversine formula — calculates distance between two GPS coordinates.
 * Returns distance in metres.
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000 // Earth radius in metres
  const toRad = (x: number) => (x * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function verifyCollectionLocation(
  agentLat: number | null,
  agentLng: number | null,
  customerId: string,
  tenantId: string
): Promise<LocationVerificationResult> {

  // No coordinates captured — return not_captured (not mismatch)
  if (agentLat === null || agentLng === null) {
    return { status: 'not_captured', distanceMetres: null, thresholdMetres: DEFAULT_THRESHOLD_METRES, withinThreshold: false }
  }

  // Look up borrower's geocoded address
  const geocode = await prisma.customerGeocode.findUnique({
    where: { customerId }
  })

  if (!geocode) {
    return { status: 'unverifiable', distanceMetres: null, thresholdMetres: DEFAULT_THRESHOLD_METRES, withinThreshold: false }
  }

  // Get tenant's configured threshold (if customised)
  const settings = await getTenantGpsSettings(tenantId)
  const threshold = settings?.gpsThresholdMetres ?? DEFAULT_THRESHOLD_METRES

  const distance = haversineDistance(agentLat, agentLng, geocode.latitude, geocode.longitude)
  const withinThreshold = distance <= threshold

  return {
    status: withinThreshold ? 'verified' : 'mismatch',
    distanceMetres: Math.round(distance),
    thresholdMetres: threshold,
    withinThreshold,
    borrowerLat: geocode.latitude,
    borrowerLng: geocode.longitude,
  }
}
```

### `lib/gps/geocoder.ts` — Borrower Address Geocoding

```typescript
/**
 * Geocodes a customer's address when they are created or edited.
 * Uses OpenCage Geocoding API (free tier: 2,500 requests/day).
 * Fallback: Nominatim (OpenStreetMap) — completely free, rate limited to 1 req/sec.
 *
 * This runs as a background job — does NOT block customer creation.
 */
export async function geocodeCustomerAddress(customerId: string): Promise<void> {
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: customerId },
    select: { address: true, city: true, pincode: true, state: true }
  })

  const addressString = [
    customer.address,
    customer.city,
    customer.pincode,
    customer.state,
    'India'
  ].filter(Boolean).join(', ')

  try {
    const coords = await geocodeWithNominatim(addressString)

    if (coords) {
      await prisma.customerGeocode.upsert({
        where: { customerId },
        update: {
          latitude: coords.lat,
          longitude: coords.lng,
          accuracy: coords.accuracy,
          rawAddress: addressString,
          geocodedAt: new Date(),
        },
        create: {
          customerId,
          latitude: coords.lat,
          longitude: coords.lng,
          accuracy: coords.accuracy,
          source: 'nominatim',
          rawAddress: addressString,
        }
      })
    }
  } catch (err) {
    // Geocoding failure should never block customer creation
    console.error(`Geocoding failed for customer ${customerId}:`, err)
  }
}

async function geocodeWithNominatim(
  address: string
): Promise<{ lat: number; lng: number; accuracy: string } | null> {
  const encoded = encodeURIComponent(address)

  // Nominatim requires a User-Agent identifying your app
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=in`,
    {
      headers: {
        'User-Agent': 'ZoloFund/1.0 (contact@yourdomain.com)',
      }
    }
  )

  const data = await response.json()
  if (!data || data.length === 0) return null

  const result = data[0]
  return {
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    accuracy: result.type === 'house' ? 'rooftop'
      : result.type === 'road' ? 'street'
      : result.addresstype === 'postcode' ? 'approximate'
      : 'district'
  }
}
```

### `lib/gps/routeProgress.ts` — Route Progress for Admin Map

```typescript
export interface AgentRouteProgress {
  agentId: string
  agentName: string
  isOnDuty: boolean
  lastSeenAt: Date | null
  lastLocation: { lat: number; lng: number } | null
  minutesSinceLastPing: number | null
  collectionsToday: number
  collectionsDoneToday: number
  totalDueToday: number
  totalCollectedToday: number
  path: Array<{ lat: number; lng: number; time: Date; type: string }>
  collectionPoints: Array<{
    lat: number
    lng: number
    time: Date
    customerName: string
    amount: number
    locationStatus: string
  }>
  alerts: string[]  // 'not_moved_2h' | 'multiple_mismatches' | 'offline_30m'
}

export async function getRouteProgressForBranch(
  tenantId: string,
  branchId: string,
  date: Date = new Date()
): Promise<AgentRouteProgress[]> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const agents = await prisma.user.findMany({
    where: {
      tenantId,
      branchId,
      role: 'AGENT',
      deletedAt: null,
    },
    select: { id: true, name: true }
  })

  const results: AgentRouteProgress[] = []

  for (const agent of agents) {
    // Get location pings for today
    const pings = await prisma.agentLocationPing.findMany({
      where: {
        agentId: agent.id,
        serverTime: { gte: startOfDay, lte: endOfDay }
      },
      orderBy: { serverTime: 'asc' }
    })

    // Get collection entries with GPS for today
    const collections = await prisma.collectionEntry.findMany({
      where: {
        agentId: agent.id,
        createdAt: { gte: startOfDay, lte: endOfDay },
        latitude: { not: null }
      },
      select: {
        latitude: true, longitude: true, createdAt: true,
        receivedAmount: true, locationStatus: true,
        instalment: {
          select: {
            loan: { select: { customer: { select: { name: true } } } }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    const lastPing = pings[pings.length - 1]
    const now = new Date()
    const minutesSinceLastPing = lastPing
      ? Math.floor((now.getTime() - lastPing.serverTime.getTime()) / 60000)
      : null

    // Build alerts
    const alerts: string[] = []
    if (minutesSinceLastPing !== null && minutesSinceLastPing > 120) {
      alerts.push('not_moved_2h')
    }
    if (minutesSinceLastPing !== null && minutesSinceLastPing > 30) {
      alerts.push('offline_30m')
    }
    const mismatchCount = collections.filter(c => c.locationStatus === 'mismatch').length
    if (mismatchCount >= 3) alerts.push('multiple_mismatches')

    results.push({
      agentId: agent.id,
      agentName: agent.name,
      isOnDuty: pings.some(p => p.pingType === 'duty_start'),
      lastSeenAt: lastPing?.serverTime ?? null,
      lastLocation: lastPing ? { lat: lastPing.latitude, lng: lastPing.longitude } : null,
      minutesSinceLastPing,
      collectionsToday: collections.length,
      collectionsDoneToday: collections.length,
      totalDueToday: 0,  // calculated separately from instalment schedule
      totalCollectedToday: collections.reduce((s, c) => s + Number(c.receivedAmount), 0),
      path: pings.map(p => ({ lat: p.latitude, lng: p.longitude, time: p.serverTime, type: p.pingType })),
      collectionPoints: collections.map(c => ({
        lat: c.latitude!,
        lng: c.longitude!,
        time: c.createdAt,
        customerName: c.instalment?.loan?.customer?.name ?? 'Unknown',
        amount: Number(c.receivedAmount),
        locationStatus: c.locationStatus,
      })),
      alerts,
    })
  }

  return results
}
```

---

## 7. Agent-Side Frontend — Location Capture

### `lib/gps/useAgentLocation.ts` — React Hook

```typescript
'use client'
import { useState, useCallback } from 'react'

export type GpsState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'captured'; lat: number; lng: number; accuracy: number; timestamp: number }
  | { status: 'denied' }
  | { status: 'timeout' }
  | { status: 'unavailable' }

export function useAgentLocation() {
  const [gpsState, setGpsState] = useState<GpsState>({ status: 'idle' })

  const captureLocation = useCallback((): Promise<GpsState> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const state: GpsState = { status: 'unavailable' }
        setGpsState(state)
        resolve(state)
        return
      }

      setGpsState({ status: 'requesting' })

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const state: GpsState = {
            status: 'captured',
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          }
          setGpsState(state)
          resolve(state)
        },
        (error) => {
          const state: GpsState = {
            status: error.code === GeolocationPositionError.PERMISSION_DENIED
              ? 'denied'
              : error.code === GeolocationPositionError.TIMEOUT
              ? 'timeout'
              : 'unavailable'
          }
          setGpsState(state)
          resolve(state)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      )
    })
  }, [])

  return { gpsState, captureLocation }
}
```

### Modified Collection Modal Submit Handler

```tsx
// In CollectionClient.tsx — modify the existing handleSubmit

import { useAgentLocation } from '@/lib/gps/useAgentLocation'

export function CollectionModal({ instalment, onClose }: CollectionModalProps) {
  const { gpsState, captureLocation } = useAgentLocation()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(formData: CollectionFormData) {
    setSubmitting(true)

    // 1. Capture GPS — runs in parallel with form validation
    //    Do NOT await this before starting — start it immediately
    const locationPromise = captureLocation()

    // 2. Validate form data
    if (!formData.amount || formData.amount <= 0) {
      setSubmitting(false)
      return showError('Invalid amount')
    }

    // 3. Wait for GPS (max 10 seconds — already set in hook)
    const location = await locationPromise

    // 4. Build submission payload
    const payload = {
      instalmentId: instalment.id,
      receivedAmount: formData.amount,
      paymentMode: formData.paymentMode,
      remarks: formData.remarks,
      // GPS data — always include, even if denied
      gps: {
        latitude:  location.status === 'captured' ? location.lat : null,
        longitude: location.status === 'captured' ? location.lng : null,
        accuracy:  location.status === 'captured' ? location.accuracy : null,
        timestamp: location.status === 'captured' ? location.timestamp : null,
        status:    location.status,  // 'captured' | 'denied' | 'timeout' | 'unavailable'
      }
    }

    try {
      await submitCollectionEntry(payload)
      onClose()
    } catch (err) {
      showError('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal>
      {/* Existing form fields */}

      {/* GPS Status Indicator */}
      <GpsStatusIndicator state={gpsState} />

      <button onClick={() => handleSubmit(formData)} disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit Collection'}
      </button>
    </Modal>
  )
}
```

### GPS Status Indicator Component

```tsx
// components/gps/GpsStatusIndicator.tsx
// Small indicator shown in the collection modal

import type { GpsState } from '@/lib/gps/useAgentLocation'

const STATUS_CONFIG = {
  idle:        { icon: '○', text: 'Waiting for location…',      color: '#6b7280' },
  requesting:  { icon: '◌', text: 'Getting your location…',     color: '#3b82f6', animate: true },
  captured:    { icon: '●', text: 'Location captured',           color: '#16a34a' },
  denied:      { icon: '✕', text: 'Location access denied',      color: '#d97706' },
  timeout:     { icon: '⏱', text: 'Location timed out',          color: '#d97706' },
  unavailable: { icon: '—', text: 'Location unavailable',        color: '#6b7280' },
}

export function GpsStatusIndicator({ state }: { state: GpsState }) {
  const config = STATUS_CONFIG[state.status]

  return (
    <div className="gps-indicator" style={{ color: config.color }}>
      <span className={`gps-icon ${config.animate ? 'pulse' : ''}`}>
        {config.icon}
      </span>
      <span className="gps-text">{config.text}</span>
      {state.status === 'captured' && (
        <span className="gps-accuracy">
          ±{Math.round((state as any).accuracy)}m
        </span>
      )}
      {state.status === 'denied' && (
        <span className="gps-hint">
          This entry will be flagged for review
        </span>
      )}
    </div>
  )
}
```

### Background Heartbeat — `lib/gps/heartbeat.ts`

```typescript
'use client'

let heartbeatInterval: NodeJS.Timeout | null = null

/**
 * Starts sending GPS pings every 10 minutes while agent is on duty.
 * Queues in localStorage if offline — syncs when online.
 * Must be called when agent marks themselves as "on duty" for the day.
 */
export function startGpsHeartbeat(agentId: string) {
  if (heartbeatInterval) return  // already running

  sendPing(agentId, 'duty_start')

  heartbeatInterval = setInterval(() => {
    sendPing(agentId, 'heartbeat')
  }, 10 * 60 * 1000)  // every 10 minutes

  // Flush queued offline pings when connection restores
  window.addEventListener('online', () => flushOfflineQueue())
}

export function stopGpsHeartbeat(agentId: string) {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
  sendPing(agentId, 'duty_end')
}

async function sendPing(agentId: string, type: string) {
  if (!navigator.geolocation) return

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const ping = {
        latitude:   pos.coords.latitude,
        longitude:  pos.coords.longitude,
        accuracy:   pos.coords.accuracy,
        pingType:   type,
        deviceTime: new Date(pos.timestamp).toISOString(),
      }

      if (!navigator.onLine) {
        queueOfflinePing(ping)
        return
      }

      try {
        await fetch('/api/gps/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ping),
        })
      } catch {
        queueOfflinePing(ping)
      }
    },
    undefined,
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }
    // Lower accuracy for heartbeat is fine — saves battery
  )
}

function queueOfflinePing(ping: object) {
  const queue = JSON.parse(localStorage.getItem('gps_queue') ?? '[]')
  queue.push(ping)
  // Keep at most 50 queued pings — older ones drop off
  localStorage.setItem('gps_queue', JSON.stringify(queue.slice(-50)))
}

async function flushOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem('gps_queue') ?? '[]')
  if (queue.length === 0) return

  for (const ping of queue) {
    try {
      await fetch('/api/gps/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ping),
      })
    } catch { break }  // stop if still offline
  }

  localStorage.removeItem('gps_queue')
}
```

---

## 8. Admin Live Map — Route Progress View

### `app/(dashboard)/route-tracker/page.tsx`

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

// Leaflet must be loaded client-side only (no SSR)
const RouteMap = dynamic(() => import('@/components/map/RouteMap'), { ssr: false })

export default function RouteTrackerPage() {
  const [agents, setAgents] = useState<AgentRouteProgress[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Use SSE for live updates on Hostinger VPS
  useEffect(() => {
    const source = new EventSource('/api/gps/route-progress')

    source.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setAgents(data.agents)
      setLastUpdated(new Date())
    }

    source.onerror = () => {
      // Reconnect automatically — browser SSE spec handles this
      console.warn('SSE connection lost, will reconnect...')
    }

    return () => source.close()
  }, [])

  return (
    <div className="route-tracker">

      {/* Header */}
      <div className="tracker-header">
        <h2>Live Route Tracker</h2>
        <span className="last-updated">
          Updated: {lastUpdated?.toLocaleTimeString('en-IN') ?? '—'}
        </span>
        <AgentAlertBanner agents={agents} />
      </div>

      {/* Agent Sidebar */}
      <div className="tracker-layout">
        <div className="agent-list">
          {agents.map(agent => (
            <AgentCard
              key={agent.agentId}
              agent={agent}
              selected={selectedAgent === agent.agentId}
              onClick={() => setSelectedAgent(agent.agentId)}
            />
          ))}
        </div>

        {/* Map */}
        <div className="map-container">
          <RouteMap
            agents={agents}
            selectedAgentId={selectedAgent}
          />
        </div>
      </div>
    </div>
  )
}

function AgentCard({ agent, selected, onClick }: AgentCardProps) {
  const hasAlerts = agent.alerts.length > 0
  return (
    <div
      className={`agent-card ${selected ? 'selected' : ''} ${hasAlerts ? 'has-alert' : ''}`}
      onClick={onClick}
    >
      <div className="agent-name">{agent.agentName}</div>
      <div className="agent-stats">
        <span>{agent.collectionsDoneToday} collections</span>
        <span>₹{agent.totalCollectedToday.toLocaleString('en-IN')}</span>
      </div>
      <div className="agent-ping">
        {agent.minutesSinceLastPing !== null
          ? `${agent.minutesSinceLastPing}m ago`
          : 'No ping today'}
      </div>
      {hasAlerts && (
        <div className="alert-badges">
          {agent.alerts.includes('not_moved_2h') && <span className="badge red">Stationary 2h</span>}
          {agent.alerts.includes('multiple_mismatches') && <span className="badge orange">3+ Mismatches</span>}
          {agent.alerts.includes('offline_30m') && <span className="badge grey">Offline 30m</span>}
        </div>
      )}
    </div>
  )
}
```

### `components/map/RouteMap.tsx` — Leaflet Map Component

```tsx
'use client'
import { useEffect, useRef } from 'react'
import type { Map, Marker, Polyline } from 'leaflet'

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '© OpenStreetMap contributors'

// Marker colours by location status
const MARKER_COLORS = {
  verified:        '#16a34a',  // green
  mismatch:        '#dc2626',  // red
  unverifiable:    '#6b7280',  // grey
  location_denied: '#d97706',  // amber
  gps_timeout:     '#d97706',
  not_captured:    '#6b7280',
}

export default function RouteMap({ agents, selectedAgentId }: RouteMapProps) {
  const mapRef = useRef<Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Dynamically import Leaflet (no SSR)
    import('leaflet').then(L => {
      // Centre on India by default
      const map = L.map(containerRef.current!).setView([20.5937, 78.9629], 5)

      L.tileLayer(TILE_URL, { attribution: ATTRIBUTION }).addTo(map)
      mapRef.current = map
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Redraw when agents or selection changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    import('leaflet').then(L => {
      // Clear previous layers
      map.eachLayer(layer => {
        if ((layer as any)._zolofundLayer) map.removeLayer(layer)
      })

      const agentsToShow = selectedAgentId
        ? agents.filter(a => a.agentId === selectedAgentId)
        : agents

      for (const agent of agentsToShow) {
        // Route path polyline
        if (agent.path.length > 1) {
          const polyline = L.polyline(
            agent.path.map(p => [p.lat, p.lng]),
            { color: '#3b82f6', weight: 3, opacity: 0.7 }
          )
          ;(polyline as any)._zolofundLayer = true
          polyline.addTo(map)
        }

        // Current location marker (large, agent name)
        if (agent.lastLocation) {
          const agentIcon = L.divIcon({
            html: `<div class="agent-pin">${agent.agentName.split(' ')[0]}</div>`,
            className: '',
            iconSize: [60, 24],
          })
          const marker = L.marker([agent.lastLocation.lat, agent.lastLocation.lng], { icon: agentIcon })
          ;(marker as any)._zolofundLayer = true
          marker.bindTooltip(`${agent.agentName} — last seen ${agent.minutesSinceLastPing}m ago`)
          marker.addTo(map)
        }

        // Collection point markers
        for (const cp of agent.collectionPoints) {
          const color = MARKER_COLORS[cp.locationStatus as keyof typeof MARKER_COLORS] ?? '#6b7280'
          const cpIcon = L.divIcon({
            html: `<div class="collection-dot" style="background:${color}"></div>`,
            className: '',
            iconSize: [12, 12],
          })
          const m = L.marker([cp.lat, cp.lng], { icon: cpIcon })
          ;(m as any)._zolofundLayer = true
          m.bindPopup(`
            <b>${cp.customerName}</b><br/>
            ₹${cp.amount.toLocaleString('en-IN')}<br/>
            ${cp.time.toLocaleTimeString('en-IN')}<br/>
            <span style="color:${color}">${cp.locationStatus}</span>
          `)
          m.addTo(map)
        }
      }

      // Fit map to show selected agent's path
      if (selectedAgentId) {
        const selected = agents.find(a => a.agentId === selectedAgentId)
        if (selected?.path.length) {
          map.fitBounds(selected.path.map(p => [p.lat, p.lng] as [number, number]))
        }
      }
    })
  }, [agents, selectedAgentId])

  return <div ref={containerRef} style={{ height: '100%', width: '100%', minHeight: '500px' }} />
}
```

---

## 9. Location Verification Logic

### Distance Threshold Configuration

Different lenders need different thresholds:

```typescript
// In tenant settings — admin can adjust
interface GpsSettings {
  gpsThresholdMetres: number    // default: 500m
  gpsEnforced: boolean          // if true: warn admin. Never hard-block agent.
  requireGpsForCash: boolean    // cash collections always need GPS
  requireGpsForUpi: boolean     // UPI may be more flexible (true by default)
  heartbeatEnabled: boolean     // background pings enabled
  heartbeatIntervalMinutes: number  // default: 10
}
```

### Mismatch Handling Policy

**Critical design decision: GPS mismatch must NEVER block a collection submission.**

Here is why: An agent collecting from a borrower in a ground-floor flat in a dense urban area may get GPS coordinates 300m off. Blocking their collection means the borrower goes unserved, the agent cannot do their job, and the lender loses the payment. The GPS flag is for admin review, not for real-time gatekeeping.

```typescript
// In submitCollectionEntry action:
// Step 1: Save the collection (never block)
// Step 2: Verify location asynchronously
// Step 3: Update locationStatus on the saved entry

export async function submitCollectionEntry(data: CollectionEntryInput) {
  // 1. Save the entry immediately — never block on GPS
  const entry = await prisma.collectionEntry.create({
    data: {
      ...coreFields,
      latitude: data.gps.latitude,
      longitude: data.gps.longitude,
      gpsAccuracy: data.gps.accuracy,
      gpsTimestamp: data.gps.timestamp ? new Date(data.gps.timestamp) : null,
      locationStatus: data.gps.status === 'captured' ? 'pending_verification' : data.gps.status,
    }
  })

  // 2. Verify location in background (non-blocking)
  if (data.gps.latitude && data.gps.longitude) {
    verifyCollectionLocation(
      data.gps.latitude,
      data.gps.longitude,
      data.customerId,
      data.tenantId
    ).then(async (result) => {
      await prisma.collectionEntry.update({
        where: { id: entry.id },
        data: {
          locationStatus: result.status,
          distanceFromBorrower: result.distanceMetres,
          borrowerLat: result.borrowerLat ?? null,
          borrowerLng: result.borrowerLng ?? null,
        }
      })
    }).catch(err => console.error('Location verification failed:', err))
  }

  return entry
}
```

### Anomaly Report

Run nightly to surface suspicious patterns:

```typescript
export async function generateLocationAnomalyReport(
  tenantId: string,
  date: Date
): Promise<AnomalyReport> {
  const startOfDay = getStartOfDay(date)
  const endOfDay = getEndOfDay(date)

  // Flag 1: Entries with no GPS at all
  const noGps = await prisma.collectionEntry.count({
    where: { tenantId, createdAt: { gte: startOfDay, lte: endOfDay }, locationStatus: 'not_captured' }
  })

  // Flag 2: Entries with GPS denied
  const gpsDenied = await prisma.collectionEntry.count({
    where: { tenantId, createdAt: { gte: startOfDay, lte: endOfDay }, locationStatus: 'location_denied' }
  })

  // Flag 3: Mismatches > 500m from borrower
  const mismatches = await prisma.collectionEntry.findMany({
    where: { tenantId, createdAt: { gte: startOfDay, lte: endOfDay }, locationStatus: 'mismatch' },
    select: { agentId: true, distanceFromBorrower: true, receivedAmount: true,
              instalment: { select: { loan: { select: { customer: { select: { name: true } } } } } } }
  })

  // Flag 4: Agents with multiple collections from same GPS point
  // (same coordinates within 10m for 3+ collections = likely fabricated from one spot)
  const suspiciousClusters = await detectLocationClusters(tenantId, startOfDay, endOfDay)

  return { noGps, gpsDenied, mismatches, suspiciousClusters, date }
}
```

---

## 10. Privacy & Legal Considerations

### What Indian Law Requires

Under the **Digital Personal Data Protection Act (DPDP), 2023**, location data is personal data. You must:

1. Obtain explicit consent from the agent before collecting their location
2. Disclose the purpose (fraud prevention, route monitoring)
3. Not retain location data longer than necessary
4. Allow agents to withdraw consent (which means they work without GPS tracking — accepted as a policy decision by the lender)

### Consent Flow at First Login

```tsx
// Shown once at first login after GPS feature is enabled
function GpsConsentModal({ onAccept, onDecline }: GpsConsentProps) {
  return (
    <Modal title="Location Tracking Consent">
      <p>
        To prevent fraud and verify field collections, this app records
        your GPS location when you submit a collection entry.
      </p>
      <p>
        Your location is also periodically recorded during working hours
        to help your manager view route progress.
      </p>
      <p>
        Location data is used only for work verification purposes and
        is not shared with third parties.
      </p>
      <p>
        You may decline, but collections submitted without location data
        will be flagged for manual review by your manager.
      </p>
      <button onClick={onAccept}>I Understand and Agree</button>
      <button onClick={onDecline}>Decline</button>
    </Modal>
  )
}
```

### Data Retention Policy

```typescript
// Cron job: delete location pings older than 90 days
// Collection entry GPS coordinates: retain for 7 years (matches audit retention)
// AgentLocationPing: delete after 90 days

// Add to existing cron schedule:
// 0 3 * * * curl -X POST .../api/cron/purge-location-pings
export async function purgeOldLocationPings() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  await prisma.agentLocationPing.deleteMany({
    where: { serverTime: { lt: cutoff } }
  })
}
```

---

## 11. Offline Handling

Field agents in rural India frequently lose connectivity. The GPS module must handle this gracefully:

### Collection Entry Offline Handling

```typescript
// Already handled by Next.js server actions failing gracefully
// The existing offline queue in lib/gps/heartbeat.ts handles heartbeats
// For collection entries, the existing retry logic in CollectionClient.tsx applies
// GPS coordinates captured at submission time are stored in the form state
// When the entry syncs (on reconnect), GPS data goes with it
```

### Service Worker for PWA (Optional Phase 2)

If you convert the agent-facing collection page to a PWA:

```javascript
// service-worker.js — cache the collection page for offline use
// Queue collection submissions when offline, sync when online
// This is a Phase 2 item — requires PWA manifest setup

self.addEventListener('sync', event => {
  if (event.tag === 'sync-collections') {
    event.waitUntil(syncQueuedCollections())
  }
})
```

---

## 12. API Routes

### `app/api/gps/heartbeat/route.ts`

```typescript
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Only agents send heartbeats
  assertRole(session.user.role, ['AGENT'])

  const body = await req.json()
  const { latitude, longitude, accuracy, pingType, deviceTime } = body

  if (!latitude || !longitude) {
    return NextResponse.json({ success: false, error: 'lat/lng required' }, { status: 400 })
  }

  await prisma.agentLocationPing.create({
    data: {
      tenantId: session.user.tenantId,
      agentId: session.user.id,
      latitude,
      longitude,
      accuracy: accuracy ?? null,
      pingType: pingType ?? 'heartbeat',
      deviceTime: deviceTime ? new Date(deviceTime) : new Date(),
      isOnDuty: true,
    }
  })

  return NextResponse.json({ success: true })
}
```

### `app/api/gps/route-progress/route.ts` — SSE Stream

```typescript
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  assertRole(session.user.role, ['ADMIN', 'SUPERADMIN'])

  const encoder = new TextEncoder()

  // Server-Sent Events — works perfectly on Hostinger VPS
  // (long-lived HTTP connection — not possible on serverless)
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  async function sendUpdate() {
    const progress = await getRouteProgressForBranch(
      session.user.tenantId,
      session.user.branchId
    )
    const data = `data: ${JSON.stringify({ agents: progress })}\n\n`
    await writer.write(encoder.encode(data))
  }

  // Send immediately
  await sendUpdate()

  // Then every 60 seconds
  const interval = setInterval(sendUpdate, 60000)

  req.signal.addEventListener('abort', () => {
    clearInterval(interval)
    writer.close()
  })

  return new Response(stream.readable, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',  // important for Nginx on Hostinger VPS
    }
  })
}
```

> **Hostinger VPS Nginx config** — SSE requires disabling proxy buffering.  
> Add to your Nginx site config:

```nginx
location /api/gps/route-progress {
    proxy_pass http://localhost:3000;
    proxy_buffering off;
    proxy_cache off;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    chunked_transfer_encoding on;
}
```

---

## 13. Prisma Schema Changes

```prisma
// Extend CollectionEntry (additions only):
latitude              Float?
longitude             Float?
gpsAccuracy           Float?
gpsTimestamp          DateTime?
gpsAltitude           Float?
locationStatus        String    @default("not_captured")
distanceFromBorrower  Float?
borrowerLat           Float?
borrowerLng           Float?

@@index([tenantId, locationStatus])

// New models:
model AgentLocationPing  { ... }   // heartbeat log
model CustomerGeocode    { ... }   // borrower address coordinates

// Migration:
// npx prisma migrate dev --name add_gps_collection_tracking
```

---

## 14. Hostinger VPS — Real-time with SSE

SSE is the right real-time technology choice for this use case on Hostinger VPS because:

| Factor | SSE | WebSocket | Polling |
|---|---|---|---|
| Works on VPS (persistent connection) | ✅ | ✅ | ✅ |
| Works on serverless | ❌ | ❌ | ✅ |
| Browser reconnects automatically | ✅ | ❌ | N/A |
| One-way (server → client) sufficient? | ✅ (map only needs this) | Overkill | ✅ |
| Nginx config required | Minimal | More complex | None |
| Implementation complexity | Low | High | Trivial |

For a live map that refreshes every 60 seconds, SSE is ideal. The admin browser receives map updates; it never needs to send data back on this channel.

---

## 15. Testing Strategy

| TC ID | What to Test |
|---|---|
| ML-2101 | Collection entry saved with valid GPS coordinates and status=pending_verification |
| ML-2102 | Collection entry saved with locationStatus=location_denied when GPS denied |
| ML-2103 | Collection entry saved normally when GPS times out — not blocked |
| ML-2104 | Location verification: entry within 500m of borrower → status=verified |
| ML-2105 | Location verification: entry > 500m from borrower → status=mismatch |
| ML-2106 | Location verification: borrower has no geocode → status=unverifiable |
| ML-2107 | Haversine distance calculation: known coordinates return correct metres |
| ML-2108 | Heartbeat API stores AgentLocationPing row with correct agentId and coords |
| ML-2109 | Heartbeat API rejects unauthenticated request with 401 |
| ML-2110 | Offline GPS queue flushes on network restore — all pings synced |
| ML-2111 | Route progress API returns correct agent path and collection points for today |
| ML-2112 | Agent with 3+ mismatches triggers multiple_mismatches alert |
| ML-2113 | Agent with no ping for 2+ hours triggers not_moved_2h alert |
| ML-2114 | Admin role can access route-progress SSE stream |
| ML-2115 | Agent role cannot access route-progress SSE stream (403) |
| ML-2116 | AgentLocationPings older than 90 days are deleted by purge cron |
| ML-2117 | GPS consent modal shown at first login after feature enabled |
| ML-2118 | GPS coordinates NOT returned in API response (client-side only display) |
| ML-2119 | Geocoding runs after customer creation without blocking the main flow |
| ML-2120 | Two collections from same GPS point within 10m triggers cluster anomaly flag |

---

## 16. Rollout Plan

### Phase 1 — Location Stamp on Collections (2 weeks)

- [ ] Prisma migration: add GPS columns to CollectionEntry
- [ ] Implement `useAgentLocation` hook
- [ ] Modify collection modal submit to capture and send GPS
- [ ] Implement `verifyCollectionLocation` and `haversineDistance`
- [ ] Background geocoding for existing customers (batch job)
- [ ] GPS status indicator in collection modal
- [ ] GPS consent modal at first agent login
- [ ] Add GPS columns to collection history view (admin sees locationStatus badge)

### Phase 2 — Admin Route Tracker Map (1 week)

- [ ] Implement `AgentLocationPing` model and heartbeat API
- [ ] Add `startGpsHeartbeat` call when agent opens collection page
- [ ] Build `getRouteProgressForBranch` service function
- [ ] Build SSE endpoint `/api/gps/route-progress`
- [ ] Configure Nginx for SSE on Hostinger VPS
- [ ] Build `RouteMap` component (Leaflet + OSM)
- [ ] Build Route Tracker page with agent sidebar and alert badges
- [ ] Add Route Tracker link to admin sidebar navigation

### Phase 3 — Anomaly Detection & Reports (1 week)

- [ ] Nightly anomaly report generation
- [ ] Location anomaly report in admin reports section
- [ ] GPS mismatch summary on daily collection report
- [ ] Purge cron for AgentLocationPings older than 90 days
- [ ] Alert email/notification to admin when agent triggers multiple_mismatches

---

## Quick Reference — Location Status Codes

| Status | Meaning | Admin Action |
|---|---|---|
| `verified` | Agent was within threshold of borrower address | No action needed |
| `mismatch` | Agent was more than threshold distance away | Review — may be legitimate (rural area, GPS drift) |
| `unverifiable` | Borrower address not geocoded yet | Geocode borrower address; re-verify next collection |
| `location_denied` | Agent denied GPS permission on device | Talk to agent; note pattern if repeated |
| `gps_timeout` | GPS did not fix within 10 seconds | Likely indoor or poor signal — acceptable |
| `not_captured` | Entry made before GPS feature was enabled | Historical data — ignore |
| `pending_verification` | Captured, verification running in background | Auto-resolves within seconds |

---

*Document version 1.0 — ZoloFund GPS Collection Tracking Module*  
*Privacy reference: Digital Personal Data Protection Act (DPDP), 2023*  
*Map tiles: OpenStreetMap — © OpenStreetMap contributors (ODbL)*
