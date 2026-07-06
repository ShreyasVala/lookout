// Geospatial helpers: distances, alert radius growth, nearest police station.

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Alert radius starts at 2 km and grows 3 km per hour, capped at 50 km.
const BASE_RADIUS_KM = 2;
const GROWTH_KM_PER_HOUR = 3;
const MAX_RADIUS_KM = 50;

// The public alert zone is anchored ONLY on the reporter's declared last-seen
// location. Finder sightings — even confirmed QR-tag scans — are shown to the
// family as private leads but never move the geofence the whole community
// sees. Only the family updating the last-seen (the reliable source of truth)
// can change it; when they do, `lastSeen.anchoredAt` resets the radius growth.
export function alertZone(report) {
  const anchor = {
    lat: report.lastSeen?.lat,
    lng: report.lastSeen?.lng,
    label: report.lastSeen?.label,
  };
  const sinceIso = report.lastSeen?.anchoredAt || report.createdAt;
  const hours = Math.max(0, (Date.now() - new Date(sinceIso).getTime()) / 36e5);
  const radiusKm = Math.min(
    BASE_RADIUS_KM + GROWTH_KM_PER_HOUR * hours,
    MAX_RADIUS_KM
  );
  return { anchor, radiusKm, hours };
}

// If the finder is farther than this from the family's last-seen area,
// the UI reprioritizes handing the person to police over waiting for family.
export const FAMILY_DISTANT_KM = 25;

export function nearestStation(lat, lng, stations, { maxDistanceKm = Infinity } = {}) {
  let best = null;
  let bestKm = Infinity;
  for (const s of stations) {
    const km = haversineKm(lat, lng, s.lat, s.lng);
    if (km < bestKm) {
      bestKm = km;
      best = s;
    }
  }
  return best && bestKm <= maxDistanceKm ? { ...best, distanceKm: bestKm } : null;
}

// Live nearest-police-station lookup via the OpenStreetMap Overpass API.
// Works anywhere in the world (unlike the small demo directory), keyed on the
// PERSON's coordinates. Searches a growing radius so dense cities return the
// closest station while rural areas still find something. Falls back to the
// provided offline directory only if the network request fails.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const SEARCH_RADII_M = [5000, 20000, 60000]; // 5 km → 20 km → 60 km
const FALLBACK_MAX_DISTANCE_KM = 100;

function parseOverpassElements(elements, lat, lng) {
  let best = null;
  let bestKm = Infinity;
  for (const el of elements) {
    // Nodes carry lat/lon directly; ways/relations use `center`.
    const slat = el.lat ?? el.center?.lat;
    const slng = el.lon ?? el.center?.lon;
    if (typeof slat !== 'number' || typeof slng !== 'number') continue;
    const km = haversineKm(lat, lng, slat, slng);
    if (km >= bestKm) continue;
    const t = el.tags || {};
    bestKm = km;
    best = {
      id: `osm-${el.type}-${el.id}`,
      name: t.name || t['official_name'] || 'Police station',
      city:
        t['addr:city'] ||
        t['addr:town'] ||
        t['addr:village'] ||
        t['addr:suburb'] ||
        '',
      phone: t.phone || t['contact:phone'] || t['emergency:phone'] || '',
      lat: slat,
      lng: slng,
      distanceKm: km,
    };
  }
  return best;
}

async function queryOverpass(lat, lng, radiusM, signal) {
  const q = `[out:json][timeout:20];(node["amenity"="police"](around:${radiusM},${lat},${lng});way["amenity"="police"](around:${radiusM},${lat},${lng});relation["amenity"="police"](around:${radiusM},${lat},${lng}););out center tags;`;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q),
        signal,
      });
      if (!res.ok) continue;
      const json = await res.json();
      return json.elements || [];
    } catch {
      // Try the next mirror.
    }
  }
  return null; // all endpoints failed
}

export async function findNearestStation(lat, lng, { fallback = [], signal } = {}) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  let networkFailed = false;
  for (const radius of SEARCH_RADII_M) {
    const elements = await queryOverpass(lat, lng, radius, signal);
    if (elements === null) {
      networkFailed = true;
      break;
    }
    const station = parseOverpassElements(elements, lat, lng);
    if (station) return station;
    // Nothing in this radius — widen and try again.
  }
  // Only use the offline demo directory if the network was unreachable;
  // if the network worked but found nothing nearby, return null rather than
  // a station thousands of km away.
  if (networkFailed && fallback.length) {
    return nearestStation(lat, lng, fallback, {
      maxDistanceKm: FALLBACK_MAX_DISTANCE_KM,
    });
  }
  return null;
}
