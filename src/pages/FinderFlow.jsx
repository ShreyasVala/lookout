import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import LocationPicker from '../components/LocationPicker.jsx';
import { policeStations } from '../data/policeStations.js';
import {
  haversineKm,
  findNearestStation,
  FAMILY_DISTANT_KM,
} from '../services/geo.js';

export default function FinderFlow() {
  const { reportId } = useParams();
  const [params] = useSearchParams();
  const via = params.get('via') === 'manual' ? 'manual-match' : 'qr-scan';
  const { reportById, memberById, recordGateAck, addSighting, markWithPolice } =
    useApp();

  const report = reportById(reportId);
  const member = report ? memberById(report.memberId) : null;

  // Location may arrive prefilled from the found/description flow —
  // it represents where the PERSON was found or sighted.
  const routeLoc = useLocation().state?.loc || null;

  const [step, setStep] = useState('gate'); // gate → locate → act → done
  const [acked, setAcked] = useState(false);
  const [ackAt, setAckAt] = useState(null);
  const [loc, setLoc] = useState(routeLoc);
  const [locLabel, setLocLabel] = useState(routeLoc?.label || '');
  const [note, setNote] = useState('');
  const [notified, setNotified] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const [station, setStation] = useState(null);
  const [stationLoading, setStationLoading] = useState(false);

  // Nearest real police station to the PERSON's location, looked up live
  // whenever the pin changes.
  useEffect(() => {
    if (!loc) {
      setStation(null);
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
  }, [loc]);

  if (!report || report.status !== 'active' || !member) {
    return (
      <div className="empty">
        <p>This report is not active.</p>
        <Link to="/scan" className="btn secondary" style={{ marginTop: 12 }}>
          Back to scanner
        </Link>
      </div>
    );
  }

  const d = report.description;
  const familyKm =
    loc && typeof report.lastSeen.lat === 'number'
      ? haversineKm(loc.lat, loc.lng, report.lastSeen.lat, report.lastSeen.lng)
      : null;
  const familyDistant = familyKm !== null && familyKm > FAMILY_DISTANT_KM;

  const onPick = (v) => {
    setLoc(v);
    if (v.label) setLocLabel((prev) => prev || v.label);
  };

  const notifyFamily = () => {
    addSighting(report.id, {
      lat: loc.lat,
      lng: loc.lng,
      label: locLabel.trim() || 'Finder location pin',
      note:
        note.trim() ||
        (via === 'manual-match'
          ? 'Finder believes this person matches the description and shared a location pin.'
          : 'Finder scanned the QR tag and shared a location pin.'),
      source: via,
    });
    setNotified(true);
  };

  const confirmWithPolice = () => {
    markWithPolice(report.id, station);
    setHandedOff(true);
    setStep('done');
  };

  const steps = ['gate', 'locate', 'act', 'done'];

  return (
    <div className="narrow">
      <div className="steps">
        {['Safety', 'Location', 'Help', 'Done'].map((label, i) => (
          <span
            key={label}
            className={
              steps.indexOf(step) >= i ? 'step-dot active' : 'step-dot'
            }
          >
            {label}
          </span>
        ))}
      </div>

      <h1 className="section-title" style={{ marginTop: 8 }}>
        Active report matched: {member.name}, {member.age}
      </h1>
      <p className="hint">
        Case {report.caseId} · {[d.hair, d.clothing].filter(Boolean).join(' · ')}
      </p>
      {via === 'manual-match' && (
        <div className="notice" style={{ marginBottom: 14 }}>
          No tag was scanned — you matched by description, so this will reach
          the family as a <strong>possible sighting</strong>. A QR tag scan
          counts as confirmed.
        </div>
      )}

      {step === 'gate' && (
        <div className="panel gate">
          <h2 style={{ marginBottom: 10 }}>⚠ Before you do anything</h2>
          <ul className="gate-list">
            <li>Do not physically restrain or detain the person.</li>
            <li>
              If they are in immediate danger or a medical emergency, call
              <strong> 112 </strong> first.
            </li>
            <li>Speak calmly; they may be disoriented or frightened.</li>
            <li>
              Your identity stays anonymous — the family only receives a
              location pin.
            </li>
          </ul>
          <label className="check">
            <input
              type="checkbox"
              checked={acked}
              onChange={(e) => setAcked(e.target.checked)}
            />
            I understand and will act safely
          </label>
          <button
            className="btn"
            disabled={!acked}
            onClick={() => {
              const at = recordGateAck(report.id);
              setAckAt(at);
              setStep('locate');
            }}
          >
            Continue
          </button>
        </div>
      )}

      {step === 'locate' && (
        <div className="panel">
          <h2 style={{ marginBottom: 6 }}>Where is the person right now?</h2>
          <p className="hint" style={{ marginBottom: 12 }}>
            Acknowledged at {ackAt ? new Date(ackAt).toLocaleTimeString() : ''}.
            Drop the pin where you found them — the nearest police station and
            the family&apos;s location pin are based on the{' '}
            <strong>person&apos;s</strong> location, not yours. Use “My
            location” if you&apos;re standing with them.
          </p>
          {routeLoc && (
            <div className="notice" style={{ marginBottom: 12 }}>
              Pre-filled with the location you already reported — adjust it if
              the person has moved.
            </div>
          )}
          <LocationPicker value={loc} onChange={onPick} />
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="f-label">Describe the spot (optional)</label>
            <input
              id="f-label"
              placeholder="e.g. outside Central Mall main gate"
              value={locLabel}
              onChange={(e) => setLocLabel(e.target.value)}
            />
          </div>
          <button className="btn" disabled={!loc} onClick={() => setStep('act')}>
            Continue
          </button>
        </div>
      )}

      {step === 'act' && loc && (
        <>
          {familyDistant && (
            <div className="notice warning">
              The family&apos;s last-seen area is{' '}
              <strong>{Math.round(familyKm)} km away</strong> — they cannot
              reach you quickly. Taking the person to the nearest police
              station is the priority.
            </div>
          )}

          {[
            {
              key: 'police',
              order: familyDistant ? 0 : 1,
              el: station ? (
                <div className="panel" key="police" style={{ marginBottom: 14 }}>
                  <h2 style={{ marginBottom: 6 }}>
                    Nearest police station to the person (
                    {station.distanceKm.toFixed(1)} km)
                  </h2>
                  <p style={{ marginBottom: 4 }}>
                    <strong>{station.name}</strong>
                    {station.city ? `, ${station.city}` : ''}
                  </p>
                  <p className="hint" style={{ marginBottom: 12 }}>
                    {station.phone ? `${station.phone} · ` : ''}Tell them the
                    Lookout case ID: <strong>{report.caseId}</strong>
                  </p>
                  <button
                    className="btn success"
                    onClick={confirmWithPolice}
                    disabled={handedOff}
                  >
                    ✓ Person is with police
                  </button>
                </div>
              ) : (
                <div className="panel" key="police" style={{ marginBottom: 14 }}>
                  {stationLoading ? (
                    <p className="hint" style={{ margin: 0 }}>
                    Finding the nearest police station to the person…
                    </p>
                  ) : (
                    <>
                      <h2 style={{ marginBottom: 6 }}>Police handoff</h2>
                      <p className="hint" style={{ marginBottom: 0 }}>
                        We could not find a nearby station automatically. Call
                        emergency services or use your map app, and share the
                        Lookout case ID: <strong>{report.caseId}</strong>.
                      </p>
                    </>
                  )}
                </div>
              ),
            },
            {
              key: 'family',
              order: familyDistant ? 1 : 0,
              el: (
                <div className="panel" key="family" style={{ marginBottom: 14 }}>
                  <h2 style={{ marginBottom: 6 }}>Notify the family</h2>
                  <p className="hint" style={{ marginBottom: 12 }}>
                    Sends your pin anonymously. Your name and number are never
                    shared.
                  </p>
                  <div className="field">
                    <label htmlFor="f-note">Anything they should know?</label>
                    <textarea
                      id="f-note"
                      placeholder="Condition, what they're doing, who they're with…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                  {notified ? (
                    <p style={{ color: 'var(--success)' }}>
                      ✓ Family notified with the location pin
                      {via === 'manual-match' ? ' (as a possible sighting)' : ''}.
                    </p>
                  ) : (
                    <button className="btn" onClick={notifyFamily}>
                      {via === 'manual-match'
                        ? 'Send possible sighting (anonymous pin)'
                        : 'Send anonymous location pin'}
                    </button>
                  )}
                </div>
              ),
            },
          ]
            .sort((a, b) => a.order - b.order)
            .map((x) => x.el)}
        </>
      )}

      {step === 'done' && (
        <div className="panel">
          <h2 style={{ marginBottom: 10 }}>Thank you. 💛</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 8 }}>
            The family has been sent the station address and case ID{' '}
            <strong>{report.caseId}</strong>. They&apos;ll close the report
            once reunited.
          </p>
          <Link to="/" className="btn secondary">
            Done
          </Link>
        </div>
      )}
    </div>
  );
}
