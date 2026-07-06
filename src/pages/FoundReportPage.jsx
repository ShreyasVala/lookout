import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import LocationPicker from '../components/LocationPicker.jsx';
import { AGE_RANGES } from '../services/matching.js';
import { findNearestStation } from '../services/geo.js';
import { policeStations } from '../data/policeStations.js';

export default function FoundReportPage() {
  const { fileFoundReport, memberById } = useApp();
  const [desc, setDesc] = useState({
    ageRange: '',
    gender: 'unsure',
    hair: '',
    clothing: '',
    notes: '',
  });
  const [loc, setLoc] = useState(null);
  const [whereSafe, setWhereSafe] = useState('');
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState(null);
  const [station, setStation] = useState(null);
  const [stationLoading, setStationLoading] = useState(false);

  // Look up the nearest real police station to where the person was found
  // once the report is filed. Runs against the live Overpass directory.
  useEffect(() => {
    if (!outcome || !loc) {
      setStationLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    setStation(null);
    setStationLoading(true);
    findNearestStation(loc.lat, loc.lng, {
      fallback: policeStations,
      signal: controller.signal,
    })
      .then((s) => {
        if (!cancelled) setStation(s);
      })
      .finally(() => {
        if (!cancelled) setStationLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [outcome, loc]);

  const set = (k) => (e) => setDesc((d) => ({ ...d, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!desc.ageRange || !whereSafe.trim() || !loc) {
      setError(
        'Age range, location, and where the person is safe are required.'
      );
      return;
    }
    setError('');
    const res = fileFoundReport({
      description: desc,
      location: { label: loc.label, lat: loc.lat, lng: loc.lng },
      whereSafe: whereSafe.trim(),
    });
    setOutcome(res);
  };

  if (outcome) {
    return (
      <div className="narrow">
        <h1 className="section-title" style={{ marginTop: 0 }}>
          Found Person report filed
        </h1>
        {stationLoading && loc && (
          <div className="panel" style={{ marginBottom: 14 }}>
            <p className="hint" style={{ margin: 0 }}>
              Finding the nearest police station…
            </p>
          </div>
        )}
        {!stationLoading && !station && loc && (
          <div className="panel" style={{ marginBottom: 14 }}>
            <h2 style={{ marginBottom: 6 }}>Police handoff</h2>
            <p className="hint" style={{ marginBottom: 0 }}>
              We could not find a nearby station automatically. If the person
              cannot stay where they are, call emergency services or use your
              map app to find the safest handoff point.
            </p>
          </div>
        )}
        {station && (
          <div className="panel" style={{ marginBottom: 14 }}>
            <h2 style={{ marginBottom: 6 }}>
              Nearest police station to where you found them (
              {station.distanceKm.toFixed(1)} km)
            </h2>
            <p style={{ marginBottom: 4 }}>
              <strong>{station.name}</strong>
              {station.city ? `, ${station.city}` : ''}
            </p>
            <p className="hint">
              {station.phone ? `${station.phone} — ` : ''}if the person
              can&apos;t stay where they are, this is the safest handoff point.
            </p>
          </div>
        )}
        {outcome.matches.length > 0 ? (
          <>
            <div className="notice">
              This description matches {outcome.matches.length} active missing
              report{outcome.matches.length > 1 ? 's' : ''} — you can proceed
              directly:
            </div>
            {outcome.matches.map((m) => {
              const member = memberById(m.report.memberId);
              return (
                <div key={m.report.id} className="panel match-card">
                  <strong>
                    {member ? `${member.name}, ${member.age}` : 'Unknown'}
                  </strong>
                  <p className="hint" style={{ margin: '4px 0 10px' }}>
                    Case {m.report.caseId} · {m.reasons.join(', ')}
                  </p>
                  <Link
                    to={`/finder/${m.report.id}?via=manual`}
                    state={loc ? { loc } : undefined}
                    className="btn"
                  >
                    This looks like them →
                  </Link>
                </div>
              );
            })}
          </>
        ) : (
          <div className="notice">
            No active report matches right now. Your report stays open — the
            moment a family files a matching missing report, both sides are
            notified instantly with your location and where the person is safe.
          </div>
        )}
        <Link to="/" className="btn secondary" style={{ marginTop: 12 }}>
          Done
        </Link>
      </div>
    );
  }

  return (
    <div className="narrow">
      <h1 className="section-title" style={{ marginTop: 0 }}>
        Report a Found Person
      </h1>
      <p className="hint" style={{ marginBottom: 16 }}>
        Use this when you&apos;ve found someone who seems lost but there&apos;s
        no matching missing report yet. First: make sure they are somewhere
        safe (police station, hospital, help desk).
      </p>

      <form className="panel" onSubmit={submit}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="fp-age">Approximate age</label>
            <select
              id="fp-age"
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
            <label htmlFor="fp-gender">Gender</label>
            <select
              id="fp-gender"
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
            <label htmlFor="fp-hair">Hair</label>
            <input id="fp-hair" value={desc.hair} onChange={set('hair')} />
          </div>
          <div className="field">
            <label htmlFor="fp-clothing">Clothing</label>
            <input
              id="fp-clothing"
              value={desc.clothing}
              onChange={set('clothing')}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="fp-notes">Other details</label>
          <input id="fp-notes" value={desc.notes} onChange={set('notes')} />
        </div>
        <div className="field">
          <label>Where did you find them?</label>
          <LocationPicker
            value={loc}
            onChange={setLoc}
            placeholder="e.g. Majestic Bus Stand, Bengaluru"
          />
        </div>
        <div className="field">
          <label htmlFor="fp-safe">Where is the person now (safe)?</label>
          <input
            id="fp-safe"
            placeholder="e.g. with the station help desk staff"
            value={whereSafe}
            onChange={(e) => setWhereSafe(e.target.value)}
          />
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn">File Found Person report</button>
      </form>
    </div>
  );
}
