// Text-based description matching between found-person descriptions
// and active missing reports. Deliberately simple and explainable:
// weighted field agreement + token overlap.

export const AGE_RANGES = ['0-12', '13-17', '18-40', '41-60', '60+'];

export function ageToRange(age) {
  if (age <= 12) return '0-12';
  if (age <= 17) return '13-17';
  if (age <= 40) return '18-40';
  if (age <= 60) return '41-60';
  return '60+';
}

function tokens(s) {
  return String(s || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function overlap(a, b, cap) {
  const setB = new Set(tokens(b));
  let n = 0;
  for (const t of new Set(tokens(a))) if (setB.has(t)) n++;
  return Math.min(n, cap);
}

function adjacentRanges(a, b) {
  const i = AGE_RANGES.indexOf(a);
  const j = AGE_RANGES.indexOf(b);
  return i >= 0 && j >= 0 && Math.abs(i - j) === 1;
}

// Both descriptions use the shape:
// { ageRange, gender, hair, clothing, notes }
export function scoreMatch(reportDesc, foundDesc, distanceKm = null) {
  let score = 0;
  const reasons = [];

  if (reportDesc.gender && foundDesc.gender) {
    if (reportDesc.gender === foundDesc.gender) {
      score += 3;
      reasons.push('gender matches');
    } else if (foundDesc.gender !== 'unsure') {
      score -= 2;
    }
  }

  if (reportDesc.ageRange && foundDesc.ageRange) {
    if (reportDesc.ageRange === foundDesc.ageRange) {
      score += 2;
      reasons.push('age range matches');
    } else if (adjacentRanges(reportDesc.ageRange, foundDesc.ageRange)) {
      score += 1;
      reasons.push('age range close');
    }
  }

  const hair = overlap(reportDesc.hair, foundDesc.hair, 2);
  if (hair) {
    score += hair;
    reasons.push('hair description overlaps');
  }

  const clothing = overlap(reportDesc.clothing, foundDesc.clothing, 3);
  if (clothing) {
    score += clothing;
    reasons.push('clothing overlaps');
  }

  const notes = overlap(reportDesc.notes, foundDesc.notes, 2);
  if (notes) {
    score += notes;
    reasons.push('other details overlap');
  }

  if (typeof distanceKm === 'number') {
    if (distanceKm < 25) {
      score += 2;
      reasons.push('very close to last seen area');
    } else if (distanceKm < 100) {
      score += 1;
      reasons.push('same region');
    }
  }

  return { score, reasons };
}

export const MATCH_THRESHOLD = 4;

export function rankMatches(activeReports, foundDesc, foundLoc) {
  return activeReports
    .map((r) => {
      const distanceKm =
        foundLoc &&
        typeof foundLoc.lat === 'number' &&
        typeof r.lastSeen?.lat === 'number'
          ? Math.round(
              haversine(foundLoc.lat, foundLoc.lng, r.lastSeen.lat, r.lastSeen.lng)
            )
          : null;
      const { score, reasons } = scoreMatch(r.description, foundDesc, distanceKm);
      return { report: r, score, reasons, distanceKm };
    })
    .filter((m) => m.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

// local copy to avoid circular import with geo.js
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
