import { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../context/AppContext.jsx';
import { pinIcon } from '../utils/mapIcons.js';
import { alertZone } from '../services/geo.js';
import { timeAgo } from '../utils/format.js';

const DEFAULT_CENTER = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export default function MapPage() {
  const { currentUser, activeReports, memberById } = useApp();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      detectRetina: true,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const points = [];

    activeReports.forEach((r) => {
      const loc = r.lastSeen;
      if (!loc || typeof loc.lat !== 'number') return;
      const member = memberById(r.memberId);
      const zone = alertZone(r);

      L.circle([zone.anchor.lat, zone.anchor.lng], {
        radius: zone.radiusKm * 1000,
        color: '#fbbf24',
        weight: 1,
        fillColor: '#fbbf24',
        fillOpacity: 0.07,
      }).addTo(layer);

      const marker = L.marker([loc.lat, loc.lng], {
        icon: pinIcon(r.sightings.length > 0 ? 'sighted' : 'missing'),
      });
      marker.bindPopup(
        `<strong>${escapeHtml(member ? member.name : 'Unknown')}</strong>` +
          `${member ? `, ${escapeHtml(member.age)}` : ''}<br/>` +
          `${escapeHtml(loc.label)}<br/>` +
          `Last seen ${escapeHtml(timeAgo(loc.at))} · alert radius ${zone.radiusKm.toFixed(1)} km<br/>` +
          `<a class="popup-link" href="#/found">I think I've seen them →</a>`
      );
      marker.addTo(layer);
      points.push([loc.lat, loc.lng]);
    });

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 11 });
    }
  }, [activeReports, memberById]);

  if (!currentUser) return <Navigate to="/signup" replace />;

  return (
    <>
      <h1 className="section-title" style={{ marginTop: 0 }}>
        Active Alert Zones
      </h1>
      <p className="hint" style={{ marginBottom: 14 }}>
        Each amber circle is a live geofence — users inside it receive the
        alert. Radii expand hourly; only the family updating the last-seen
        location re-anchors a zone.
      </p>
      <div className="map-wrap" ref={containerRef} />
      {activeReports.length === 0 && (
        <div className="empty">
          <p>No active alerts right now.</p>
        </div>
      )}
    </>
  );
}
