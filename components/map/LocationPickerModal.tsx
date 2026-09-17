'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L?: any;
  }
}

function loadLeaflet(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
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
      existing.addEventListener('error', () => reject(new Error('Leaflet load failed')));
      return;
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Leaflet load failed'));
    document.body.appendChild(script);
  });
}

export interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: { lat: number; lng: number; address?: string }) => void;
  initialLat?: number | null;
  initialLng?: number | null;
  initialAddress?: string;
  title?: string;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export default function LocationPickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialLat,
  initialLng,
  initialAddress,
  title = 'Pin Location on Map',
}: LocationPickerModalProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);

  const [currentLat, setCurrentLat] = useState<number | null>(initialLat ?? null);
  const [currentLng, setCurrentLng] = useState<number | null>(initialLng ?? null);
  const [resolvedAddress, setResolvedAddress] = useState<string>(initialAddress || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const reverseGeocodeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reverse geocode lat/lng to readable address via OpenStreetMap Nominatim
  const performReverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'ZoloFund-Web/1.0 (Customer-Location-Picker)',
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          setResolvedAddress(data.display_name);
        }
      }
    } catch {
      // Non-fatal if offline or blocked
    } finally {
      setIsReverseGeocoding(false);
    }
  }, []);

  const handleCoordsChange = useCallback((lat: number, lng: number, skipReverse = false) => {
    setCurrentLat(lat);
    setCurrentLng(lng);

    if (!skipReverse) {
      if (reverseGeocodeTimerRef.current) {
        clearTimeout(reverseGeocodeTimerRef.current);
      }
      reverseGeocodeTimerRef.current = setTimeout(() => {
        performReverseGeocode(lat, lng);
      }, 600);
    }
  }, [performReverseGeocode]);

  // Initialize Leaflet Map when modal opens
  useEffect(() => {
    if (!isOpen) {
      setMapReady(false);
      return;
    }

    let isMounted = true;

    loadLeaflet()
      .then(() => {
        if (!isMounted || !mapContainerRef.current) return;
        const L = window.L;
        if (!L) return;

        // Cleanup prior instance if any
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        // Determine starting coordinates
        const defaultLat = initialLat && !isNaN(initialLat) ? initialLat : 11.3396; // Erode/Chithode default
        const defaultLng = initialLng && !isNaN(initialLng) ? initialLng : 77.7188;
        const initialZoom = initialLat && initialLng ? 16 : 12;

        const map = L.map(mapContainerRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
        }).setView([defaultLat, defaultLng], initialZoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        // Custom Pin Icon (Crisp SVG)
        const pinIcon = L.divIcon({
          className: 'custom-map-pin',
          html: `
            <div style="
              width: 36px;
              height: 36px;
              display: flex;
              align-items: center;
              justify-content: center;
              transform: translate(-50%, -100%);
              filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));
              cursor: grab;
            ">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="#DC2626">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([defaultLat, defaultLng], {
          draggable: true,
          icon: pinIcon,
        }).addTo(map);

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          handleCoordsChange(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
        });

        map.on('click', (e: any) => {
          marker.setLatLng(e.latlng);
          handleCoordsChange(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
        });

        mapRef.current = map;
        markerRef.current = marker;
        setMapReady(true);
        setCurrentLat(defaultLat);
        setCurrentLng(defaultLng);

        // Invalidate size once modal renders
        setTimeout(() => {
          map.invalidateSize();
        }, 150);

        // If no coordinates were passed, try auto-capturing browser geolocation
        if (!initialLat && !initialLng && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (!isMounted || !mapRef.current || !markerRef.current) return;
              const uLat = Number(pos.coords.latitude.toFixed(6));
              const uLng = Number(pos.coords.longitude.toFixed(6));
              mapRef.current.setView([uLat, uLng], 16);
              markerRef.current.setLatLng([uLat, uLng]);
              handleCoordsChange(uLat, uLng);
            },
            () => {
              // Geolocation denied/unavailable, retain default
            },
            { timeout: 8000 }
          );
        } else if (initialLat && initialLng && !initialAddress) {
          performReverseGeocode(defaultLat, defaultLng);
        }
      })
      .catch((err) => {
        console.error(err);
        setLoadError(true);
      });

    return () => {
      isMounted = false;
      if (reverseGeocodeTimerRef.current) {
        clearTimeout(reverseGeocodeTimerRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isOpen, initialLat, initialLng, initialAddress, handleCoordsChange, performReverseGeocode]);

  // Handle Search using Nominatim (OpenStreetMap)
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=in&format=jsonv2&limit=5`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'ZoloFund-Web/1.0 (Customer-Location-Picker)',
          },
        }
      );
      if (res.ok) {
        const data: SearchResult[] = await res.json();
        setSearchResults(data || []);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: SearchResult) => {
    const lat = Number(parseFloat(result.lat).toFixed(6));
    const lng = Number(parseFloat(result.lon).toFixed(6));
    setSearchResults([]);
    setSearchQuery('');
    setResolvedAddress(result.display_name);

    if (mapRef.current && markerRef.current) {
      mapRef.current.setView([lat, lng], 17);
      markerRef.current.setLatLng([lat, lng]);
      handleCoordsChange(lat, lng, true);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        if (mapRef.current && markerRef.current) {
          mapRef.current.setView([lat, lng], 17);
          markerRef.current.setLatLng([lat, lng]);
          handleCoordsChange(lat, lng);
        }
      },
      (err) => {
        alert('Could not access current location: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleConfirm = () => {
    if (currentLat == null || currentLng == null) {
      alert('Please select a valid point on the map.');
      return;
    }
    onConfirm({
      lat: currentLat,
      lng: currentLng,
      address: resolvedAddress || undefined,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay show"
      style={{
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        style={{
          width: '92%',
          maxWidth: '820px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
          background: 'var(--surface, #ffffff)',
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border, #E5E7EB)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--card-bg, #ffffff)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons-outlined" style={{ color: 'var(--primary, #D97706)', fontSize: '22px' }}>
              place
            </span>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{title}</h3>
          </div>
          <button
            type="button"
            className="modal-close material-icons-outlined"
            onClick={onClose}
            style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '22px', color: 'var(--text-secondary)' }}
          >
            close
          </button>
        </div>

        {/* Body */}
        <div
          className="modal-body"
          style={{
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflowY: 'auto',
          }}
        >
          {/* Top Search & Actions Bar */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
            <form onSubmit={handleSearch} style={{ flex: 1, display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span
                  className="material-icons-outlined"
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '18px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  search
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search village, town, street or landmark..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '34px', fontSize: '.9rem', height: '38px' }}
                />
              </div>
              <button
                type="submit"
                className="btn btn-secondary btn-sm"
                disabled={isSearching || !searchQuery.trim()}
                style={{ height: '38px', padding: '0 14px' }}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleUseCurrentLocation}
              title="Jump to current GPS location"
              style={{
                height: '38px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 12px',
                whiteSpace: 'nowrap',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '17px', color: 'var(--primary)' }}>
                my_location
              </span>
              <span>My GPS</span>
            </button>
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--border, #E5E7EB)',
                borderRadius: '8px',
                boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                maxHeight: '160px',
                overflowY: 'auto',
                position: 'relative',
                zIndex: 10,
              }}
            >
              {searchResults.map((res) => (
                <div
                  key={res.place_id}
                  onClick={() => handleSelectSearchResult(res)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '.82rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border, #F3F4F6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg, #F9FAFB)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>
                    location_on
                  </span>
                  <span style={{ color: 'var(--text)', lineHeight: 1.3 }}>{res.display_name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Map Container */}
          <div
            style={{
              position: 'relative',
              height: '360px',
              width: '100%',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid var(--border, #E5E7EB)',
            }}
          >
            {loadError ? (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--danger)',
                  padding: '20px',
                  textAlign: 'center',
                }}
              >
                Failed to load OpenStreetMap. Please ensure internet access is available.
              </div>
            ) : (
              <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
            )}

            {!mapReady && !loadError && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.85)',
                  fontSize: '.9rem',
                  color: 'var(--text-secondary)',
                  zIndex: 400,
                }}
              >
                Loading interactive map...
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-icons-outlined" style={{ fontSize: '15px' }}>touch_app</span>
              Drag pin or click anywhere on map to pinpoint exact rooftop/shop.
            </span>
            <div style={{ fontSize: '.8rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
              {currentLat != null && currentLng != null
                ? `GPS: ${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`
                : 'No coordinates'}
            </div>
          </div>

          {/* Selected Address Display */}
          <div
            style={{
              background: 'var(--bg, #F9FAFB)',
              borderRadius: '8px',
              padding: '10px 14px',
              border: '1px solid var(--border, #E5E7EB)',
              fontSize: '.83rem',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '.75rem', textTransform: 'uppercase' }}>
              {isReverseGeocoding ? 'Detecting address...' : 'Detected Address (OpenStreetMap)'}
            </div>
            <div style={{ color: resolvedAddress ? 'var(--text)' : 'var(--text-light)', lineHeight: 1.4 }}>
              {isReverseGeocoding ? (
                <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>Reverse geocoding coordinates...</span>
              ) : resolvedAddress ? (
                resolvedAddress
              ) : (
                'Drag or click map to detect address'
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border, #E5E7EB)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            background: 'var(--card-bg, #ffffff)',
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={currentLat == null || currentLng == null}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>check_circle</span>
            Confirm Pin Location
          </button>
        </div>
      </div>
    </div>
  );
}
