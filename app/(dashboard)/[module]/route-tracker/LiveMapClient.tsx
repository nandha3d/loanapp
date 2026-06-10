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

export default function LiveMapClient({ currencySymbol = '₹' }: { currencySymbol?: string }) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  const fittedRef = useRef(false);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [agents, setAgents] = useState<LiveAgent[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

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
        const popupHtml =
          `<strong>${agent.agentName}</strong><br/>` +
          `${agent.online ? '🟢 online' : '⚪ last seen'} · ${timeAgo(agent.capturedAt)}<br/>` +
          `Today: ${currencySymbol}${Number(agent.todayCollected).toLocaleString('en-IN')} ` +
          `(${agent.todayEntries} entries)`;

        const existing = markersRef.current.get(agent.agentId);
        if (existing) {
          existing.setLatLng([agent.lat, agent.lng]);
          existing.setStyle({ color, fillColor: color });
          existing.setPopupContent(popupHtml);
        } else {
          const marker = L.circleMarker([agent.lat, agent.lng], {
            radius: 9, color, fillColor: color, fillOpacity: 0.85, weight: 2,
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
      if (!fittedRef.current && markersRef.current.size > 0) {
        const group = L.featureGroup([...markersRef.current.values()]);
        map.fitBounds(group.getBounds().pad(0.25), { maxZoom: 14 });
        fittedRef.current = true;
      }
    } catch {
      // network hiccup — next poll retries
    }
  }, [currencySymbol]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    loadLeaflet()
      .then(() => {
        if (cancelled || !mapDivRef.current) return;
        const L = window.L;
        const map = L.map(mapDivRef.current, { scrollWheelZoom: false })
          .setView([20.5937, 78.9629], 5); // India fallback view
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        mapRef.current = map;
        setState('ready');
        refresh();
        timer = setInterval(refresh, POLL_MS);
      })
      .catch(() => { if (!cancelled) setState('unavailable'); });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      markersRef.current.clear();
      fittedRef.current = false;
    };
  }, [refresh]);

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

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>🗺️ Live Agent Map</h3>
        <span style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>
          {onlineCount} online · {agents.length} agents
          {lastRefresh ? ` · updated ${lastRefresh.toLocaleTimeString()}` : ''}
        </span>
      </div>
      <div
        ref={mapDivRef}
        style={{ height: '420px', width: '100%', background: '#e5e7eb' }}
        aria-label="Live map of field agent locations"
      />
      {state === 'loading' && (
        <div style={{ padding: '10px 18px', color: 'var(--text-secondary)', fontSize: '.8rem' }}>Loading map…</div>
      )}
    </div>
  );
}
