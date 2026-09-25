'use client';

/**
 * Live agent map for the route-tracker page.
 *
 * Leaflet + OpenStreetMap loaded from CDN at runtime — no npm dependency,
 * no API key, works on the existing VPS. Polls /api/v1/gps/live every 30 s
 * (web session cookie auth via dualAuth). The tables below the map remain
 * the accessible fallback; if Leaflet fails to load (offline intranet,
 * blocked CDN) this component renders a notice and nothing else changes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type LiveAgent = {
  agentId: string;
  agentName: string;
  agentPhone: string | null;
  lat: number | null;
  lng: number | null;
  capturedAt: string | null;
  online: boolean;
  todayCollected: number;
  todayEntries: number;
};

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const POLL_MS = 30_000;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { L?: any }
}

function loadLeaflet(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve();
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('leaflet load failed')));
      return;
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('leaflet load failed'));
    document.body.appendChild(script);
  });
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'no GPS';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)} h ${mins % 60} m ago`;
}

export type CollectionPoint = {
  id: string;
  lat: number;
  lng: number;
  customerName: string;
  amount: number;
  time: string | Date;
  locationStatus?: string;
};

export type AgentCollectionGroup = {
  agentId: string;
  agentName: string;
  points: CollectionPoint[];
};

export type AgentTrail = {
  agentId: string;
  agentName: string;
  path: Array<{ lat: number; lng: number; time?: string | Date; type?: string }>;
};

export default function LiveMapClient({
  currencySymbol = '₹',
  agentPaths = [],
  agentCollections = [],
}: {
  currencySymbol?: string;
  agentPaths?: AgentTrail[];
  agentCollections?: AgentCollectionGroup[];
}) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylinesRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collectionMarkersRef = useRef<Map<string, any>>(new Map());
  const fittedRef = useRef(false);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [agents, setAgents] = useState<LiveAgent[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [liveGpsMode, setLiveGpsMode] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/gps/live', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      const data: LiveAgent[] = json?.data ?? [];
      setAgents(data);
      setLastRefresh(new Date());

      const L = window.L;
      const map = mapRef.current;
      if (!L || !map) return;

      const seen = new Set<string>();
      for (const agent of data) {
        if (agent.lat == null || agent.lng == null) continue;
        seen.add(agent.agentId);
        const color = agent.online ? '#22c55e' : '#9ca3af';
        const safeName = document.createElement('span');
        safeName.textContent = agent.agentName;
        const safeCurrency = document.createElement('span');
        safeCurrency.textContent = currencySymbol;
        const popupHtml =
          `<div style="font-family: inherit; font-size: 13px; line-height: 1.4;">` +
          `<strong style="font-size: 14px;">${safeName.innerHTML}</strong><br/>` +
          `<span style="color: ${agent.online ? '#16a34a' : '#6b7280'}; font-weight: 600;">` +
          `${agent.online ? '🟢 Live GPS Active' : '⚪ Offline'} · ${timeAgo(agent.capturedAt)}</span><br/>` +
          `<strong>Today:</strong> ${safeCurrency.innerHTML}${Number(agent.todayCollected).toLocaleString('en-IN')} ` +
          `(${agent.todayEntries} entries)` +
          `</div>`;

        const existing = markersRef.current.get(agent.agentId);
        if (existing) {
          existing.setLatLng([agent.lat, agent.lng]);
          existing.setStyle({ color, fillColor: color });
          existing.setPopupContent(popupHtml);
        } else {
          const marker = L.circleMarker([agent.lat, agent.lng], {
            radius: 10,
            color: '#ffffff',
            fillColor: color,
            fillOpacity: 0.95,
            weight: 3,
          }).addTo(map);
          marker.bindPopup(popupHtml);
          markersRef.current.set(agent.agentId, marker);
        }
      }
      // Drop markers for agents no longer reported
      for (const [id, marker] of markersRef.current.entries()) {
        if (!seen.has(id)) {
          map.removeLayer(marker);
          markersRef.current.delete(id);
        }
      }
      // Fit bounds once, on first data with positions
      if (!fittedRef.current && (markersRef.current.size > 0 || collectionMarkersRef.current.size > 0)) {
        const allMarkers = [
          ...markersRef.current.values(),
          ...collectionMarkersRef.current.values(),
        ];
        if (allMarkers.length > 0) {
          const group = L.featureGroup(allMarkers);
          map.fitBounds(group.getBounds().pad(0.25), { maxZoom: 15 });
          fittedRef.current = true;
        }
      }
    } catch {
      // network hiccup — next poll retries
    }
  }, [currencySymbol]);

  // Render collection pins on the map
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map || state !== 'ready') return;

    for (const marker of collectionMarkersRef.current.values()) {
      map.removeLayer(marker);
    }
    collectionMarkersRef.current.clear();

    for (const group of agentCollections) {
      for (const p of group.points) {
        if (p.lat == null || p.lng == null) continue;
        const timeStr = p.time
          ? new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'Just now';

        const popupHtml = `
          <div style="font-family: inherit; font-size: 13px; min-width: 190px; line-height: 1.4;">
            <div style="color: #16a34a; font-weight: 800; font-size: 11px; margin-bottom: 2px;">
              ✓ PAYMENT COLLECTED
            </div>
            <div style="font-weight: 700; color: #111827; font-size: 14px;">
              Collected ${currencySymbol}${Number(p.amount).toLocaleString('en-IN')} from ${p.customerName}
            </div>
            <div style="color: #6b7280; font-size: 11px; margin-top: 4px;">
              ⏰ ${timeStr} · ${group.agentName}
            </div>
          </div>
        `;

        const marker = L.circleMarker([p.lat, p.lng], {
          radius: 8,
          color: '#ffffff',
          fillColor: '#16a34a',
          fillOpacity: 0.95,
          weight: 2.5,
        }).addTo(map);

        marker.bindPopup(popupHtml);
        collectionMarkersRef.current.set(p.id, marker);
      }
    }
  }, [agentCollections, currencySymbol, state]);

  // Render polyline movement trails when map is ready
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map || state !== 'ready') return;

    for (const poly of polylinesRef.current.values()) {
      map.removeLayer(poly);
    }
    polylinesRef.current.clear();

    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981'];
    agentPaths.forEach((ap, idx) => {
      if (ap.path && ap.path.length >= 2) {
        const color = colors[idx % colors.length];
        const latLngs = ap.path.map((p) => [p.lat, p.lng]);
        const polyline = L.polyline(latLngs, {
          color,
          weight: 3.5,
          opacity: 0.75,
          dashArray: '5, 7',
        }).addTo(map);
        polyline.bindTooltip(`${ap.agentName} trail (${ap.path.length} pings)`);
        polylinesRef.current.set(ap.agentId, polyline);
      }
    });
  }, [agentPaths, state]);

  // Init leaflet and setup interval based on liveGpsMode
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const intervalMs = liveGpsMode ? 5000 : POLL_MS;

    loadLeaflet()
      .then(() => {
        if (cancelled || !mapDivRef.current) return;
        const L = window.L;
        if (!mapRef.current) {
          const map = L.map(mapDivRef.current, { scrollWheelZoom: false })
            .setView([20.5937, 78.9629], 5);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(map);
          mapRef.current = map;
          setState('ready');
        }
        refresh();
        timer = setInterval(refresh, intervalMs);
      })
      .catch(() => { if (!cancelled) setState('unavailable'); });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [liveGpsMode, refresh]);

  // Teardown map on unmount
  useEffect(() => {
    return () => {
      for (const poly of polylinesRef.current.values()) {
        mapRef.current?.removeLayer(poly);
      }
      polylinesRef.current.clear();
      for (const marker of collectionMarkersRef.current.values()) {
        mapRef.current?.removeLayer(marker);
      }
      collectionMarkersRef.current.clear();
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      markersRef.current.clear();
      fittedRef.current = false;
    };
  }, []);

  const fitAllBounds = () => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map) return;
    const all = [
      ...markersRef.current.values(),
      ...collectionMarkersRef.current.values(),
    ];
    if (all.length > 0) {
      const group = L.featureGroup(all);
      map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 16 });
    }
  };

  if (state === 'unavailable') {
    return (
      <div className="card">
        <div style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '.85rem' }}>
          Live map unavailable (map library could not load). Agent positions are listed in the table below.
        </div>
      </div>
    );
  }

  const onlineCount = agents.filter((a) => a.online).length;
  const totalCollections = agentCollections.reduce((sum, g) => sum + g.points.length, 0);

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ margin: 0 }}>🗺️ Live Agent & Collection Map</h3>
          <button
            type="button"
            onClick={() => setLiveGpsMode((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              border: `1.5px solid ${liveGpsMode ? '#16a34a' : 'var(--border)'}`,
              background: liveGpsMode ? '#f0fdf4' : 'var(--bg-secondary)',
              color: liveGpsMode ? '#15803d' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: liveGpsMode ? '#22c55e' : '#9ca3af',
                boxShadow: liveGpsMode ? '0 0 6px #22c55e' : 'none',
              }}
            />
            {liveGpsMode ? 'LIVE GPS MODE (5s)' : 'STANDARD (30s)'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>
            <strong>{onlineCount}</strong> online · <strong>{agents.length}</strong> agents · <strong>{totalCollections}</strong> collections
            {lastRefresh ? ` · ${lastRefresh.toLocaleTimeString()}` : ''}
          </span>
          <button
            type="button"
            onClick={fitAllBounds}
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Fit Bounds
          </button>
        </div>
      </div>
      <div
        ref={mapDivRef}
        style={{ height: '440px', width: '100%', background: '#e5e7eb' }}
        aria-label="Live map of field agent locations and collections"
      />
      {state === 'loading' && (
        <div style={{ padding: '10px 18px', color: 'var(--text-secondary)', fontSize: '.8rem' }}>Loading map…</div>
      )}
    </div>
  );
}
