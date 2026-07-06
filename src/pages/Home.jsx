import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { timeAgo } from '../utils/format.js';
import { alertZone } from '../services/geo.js';

export default function Home() {
  const { currentUser, myMembers, myReports, state, loadDemo, unreadCount } =
    useApp();

  if (!currentUser) {
    return (
      <section className="hero landing">
        <div className="brand-mark landing-mark" aria-hidden="true">
          ◎
        </div>
        <h1>
          Lookout. <span>Help bring them home.</span>
        </h1>
        <p>
          A QR identity layer for the people you love. Register family
          members, print their QR wristband tags, and if the worst happens,
          activate a geofenced alert network in seconds — finders are guided
          safely to police and family.
        </p>
        <div className="actions landing-actions">
          <Link to="/signup" className="btn">
            Sign up / Sign in
          </Link>
          <button className="btn secondary" onClick={loadDemo}>
            Try the demo
          </button>
        </div>
      </section>
    );
  }

  const active = myReports.filter((r) => r.status === 'active');
  const resolved = myReports.filter((r) => r.status === 'resolved');

  return (
    <>
      <section className="hero">
        <h1>
          Hi {currentUser.name || 'there'}
          {active.length > 0 ? (
            <span> — {active.length} active alert{active.length > 1 ? 's' : ''}.</span>
          ) : (
            <span> — all quiet.</span>
          )}
        </h1>
      </section>

      <section className="stats">
        <div className="stat">
          <div className="value">{myMembers.length}</div>
          <div className="label">Family registered</div>
        </div>
        <div className="stat danger">
          <div className="value">{active.length}</div>
          <div className="label">Active reports</div>
        </div>
        <div className="stat info">
          <div className="value">{unreadCount}</div>
          <div className="label">Unread alerts</div>
        </div>
        <div className="stat success">
          <div className="value">{resolved.length}</div>
          <div className="label">Found safe</div>
        </div>
      </section>

      <div className="actions" style={{ marginBottom: 24 }}>
        <Link to="/family" className="btn">
          My Family &amp; QR tags
        </Link>
        <Link to="/report/new" className="btn secondary">
          File missing report
        </Link>
        <Link to="/found" className="btn secondary">
          I Found Someone
        </Link>
        <Link to="/alerts" className="btn secondary">
          Alerts {unreadCount > 0 ? `(${unreadCount})` : ''}
        </Link>
      </div>

      {myReports.length > 0 && (
        <>
          <h2 className="section-title">Your Reports</h2>
          <div className="grid">
            {myReports.map((r) => {
              const member = state.members.find((m) => m.id === r.memberId);
              const zone = alertZone(r);
              return (
                <Link key={r.id} to={`/report/${r.id}`} className="card">
                  <div className="card-head">
                    <div>
                      <div className="card-title">
                        {member ? member.name : 'Unknown'}
                      </div>
                      <div className="card-sub">
                        Case {r.caseId} · filed {timeAgo(r.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="card-foot">
                    <StatusBadge report={r} />
                    <span>
                      {r.status === 'active'
                        ? `${r.sightings.length} sighting${r.sightings.length === 1 ? '' : 's'} · ${zone.radiusKm.toFixed(0)} km zone`
                        : 'Closed'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
