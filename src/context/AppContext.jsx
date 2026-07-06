import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { rankMatches, ageToRange } from '../services/matching.js';
import { buildDemoState } from '../data/seed.js';

const STORAGE_KEY = 'lookout:v2:state';

const EMPTY = {
  session: null,
  users: [],
  members: [],
  reports: [],
  foundReports: [],
  notifications: [],
};

const AppContext = createContext(null);

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.users)) {
        return { ...EMPTY, ...parsed };
      }
    }
  } catch {
    // corrupted storage — start fresh
  }
  return EMPTY;
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeCaseId() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++)
    s += chars[Math.floor(Math.random() * chars.length)];
  return `LKT-${s}`;
}

const now = () => new Date().toISOString();

// Stable, anonymous pseudonym per user — lets a family see that several
// updates came from the same finder without ever revealing who they are.
function anonFinderId(userId) {
  const s = String(userId || 'anon');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 4).toUpperCase();
}

export function AppProvider({ children }) {
  const [state, setState] = useState(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // quota exceeded — keep running in memory
    }
  }, [state]);

  const value = useMemo(() => {
    const notif = (n) => ({ id: uuid(), at: now(), read: false, ...n });

    /* ---------- auth ---------- */

    const completeSignIn = (phone, name) => {
      let user = state.users.find((u) => u.phone === phone);
      setState((prev) => {
        let users = prev.users;
        let existing = users.find((u) => u.phone === phone);
        if (!existing) {
          existing = { id: uuid(), phone, name, createdAt: now() };
          users = [...users, existing];
        }
        return { ...prev, users, session: { userId: existing.id } };
      });
      return !!user;
    };

    const userExists = (phone) => state.users.some((u) => u.phone === phone);

    const signOut = () => setState((prev) => ({ ...prev, session: null }));

    const currentUser = state.session
      ? state.users.find((u) => u.id === state.session.userId) || null
      : null;

    /* ---------- family members ---------- */

    const addMember = (data) => {
      const member = { ...data, id: uuid(), userId: state.session?.userId, createdAt: now() };
      setState((prev) => ({ ...prev, members: [...prev.members, member] }));
      return member.id;
    };

    const myMembers = currentUser
      ? state.members.filter((m) => m.userId === currentUser.id)
      : [];

    const memberById = (id) => state.members.find((m) => m.id === id) || null;

    const activeReportForMember = (memberId) =>
      state.reports.find(
        (r) => r.memberId === memberId && r.status === 'active'
      ) || null;

    /* ---------- missing reports ---------- */

    const fileReport = ({ memberId, hair, clothing, notes, lastSeen }) => {
      const member = memberById(memberId);
      if (!member) return null;

      const report = {
        id: uuid(),
        caseId: makeCaseId(),
        userId: state.session?.userId,
        memberId,
        description: {
          ageRange: ageToRange(member.age),
          gender: member.gender,
          hair,
          clothing,
          notes: [notes, member.marks].filter(Boolean).join('. '),
        },
        lastSeen: { ...lastSeen, at: lastSeen.at || now() },
        status: 'active',
        createdAt: now(),
        resolvedAt: null,
        gateAcks: [],
        sightings: [],
      };

      // Cross-reference open Found Person reports (description + proximity)
      const openFound = state.foundReports.filter((f) => f.status === 'open');
      let crossMatch = null;
      for (const f of openFound) {
        const [m] = rankMatches([report], f.description, f.location);
        if (m && (!crossMatch || m.score > crossMatch.score)) {
          crossMatch = { found: f, score: m.score, reasons: m.reasons };
        }
      }

      setState((prev) => {
        let foundReports = prev.foundReports;
        let sightings = [];
        const notifications = [
          notif({
            audience: 'nearby',
            reportId: report.id,
            title: 'Missing person alert in your area',
            body: `${member.name}, ${member.age}, last seen at ${report.lastSeen.label}. QR tag is now active.`,
          }),
          ...prev.notifications,
        ];

        if (crossMatch) {
          foundReports = foundReports.map((f) =>
            f.id === crossMatch.found.id
              ? { ...f, status: 'linked', linkedReportId: report.id }
              : f
          );
          sightings = [
            {
              id: uuid(),
              at: crossMatch.found.createdAt,
              lat: crossMatch.found.location.lat,
              lng: crossMatch.found.location.lng,
              label: crossMatch.found.location.label,
              note: `Possible match from an earlier Found Person report. Person reported safe: ${crossMatch.found.whereSafe}.`,
              source: 'found-report',
              withPolice: false,
              stationId: null,
            },
          ];
          notifications.unshift(
            notif({
              audience: 'family',
              reportId: report.id,
              kind: 'possible',
              finderKey: null,
              title: 'Possible match found immediately',
              body: `A Found Person report filed earlier matches this description (${crossMatch.reasons.join(', ')}). Location: ${crossMatch.found.location.label}.`,
            })
          );
        }

        return {
          ...prev,
          reports: [{ ...report, sightings }, ...prev.reports],
          foundReports,
          notifications,
        };
      });

      return { reportId: report.id, caseId: report.caseId, crossMatch };
    };

    const reportById = (id) => state.reports.find((r) => r.id === id) || null;

    const activeReports = state.reports.filter((r) => r.status === 'active');

    const myReports = currentUser
      ? state.reports.filter((r) => r.userId === currentUser.id)
      : [];

    /* ---------- finder actions ---------- */

    const recordGateAck = (reportId) => {
      const at = now();
      setState((prev) => ({
        ...prev,
        reports: prev.reports.map((r) =>
          r.id === reportId ? { ...r, gateAcks: [...(r.gateAcks || []), { at }] } : r
        ),
      }));
      return at;
    };

    const addSighting = (reportId, { lat, lng, label, note, source }) => {
      const report = reportById(reportId);
      const member = report ? memberById(report.memberId) : null;
      const confirmed = source === 'qr-scan';
      const name = member ? member.name : 'your report';
      const finderKey = anonFinderId(state.session?.userId);
      setState((prev) => ({
        ...prev,
        reports: prev.reports.map((r) =>
          r.id === reportId
            ? {
                ...r,
                sightings: [
                  {
                    id: uuid(),
                    at: now(),
                    lat,
                    lng,
                    label,
                    note,
                    source,
                    finderKey,
                    withPolice: false,
                    stationId: null,
                  },
                  ...r.sightings,
                ],
              }
            : r
        ),
        notifications: [
          notif({
            audience: 'family',
            reportId,
            kind: confirmed ? 'confirmed' : 'possible',
            finderKey,
            title: confirmed
              ? 'Sighting confirmed — QR tag scanned'
              : 'Possible sighting reported',
            body: confirmed
              ? `Finder #${finderKey} scanned ${name}'s tag and shared a location pin${label ? ` near ${label}` : ''}. The search zone has re-anchored there.`
              : `Finder #${finderKey} reported a possible sighting matching ${name}'s description${label ? ` near ${label}` : ''}. Not confirmed by tag scan — treat as a lead.`,
          }),
          ...prev.notifications,
        ],
      }));
    };

    const markWithPolice = (reportId, station) => {
      const report = reportById(reportId);
      const member = report ? memberById(report.memberId) : null;
      const finderKey = anonFinderId(state.session?.userId);
      setState((prev) => ({
        ...prev,
        reports: prev.reports.map((r) =>
          r.id === reportId
            ? {
                ...r,
                sightings: [
                  {
                    id: uuid(),
                    at: now(),
                    lat: station.lat,
                    lng: station.lng,
                    label: station.name,
                    note: 'Finder confirmed the person is safe with police.',
                    source: 'police-handoff',
                    finderKey,
                    withPolice: true,
                    stationId: station.id,
                  },
                  ...r.sightings,
                ],
              }
            : r
        ),
        notifications: [
          notif({
            audience: 'family',
            reportId,
            kind: 'confirmed',
            finderKey,
            title: `${member ? member.name : 'Person'} is with police`,
            body: `Case ${report?.caseId}: finder #${finderKey} confirmed handoff at ${station.name}, ${station.city} (${station.phone}). Please contact the station.`,
          }),
          ...prev.notifications,
        ],
      }));
    };

    // Only the family who filed the report may move the authoritative
    // last-seen location that the whole community's alert zone is built from.
    // Finder sightings never call this — they stay private leads on the case.
    const updateLastSeen = (reportId, { lat, lng, label, at }) => {
      const report = reportById(reportId);
      if (!report || report.userId !== state.session?.userId) return false;
      const member = memberById(report.memberId);
      setState((prev) => ({
        ...prev,
        reports: prev.reports.map((r) =>
          r.id === reportId
            ? {
                ...r,
                lastSeen: {
                  lat,
                  lng,
                  label,
                  at: at || now(),
                  anchoredAt: now(),
                },
              }
            : r
        ),
        notifications: [
          notif({
            audience: 'nearby',
            reportId,
            title: 'Last-seen location updated',
            body: `${member ? member.name : 'The missing person'}'s last-seen location was updated by the family to ${label}. The alert zone has moved and the search radius reset.`,
          }),
          ...prev.notifications,
        ],
      }));
      return true;
    };

    /* ---------- resolution ---------- */

    const resolveReport = (reportId) => {
      const report = reportById(reportId);
      if (!report || report.userId !== state.session?.userId) return false;
      const member = report ? memberById(report.memberId) : null;
      setState((prev) => ({
        ...prev,
        reports: prev.reports.map((r) =>
          r.id === reportId
            ? {
                ...r,
                status: 'resolved',
                resolvedAt: now(),
                // Privacy by design: sighting data is purged on resolution.
                sightings: [],
                gateAcks: [],
              }
            : r
        ),
        notifications: [
          notif({
            audience: 'nearby',
            reportId,
            title: 'Alert deactivated',
            body: `${member ? member.name : 'The missing person'} has been found safe. Thank you for looking out. The QR tag is inactive again and sighting data has been deleted.`,
          }),
          ...prev.notifications,
        ],
      }));
      return true;
    };

    /* ---------- found person reports (no missing report yet) ---------- */

    const fileFoundReport = ({ description, location, whereSafe }) => {
      const matches = rankMatches(activeReports, description, location);
      const found = {
        id: uuid(),
        description,
        location,
        whereSafe,
        createdAt: now(),
        status: 'open',
        linkedReportId: null,
      };
      const finderKey = anonFinderId(state.session?.userId);
      setState((prev) => {
        // For every active missing report this description matches, alert the
        // family who filed it and drop a sighting "lead" on their case — even
        // though no QR tag was scanned. It's an unconfirmed lead (kind
        // 'possible'), so it won't re-anchor the search geofence.
        let reports = prev.reports;
        const newNotifs = [];
        for (const m of matches) {
          const member = prev.members.find((mm) => mm.id === m.report.memberId);
          const name = member ? member.name : 'your family member';
          reports = reports.map((r) =>
            r.id === m.report.id
              ? {
                  ...r,
                  sightings: [
                    {
                      id: uuid(),
                      at: found.createdAt,
                      lat: location.lat,
                      lng: location.lng,
                      label: location.label,
                      note: `Found Person report matches this description (${m.reasons.join(', ')}). Reported safe: ${whereSafe}.`,
                      source: 'found-report',
                      finderKey,
                      withPolice: false,
                      stationId: null,
                    },
                    ...r.sightings,
                  ],
                }
              : r
          );
          newNotifs.push(
            notif({
              audience: 'family',
              reportId: m.report.id,
              kind: 'possible',
              finderKey,
              title: 'Possible sighting — Found Person report filed',
              body: `Someone reported finding a person matching ${name}'s description${location.label ? ` near ${location.label}` : ''} (${m.reasons.join(', ')}). Reported safe: ${whereSafe}. Not confirmed by a tag scan — treat as a lead.`,
            })
          );
        }
        return {
          ...prev,
          foundReports: [found, ...prev.foundReports],
          reports,
          notifications: [...newNotifs, ...prev.notifications],
        };
      });
      return { foundId: found.id, matches };
    };

    const searchActiveReports = (description, location) =>
      rankMatches(activeReports, description, location);

    /* ---------- notifications ---------- */

    const myReportIds = new Set(myReports.map((r) => r.id));

    const unreadCount = currentUser
      ? state.notifications.filter(
          (n) =>
            !n.read && n.audience === 'family' && myReportIds.has(n.reportId)
        ).length
      : 0;

    const markAllRead = () =>
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) =>
          n.audience === 'family' && myReportIds.has(n.reportId)
            ? { ...n, read: true }
            : n
        ),
      }));

    /* ---------- demo helpers ---------- */

    const loadDemo = () => setState(buildDemoState());
    const resetAll = () => setState(EMPTY);

    return {
      state,
      currentUser,
      myMembers,
      myReports,
      activeReports,
      unreadCount,
      completeSignIn,
      userExists,
      signOut,
      addMember,
      memberById,
      activeReportForMember,
      fileReport,
      reportById,
      recordGateAck,
      addSighting,
      markWithPolice,
      updateLastSeen,
      resolveReport,
      fileFoundReport,
      searchActiveReports,
      markAllRead,
      loadDemo,
      resetAll,
    };
  }, [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
