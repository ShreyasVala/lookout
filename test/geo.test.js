import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alertZone,
  findNearestStation,
  haversineKm,
  nearestStation,
} from '../src/services/geo.js';

test('haversineKm returns a plausible distance between nearby points', () => {
  const km = haversineKm(28.5931, 77.2197, 28.5883, 77.2508);
  assert.ok(km > 2);
  assert.ok(km < 4);
});

test('alertZone expands from the last-seen anchor and caps at 50 km', () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 36e5).toISOString();
  const veryOld = new Date(Date.now() - 48 * 36e5).toISOString();

  const expanding = alertZone({
    createdAt: twoHoursAgo,
    lastSeen: { lat: 28.5931, lng: 77.2197, label: 'Lodhi Garden' },
  });
  const capped = alertZone({
    createdAt: veryOld,
    lastSeen: { lat: 28.5931, lng: 77.2197, label: 'Lodhi Garden' },
  });

  assert.equal(expanding.anchor.label, 'Lodhi Garden');
  assert.ok(expanding.radiusKm >= 7.9);
  assert.ok(expanding.radiusKm <= 8.1);
  assert.equal(capped.radiusKm, 50);
});

test('nearestStation picks the closest station from the fallback directory', () => {
  const station = nearestStation(28.59, 77.22, [
    { id: 'far', name: 'Far Station', lat: 19.0544, lng: 72.8402 },
    { id: 'near', name: 'Near Station', lat: 28.5827, lng: 77.2199 },
  ]);

  assert.equal(station.id, 'near');
  assert.ok(station.distanceKm < 2);
});

test('nearestStation does not return an unrealistic fallback station', () => {
  const station = nearestStation(
    40.7128,
    -74.006,
    [{ id: 'india-demo', name: 'Demo Station', lat: 28.5827, lng: 77.2199 }],
    { maxDistanceKm: 100 }
  );

  assert.equal(station, null);
});

test('findNearestStation does not use a far-away fallback after network failure', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('network down');
  };

  try {
    const station = await findNearestStation(40.7128, -74.006, {
      fallback: [
        { id: 'india-demo', name: 'Demo Station', lat: 28.5827, lng: 77.2199 },
      ],
    });
    assert.equal(station, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
