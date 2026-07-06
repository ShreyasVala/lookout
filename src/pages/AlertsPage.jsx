import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { timeAgo } from '../utils/format.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function AlertsPage() {
  const { currentUser, state, markAllRead } = useApp();

  useEffect(() => {
    if (!currentUser) return undefined;
    const t = setTimeout(markAllRead, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!currentUser) return <Navigate to="/signup" replace />;

  const reportOf = (n) => state.reports.find((r) => r.id === n.reportId);
  const isMine = (r) => r && r.userId === currentUser.id;

  // Community feed rules:
  // - only missing alerts and found-safe notices (audience 'nearby')
  // - your own reports' alerts are never shown to you
  // - found-safe notices disappear 24h after resolution
  const community = state.notifications.filter((n) => {
    if (n.audience !== 'nearby') return false;
    const r = reportOf(n);
    if (!r || isMine(r)) return false;
    if (r.status === 'active') return true;
    return (
      r.resolvedAt && Date.now() - new Date(r.resolvedAt).getTime() < DAY_MS
    );
  });

  // Sightings, police handoffs, matches — only for reports you filed.
  const family = state.notifications.filter(
    (n) => n.audience === 'family' && isMine(reportOf(n))
  );

  const confirmed = family.filter((n) => n.kind === 'confirmed');
  const possible = family.filter((n) => n.kind === 'possible');
  const other = family.filter((n) => !n.kind);

  // Thread updates from the same anonymous finder into one card.
  const groupByFinder = (list) => {
    const groups = new Map();
    for (const n of list) {
      const key = `${n.reportId}:${n.finderKey || 'system'}`;
      if (!groups.has(key)) groups.set(key, { finderKey: n.finderKey, items: [] });
      groups.get(key).items.push(n);
    }
    return [...groups.values()];
  };

  const renderGroup = (group) => {
    const first = group.items[0];
    const anyUnread = group.items.some((n) => !n.read);
    return (
      <div
        key={`${first.reportId}:${group.finderKey || 'system'}`}
        className={anyUnread ? 'alert-item unread' : 'alert-item'}
      >
        <div className="page-head" style={{ marginBottom: 6 }}>
          <strong>
            {group.finderKey
              ? `Anonymous finder #${group.finderKey}`
              : 'System update'}
          </strong>
          <span className="hint">{timeAgo(first.at)}</span>
        </div>
        {group.items.map((n) => (
          <div key={n.id} className="thread-item">
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{n.title}</div>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>{n.body}</p>
            <span className="hint">{timeAgo(n.at)}</span>
          </div>
        ))}
        {first.reportId && (
          <Link to={`/report/${first.reportId}`} className="popup-link">
            Open case →
          </Link>
        )}
      </div>
    );
  };

  return (
    <>
      <h1 className="section-title" style={{ marginTop: 0 }}>
        Your Case Updates
      </h1>
      <p className="hint" style={{ marginBottom: 12 }}>
        Visible only to you as the reporter. Updates from the same anonymous
        finder are threaded together.
      </p>
      {family.length === 0 && <p style={{ color: 'var(--muted)' }}>Nothing yet.</p>}

      {confirmed.length > 0 && (
        <>
          <h2 className="feed-title confirmed">
            Confirmed — QR scans &amp; police handoffs
          </h2>
          <div className="alert-list">
            {groupByFinder(confirmed).map(renderGroup)}
          </div>
        </>
      )}

      {possible.length > 0 && (
        <>
          <h2 className="feed-title possible">Possible sightings — unverified leads</h2>
          <div className="alert-list">
            {groupByFinder(possible).map(renderGroup)}
          </div>
        </>
      )}

      {other.length > 0 && (
        <>
          <h2 className="feed-title">Other updates</h2>
          <div className="alert-list">{groupByFinder(other).map(renderGroup)}</div>
        </>
      )}

      <h2 className="section-title">Community Alerts</h2>
      <p className="hint" style={{ marginBottom: 12 }}>
        Missing person alerts near you. Your own alerts aren&apos;t shown here,
        and found-safe notices disappear after a day.
      </p>
      {community.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No community alerts right now.</p>
      ) : (
        <div className="alert-list">
          {community.map((n) => (
            <div key={n.id} className="alert-item">
              <div className="page-head" style={{ marginBottom: 2 }}>
                <strong>{n.title}</strong>
                <span className="hint">{timeAgo(n.at)}</span>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                {n.body}
              </p>
              <Link to="/found" className="popup-link">
                I think I&apos;ve seen them →
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
