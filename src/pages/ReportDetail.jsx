import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../context/AppContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import LocationPicker from '../components/LocationPicker.jsx';
import { pinIcon } from '../utils/mapIcons.js';
import { formatDate, timeAgo } from '../utils/format.js';
import { alertZone } from '../services/geo.js';

const SOURCE_LABELS = {
  'qr-scan': 'Confirmed — QR tag scanned',
  'manual-match': 'Possible sighting — description match',
  'found-report': 'Possible match — Found Person report',
  'police-handoff': 'Confirmed — with police',
};

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export default function ReportDetail() {
  const { id } = useParams();
  const { reportById, memberById, resolveReport, updateLastSeen, currentUser } =
    useApp();

  const report = reportById(id);
  const member = report ? memberById(report.memberId) : null;

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  const isOwner = !!(report && currentUser && report.userId === currentUser.id);
  const [editingLastSeen, setEditingLastSeen] = useState(false);
  const [newLoc, setNewLoc] = useState(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !report) return;
    const map = L.map(containerRef.current).setView(
      [report.lastSeen.lat, report.lastSeen.lng],
      12
    );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!report]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !report) return;
    layer.clearLayers();

    const points = [[report.lastSeen.lat, report.lastSeen.lng]];

    L.marker([report.lastSeen.lat, report.lastSeen.lng], {
      icon: pinIcon('missing'),
    })
      .bindPopup(
        `<strong>Last seen</strong><br/>${escapeHtml(report.lastSeen.label)}`
      )
      .addTo(layer);

    (report.sightings || []).forEach((s) => {
      if (typeof s.lat !== 'number') return;
      const confirmed = s.source === 'qr-scan' || s.withPolice;
      L.marker([s.lat, s.lng], {
        icon: pinIcon(
          s.withPolice ? 'found' : confirmed ? 'sighted' : 'possible'
        ),
      })
        .bindPopup(
          `<strong>${
            s.withPolice
              ? 'With police'
              : confirmed
                ? 'Confirmed sighting (tag scanned)'
                : 'Possible sighting'
          }</strong><br/>${escapeHtml(s.label || '')}<br/><em>${escapeHtml(
            timeAgo(s.at)
          )}</em>`
        )
        .addTo(layer);
      points.push([s.lat, s.lng]);
    });

    if (report.status === 'active') {
      const zone = alertZone(report);
      if (typeof zone.anchor.lat === 'number') {
        L.circle([zone.anchor.lat, zone.anchor.lng], {
          radius: zone.radiusKm * 1000,
          color: '#fbbf24',
          weight: 1,
          fillColor: '#fbbf24',
          fillOpacity: 0.08,
        }).addTo(layer);
      }
    }

    map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 13 });
  }, [report]);

  if (!report || !member) {
    return (
      <div className="empty">
        <p>Report not found.</p>
        <Link to="/" className="btn secondary" style={{ marginTop: 12 }}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  const zone = alertZone(report);
  const d = report.description;

  return (
    <>
      <Link to="/" className="back-link">
        ← Dashboard
      </Link>

      <div className="page-head">
        <div>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 800 }}>
            {member.name}, {member.age}
          </h1>
          <p className="hint">
            Case <strong>{report.caseId}</strong> · filed {timeAgo(report.createdAt)}{' '}
            · <StatusBadge report={report} />
          </p>
        </div>
        {report.status === 'active' && isOwner ? (
          <button
            className="btn success"
            onClick={() => {
              if (
                window.confirm(
                  'Mark as found? This deactivates the alert network, returns the QR tag to inactive, and permanently deletes all sighting data.'
                )
              ) {
                resolveReport(report.id);
              }
            }}
          >
            Mark as Found
          </button>
        ) : report.status === 'active' ? (
          <span className="hint">Only the reporting family can close this case.</span>
        ) : (
          <span className="hint">
            Resolved {formatDate(report.resolvedAt)} — sighting data purged.
          </span>
        )}
      </div>

      <div className="meta-grid">
        <div className="meta">
          <div className="k">Last seen</div>
          <div className="v">
            {report.lastSeen.label} · {timeAgo(report.lastSeen.at)}
          </div>
        </div>
        <div className="meta">
          <div className="k">Alert radius</div>
          <div className="v">
            {report.status === 'active'
              ? `${zone.radiusKm.toFixed(1)} km and expanding`
              : 'Deactivated'}
          </div>
        </div>
        <div className="meta">
          <div className="k">Sightings</div>
          <div className="v">{report.sightings.length}</div>
        </div>
        <div className="meta">
          <div className="k">Tag scans acknowledged</div>
          <div className="v">{(report.gateAcks || []).length}</div>
        </div>
      </div>

      {isOwner && report.status === 'active' && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="page-head" style={{ marginBottom: editingLastSeen ? 12 : 0 }}>
            <div>
              <strong>Last-seen location</strong>
              <p className="hint" style={{ margin: '2px 0 0' }}>
                Only you, as the reporter, can move the public alert zone.
                Finder sightings appear below as leads but never change it.
              </p>
            </div>
            {!editingLastSeen && (
              <button
                className="btn secondary"
                onClick={() => {
                  setNewLoc(null);
                  setEditingLastSeen(true);
                }}
              >
                Update location
              </button>
            )}
          </div>
          {editingLastSeen && (
            <>
              <LocationPicker
                value={newLoc || report.lastSeen}
                onChange={setNewLoc}
                placeholder="Search the new last-seen location…"
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button
                  className="btn"
                  disabled={!newLoc}
                  onClick={() => {
                    updateLastSeen(report.id, {
                      lat: newLoc.lat,
                      lng: newLoc.lng,
                      label: newLoc.label,
                    });
                    setEditingLastSeen(false);
                  }}
                >
                  Save new last-seen
                </button>
                <button
                  className="btn secondary"
                  onClick={() => setEditingLastSeen(false)}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <h2 className="section-title">Live Map</h2>
      <p className="hint" style={{ marginBottom: 10 }}>
        Amber zone = current alert geofence (grows 3 km/hour, re-anchors only
        when the family updates the last-seen). Red = last seen, solid blue =
        confirmed tag scan, dashed blue = possible sighting, green = with
        police.
      </p>
      <div className="map-wrap" ref={containerRef} />

      <h2 className="section-title">Description Broadcast to Nearby Users</h2>
      <p style={{ color: 'var(--muted)', maxWidth: 720 }}>
        {[d.hair, d.clothing, d.notes].filter(Boolean).join('. ')}
      </p>

      <h2 className="section-title">Sighting Timeline</h2>
      {report.sightings.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>
          {report.status === 'active'
            ? 'No sightings yet. The alert radius keeps expanding automatically.'
            : 'Sighting data was deleted when this report was resolved.'}
        </p>
      ) : (
        <ul className="timeline">
          {report.sightings.map((s) => (
            <li key={s.id}>
              <div className="when">
                {timeAgo(s.at)} · {SOURCE_LABELS[s.source] || s.source} ·{' '}
                {s.finderKey ? `by anonymous finder #${s.finderKey}` : 'system'}
              </div>
              <div className="where">{s.label}</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                {s.note}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
