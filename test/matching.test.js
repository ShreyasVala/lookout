import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCH_THRESHOLD,
  ageToRange,
  rankMatches,
  scoreMatch,
} from '../src/services/matching.js';

test('ageToRange maps ages into supported buckets', () => {
  assert.equal(ageToRange(9), '0-12');
  assert.equal(ageToRange(15), '13-17');
  assert.equal(ageToRange(32), '18-40');
  assert.equal(ageToRange(58), '41-60');
  assert.equal(ageToRange(71), '60+');
});

test('scoreMatch rewards explainable field overlap and proximity', () => {
  const report = {
    ageRange: '60+',
    gender: 'male',
    hair: 'short grey hair',
    clothing: 'white kurta brown sandals',
    notes: 'dementia responds to Devji',
  };
  const found = {
    ageRange: '60+',
    gender: 'male',
    hair: 'grey hair',
    clothing: 'white kurta sandals',
    notes: 'confused responds to Devji',
  };

  const result = scoreMatch(report, found, 3);

  assert.ok(result.score >= MATCH_THRESHOLD);
  assert.ok(result.reasons.includes('gender matches'));
  assert.ok(result.reasons.includes('very close to last seen area'));
});

test('rankMatches filters weak matches and orders strong matches first', () => {
  const activeReports = [
    {
      id: 'strong',
      description: {
        ageRange: '60+',
        gender: 'male',
        hair: 'short grey hair',
        clothing: 'white kurta brown sandals',
        notes: 'dementia responds to Devji',
      },
      lastSeen: { lat: 28.5931, lng: 77.2197 },
    },
    {
      id: 'weak',
      description: {
        ageRange: '13-17',
        gender: 'female',
        hair: 'long black hair',
        clothing: 'school uniform',
        notes: 'school bag',
      },
      lastSeen: { lat: 12.9767, lng: 77.5713 },
    },
  ];

  const matches = rankMatches(activeReports, {
    ageRange: '60+',
    gender: 'male',
    hair: 'grey hair',
    clothing: 'white kurta',
    notes: 'confused Devji',
  }, { lat: 28.59, lng: 77.22 });

  assert.equal(matches.length, 1);
  assert.equal(matches[0].report.id, 'strong');
});
