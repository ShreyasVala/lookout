import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import LocationPicker from '../components/LocationPicker.jsx';
import Scanner from '../components/Scanner.jsx';
import { QR_PREFIX } from '../components/QRCard.jsx';
import { AGE_RANGES } from '../services/matching.js';
import { haversineKm } from '../services/geo.js';
import { timeAgo } from '../utils/format.js';

const EMPTY_DESC = {
  ageRange: '',
  gender: 'unsure',
  hair: '',
  clothing: '',
  notes: '',
};

export default function FoundNoTag() {
  const {
    currentUser,
    searchActiveReports,
    activeReports,
    memberById,
    activeReportForMember,
  } = useApp();
  const navigate = useNavigate();

  const [tab, setTab] = useState('scan'); // 'scan' | 'describe'
  const [scanResult, setScanResult] = useState(null); // 'unknown' | 'inactive'
  const [manual, setManual] = useState('');

  const [desc, setDesc] = useState(EMPTY_DESC);
  const [loc, setLoc] = useState(null);
  const [results, setResults] = useState(null);
  const [mode, setMode] = useState('matches'); // 'matches' | 'all'

  if (!currentUser) return <Navigate to="/signup" replace />;

  /* ---------- tag scanning ---------- */

  const handleCode = (raw) => {
    const text = String(raw).trim();
    const uuid = text.startsWith(QR_PREFIX) ? text.slice(QR_PREFIX.length) : text;
    const member = memberById(uuid);
    if (!member) {
      setScanResult('unknown');
      return;
    }
    const report = activeReportForMember(member.id);
    if (!report) {
      setScanResult('inactive');
      return;
    }
    navigate(`/finder/${report.id}`);
  };

  /* ---------- description search ---------- */

  const set = (k) => (e) => setDesc((d) => ({ ...d, [k]: e.target.value }));

  const listAllSorted = () =>
    activeReports
      .map((r) => ({
        report: r,
        score: null,
        reasons: [],
        distanceKm:
          loc && typeof r.lastSeen?.lat === 'number'
            ? Math.round(
                haversineKm(loc.lat, loc.lng, r.lastSeen.lat, r.lastSeen.lng)
              )
            : null,
      }))
      .sort((a, b) => {
        if (
          a.distanceKm !== null &&
          b.distanceKm !== null &&
          a.distanceKm !== b.distanceKm
        )
          return a.distanceKm - b.distanceKm;
        return new Date(b.report.createdAt) - new Date(a.report.createdAt);
      });

  const search = (e) => {
    e.preventDefault();
    const enough = desc.ageRange && (desc.hair.trim() || desc.clothing.trim());
    if (enough) {
      const ranked = searchActiveReports(desc, loc);
      if (ranked.length > 0) {
        setMode('matches');
        setResults(ranked);
      } else {
        // no close match — fall back to all active alerts
        setMode('all');
        setResults(listAllSorted());
      }
    } else {
      // partial details — show every active alert, nearest & newest first
      setMode('all');
      setResults(listAllSorted());
    }
  };

  const renderResult = (m) => {
    const member = memberById(m.report.memberId);
    return (
      <div key={m.report.id} className="panel match-card">
        <div className="page-head" style={{ marginBottom: 6 }}>
          <div>
            <strong>{member ? `${member.name}, ${member.age}` : 'Unknown'}</strong>
            <div className="hint">
              Case {m.report.caseId} · last seen {m.report.lastSeen.label} ·{' '}
              {timeAgo(m.report.lastSeen.at)}
              {m.distanceKm !== null && ` · ~${m.distanceKm} km from you`}
            </div>
          </div>
          {m.score !== null && (
            <span className="badge sighted">match score {m.score}</span>
          )}
        </div>
        {m.reasons.length > 0 && (
          <p className="hint" style={{ marginBottom: 10 }}>
            Why: {m.reasons.join(', ')}
          </p>
        )}
        <Link
          to={`/finder/${m.report.id}?via=manual`}
          state={loc ? { loc } : undefined}
          className="btn"
        >
          This looks like them →
        </Link>
      </div>
    );
  };

  return (
    <div className="narrow">
      <h1 className="section-title" style={{ marginTop: 0 }}>
        I Found Someone
      </h1>

      <div className="steps" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={tab === 'scan' ? 'step-dot active as-tab' : 'step-dot as-tab'}
          onClick={() => setTab('scan')}
        >
          They have a Lookout tag
        </button>
        <button
          type="button"
          className={
            tab === 'describe' ? 'step-dot active as-tab' : 'step-dot as-tab'
          }
          onClick={() => setTab('describe')}
        >
          No tag — describe them
        </button>
      </div>

      {tab === 'scan' && (
        <>
          <p className="hint" style={{ marginBottom: 14 }}>
            Point your camera at the QR wristband or tag. If a missing report
            is active, you&apos;ll be guided step by step.
          </p>
          <Scanner onScan={handleCode} />
          <form
            className="panel"
            style={{ marginTop: 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) handleCode(manual);
            }}
          >
            <div className="field">
              <label htmlFor="manual-code">
                No camera? Enter the tag ID printed under the QR
              </label>
              <input
                id="manual-code"
                placeholder="e.g. a1b2c3d4-…"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
              />
            </div>
            <button className="btn secondary">Look up tag</button>
          </form>

          {scanResult === 'unknown' && (
            <div className="notice" style={{ marginTop: 14 }}>
              That code isn&apos;t a Lookout tag. Switch to{' '}
              <button
                type="button"
                className="popup-link as-link"
                onClick={() => setTab('describe')}
              >
                describe them
              </button>{' '}
              to search active reports instead.
            </div>
          )}
          {scanResult === 'inactive' && (
            <div className="notice" style={{ marginTop: 14 }}>
              This tag is registered but has{' '}
              <strong>no active missing report</strong>. If they seem lost or
              unsafe, stay with them and{' '}
              <Link to="/found/report" className="popup-link">
                file a Found Person report
              </Link>{' '}
              so their family is matched the moment they file.
            </div>
          )}
        </>
      )}

      {tab === 'describe' && (
        <>
          <p className="hint" style={{ marginBottom: 14 }}>
            Fill in what you noticed — even partial details work. With few
            details you&apos;ll see all active alerts, nearest and newest
            first. You choose the match; nothing is sent automatically.
          </p>
          <form className="panel" onSubmit={search}>
            <div className="field-row">
              <div className="field">
                <label htmlFor="s-age">Approximate age</label>
                <select
                  id="s-age"
                  value={desc.ageRange}
                  onChange={set('ageRange')}
                  style={{ width: '100%' }}
                >
                  <option value="">Select…</option>
                  {AGE_RANGES.map((r) => (
                    <option key={r} value={r}>
                      {r} years
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="s-gender">Gender</label>
                <select
                  id="s-gender"
                  value={desc.gender}
                  onChange={set('gender')}
                  style={{ width: '100%' }}
                >
                  <option value="unsure">Unsure</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="s-hair">Hair</label>
                <input
                  id="s-hair"
                  placeholder="e.g. short grey hair"
                  value={desc.hair}
                  onChange={set('hair')}
                />
              </div>
              <div className="field">
                <label htmlFor="s-clothing">Clothing</label>
                <input
                  id="s-clothing"
                  placeholder="e.g. white kurta, brown sandals"
                  value={desc.clothing}
                  onChange={set('clothing')}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="s-notes">Anything else you noticed</label>
              <input
                id="s-notes"
                placeholder="behaviour, belongings, condition…"
                value={desc.notes}
                onChange={set('notes')}
              />
            </div>
            <div className="field">
              <label>Where are you? (optional — sorts by nearest)</label>
              <LocationPicker value={loc} onChange={setLoc} />
            </div>
            <button className="btn">Search active reports</button>
          </form>

          {results && (
            <div style={{ marginTop: 20 }}>
              <h2 className="section-title">
                {mode === 'matches'
                  ? `${results.length} possible match${results.length > 1 ? 'es' : ''}`
                  : `All active alerts (${results.length}) — nearest & newest first`}
              </h2>
              {results.length === 0 ? (
                <div className="notice">
                  There are no active alerts right now. Please{' '}
                  <Link to="/found/report" className="popup-link">
                    file a Found Person report
                  </Link>{' '}
                  — if a family reports them missing later, both sides are
                  notified instantly.
                </div>
              ) : (
                <>
                  {mode === 'all' && (
                    <p className="hint" style={{ marginBottom: 12 }}>
                      No strong description match — showing every active
                      alert. If none of these are them,{' '}
                      <Link to="/found/report" className="popup-link">
                        file a Found Person report
                      </Link>
                      .
                    </p>
                  )}
                  {results.map(renderResult)}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
