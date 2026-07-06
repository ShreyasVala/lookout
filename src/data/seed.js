// Optional demo dataset so reviewers can explore every flow without
// registering first. Loaded via the "Try the demo" button on the landing
// page. All data is fictional.

const hoursAgo = (h) => new Date(Date.now() - h * 36e5).toISOString();

export function buildDemoState() {
  const userId = 'demo-user';
  const memberA = 'a1b2c3d4-0000-4000-8000-demo00000001';
  const memberB = 'a1b2c3d4-0000-4000-8000-demo00000002';

  return {
    session: { userId },
    users: [
      {
        id: userId,
        phone: '+91 99999 99999',
        name: 'Demo Family',
        createdAt: hoursAgo(72),
      },
    ],
    members: [
      {
        id: memberA,
        userId,
        name: 'Dev Malhotra',
        age: 71,
        gender: 'male',
        heightCm: 168,
        marks: 'Mild dementia, responds to "Devji". Mole on left cheek.',
        createdAt: hoursAgo(72),
      },
      {
        id: memberB,
        userId,
        name: 'Ishaan Reddy',
        age: 9,
        gender: 'male',
        heightCm: 130,
        marks: 'Very shy with strangers.',
        createdAt: hoursAgo(72),
      },
    ],
    reports: [
      {
        id: 'demo-report-1',
        caseId: 'LKT-4H7D',
        userId,
        memberId: memberA,
        description: {
          ageRange: '60+',
          gender: 'male',
          hair: 'short grey hair',
          clothing: 'white kurta pajama, brown sandals',
          notes: 'has dementia, may be disoriented, responds to Devji',
        },
        lastSeen: {
          label: 'Lodhi Garden, New Delhi',
          lat: 28.5931,
          lng: 77.2197,
          at: hoursAgo(7),
        },
        status: 'active',
        createdAt: hoursAgo(6),
        resolvedAt: null,
        gateAcks: [{ at: hoursAgo(2) }],
        sightings: [
          {
            id: 'demo-sight-1',
            at: hoursAgo(2),
            lat: 28.5883,
            lng: 77.2508,
            label: 'Near Sundar Nursery gate',
            note: 'Elderly man in white kurta sitting alone on a bench, seemed confused. Reported via QR tag scan.',
            source: 'qr-scan',
            finderKey: 'K3TQ',
            withPolice: false,
            stationId: null,
          },
        ],
      },
    ],
    foundReports: [
      {
        id: 'demo-found-1',
        description: {
          ageRange: '13-17',
          gender: 'female',
          hair: 'long black hair, braided',
          clothing: 'school uniform, dark blue sweater',
          notes: 'not speaking, has a school bag with no name',
        },
        location: {
          label: 'Majestic Bus Stand, Bengaluru',
          lat: 12.9767,
          lng: 77.5713,
        },
        whereSafe: 'With the bus stand help desk staff',
        createdAt: hoursAgo(20),
        status: 'open',
        linkedReportId: null,
      },
    ],
    notifications: [
      {
        id: 'demo-n2',
        at: hoursAgo(2),
        audience: 'family',
        reportId: 'demo-report-1',
        kind: 'confirmed',
        finderKey: 'K3TQ',
        title: 'Sighting confirmed — QR tag scanned',
        body: 'Finder #K3TQ scanned Dev Malhotra’s tag near Sundar Nursery gate and shared a location pin. The search zone has re-anchored there.',
        read: false,
      },
      {
        id: 'demo-n1',
        at: hoursAgo(6),
        audience: 'nearby',
        reportId: 'demo-report-1',
        title: 'Missing person alert in your area',
        body: 'Dev Malhotra, 71, last seen at Lodhi Garden. Alert radius is expanding until a sighting comes in.',
        read: true,
      },
    ],
  };
}
