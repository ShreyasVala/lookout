import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { pinIcon } from '../utils/mapIcons.js';
import { haversineKm } from '../services/geo.js';

const DEFAULT_CENTER = [20.5937, 78.9629]; // India
const DEFAULT_ZOOM = 5;
const NOMINATIM = 'https://nominatim.openstreetmap.org';

function viewboxAround(lat, lng, radiusKm = 25) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));
  return {
    west: lng - lngDelta,
    north: lat + latDelta,
    east: lng + lngDelta,
    south: lat - latDelta,
  };
}

function sortByDistance(items, origin) {
  if (!origin) return items;
  return [...items].sort((a, b) => {
    const aKm = haversineKm(origin.lat, origin.lng, parseFloat(a.lat), parseFloat(a.lon));
    const bKm = haversineKm(origin.lat, origin.lng, parseFloat(b.lat), parseFloat(b.lon));
    return aKm - bKm;
  });
}

async function reverseLabel(lat, lng) {
  try {
    const res = await fetch(
      `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    );
    const d = await res.json();
    return d.display_name || '';
  } catch {
    return '';
  }
}

// Address search (with suggestions), "use my location", and click-to-pin —
// all report back via onChange({ lat, lng, label }).
export default function LocationPicker({
  value,
  onChange,
  placeholder = 'Type an address or place…',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [searchOrigin, setSearchOrigin] = useState(null);
  const skipSearchRef = useRef(false);
  const initialValueRef = useRef(value);
  const searchOriginRef = useRef(null);
  const requestedSearchOriginRef = useRef(false);

  const setPin = (lat, lng, zoom) => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], {
        icon: pinIcon('missing'),
      }).addTo(map);
    }
    map.setView([lat, lng], zoom ?? Math.max(map.getZoom(), 15));
  };

  const commit = (lat, lng, label) => {
    setPin(lat, lng);
    rememberSearchOrigin(lat, lng);
    skipSearchRef.current = true;
    setQuery(label || '');
    setSuggestions([]);
    onChangeRef.current({
      lat,
      lng,
      label: label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    });
  };

  const rememberSearchOrigin = (lat, lng, zoom = null) => {
    const origin = { lat, lng };
    searchOriginRef.current = origin;
    setSearchOrigin(origin);
    if (zoom && mapRef.current && !initialValueRef.current) {
      mapRef.current.setView([lat, lng], zoom);
    }
    return origin;
  };

  const requestSearchOrigin = ({ silent = true, moveMap = false } = {}) => {
    if (searchOriginRef.current) {
      return Promise.resolve(searchOriginRef.current);
    }
    if (requestedSearchOriginRef.current || !navigator.geolocation) {
      return Promise.resolve(null);
    }
    requestedSearchOriginRef.current = true;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const origin = rememberSearchOrigin(
            pos.coords.latitude,
            pos.coords.longitude,
            moveMap ? 13 : null
          );
          resolve(origin);
        },
        () => {
          if (!silent) {
            setGeoError('Location permission denied — search or click the map instead.');
          }
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
      );
    });
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      detectRetina: true,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    map.on('click', async (e) => {
      setSuggestions([]); // close any open dropdown immediately
      const { lat, lng } = e.latlng;
      setPin(lat, lng);
      const label = await reverseLabel(lat, lng);
      commit(lat, lng, label);
    });

    mapRef.current = map;

    // Pre-pin if the parent already knows the location
    // (e.g. finder flow launched from an existing sighting/found report).
    const init = initialValueRef.current;
    if (init && typeof init.lat === 'number') {
      rememberSearchOrigin(init.lat, init.lng);
      setPin(init.lat, init.lng, 14);
      if (init.label) {
        skipSearchRef.current = true;
        setQuery(init.label);
      }
    } else if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((permission) => {
          if (permission.state === 'granted') {
            requestSearchOrigin({ silent: true, moveMap: true });
          }
        })
        .catch(() => {});
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced address suggestions (like Google Maps autocomplete)
  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const origin =
          searchOriginRef.current ||
          (await requestSearchOrigin({ silent: true, moveMap: true }));
        const params = new URLSearchParams({
          format: 'jsonv2',
          limit: '6',
          addressdetails: '0',
          q: query.trim(),
        });
        // Bias results toward the area the user is currently viewing so a
        // keyword returns the nearest matching places first (like Maps).
        // Using the map's bounds as a "viewbox" ranks nearby hits above far
        // ones without excluding distant results entirely (bounded=0).
        const map = mapRef.current;
        if (origin) {
          const b = viewboxAround(origin.lat, origin.lng);
          params.set('viewbox', `${b.west},${b.north},${b.east},${b.south}`);
          params.set('bounded', '0');
        } else if (map) {
          const b = map.getBounds();
          params.set(
            'viewbox',
            `${b.getWest()},${b.getNorth()},${b.getEast()},${b.getSouth()}`
          );
          params.set('bounded', '0');
        }
        const res = await fetch(`${NOMINATIM}/search?${params.toString()}`);
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? sortByDistance(data, origin) : []);
      } catch {
        setSuggestions([]);
      }
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const useMyLocation = () => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPin(lat, lng, 16);
        const label = await reverseLabel(lat, lng);
        commit(lat, lng, label);
      },
      () =>
        setGeoError(
          'Location permission denied — search or click the map instead.'
        ),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div>
      <div className="picker-controls">
        <div className="suggest-wrap">
          <input
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => setTimeout(() => setSuggestions([]), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSuggestions([]);
            }}
            aria-label="Search for an address"
            autoComplete="off"
          />
          {(suggestions.length > 0 || searching) && (
            <div className="suggest-list">
              {searching && <div className="suggest-item muted">Searching…</div>}
              {suggestions.map((s) => (
                <button
                  type="button"
                  key={s.place_id}
                  className="suggest-item"
                  // preventDefault on mousedown keeps the input from blurring
                  // (which would tear down the list) before the click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    commit(parseFloat(s.lat), parseFloat(s.lon), s.display_name)
                  }
                >
                  {s.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="btn secondary" onClick={useMyLocation}>
          📍 My location
        </button>
      </div>
      {geoError && <div className="error-text">{geoError}</div>}
      <div className="picker-map" ref={containerRef} />
      <div className="hint">
        {value
          ? `Pinned: ${value.label || `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`}`
          : 'Search an address, use your location, or click the map to drop a pin.'}
      </div>
    </div>
  );
}
