import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import LocationPicker from '../components/LocationPicker.jsx';

export default function ReportPage() {
  const { currentUser, myMembers, activeReportForMember, fileReport } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const eligible = myMembers.filter((m) => !activeReportForMember(m.id));
  const preselect = params.get('member');

  const [form, setForm] = useState({
    memberId: preselect && eligible.some((m) => m.id === preselect) ? preselect : '',
    hair: '',
    clothing: '',
    notes: '',
    lastSeenAt: '',
  });
  const [coords, setCoords] = useState(null);
  const [errors, setErrors] = useState({});

  if (!currentUser) return <Navigate to="/signup" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const er = {};
    if (!form.memberId) er.memberId = 'Select who is missing.';
    if (!form.clothing.trim()) er.clothing = 'Clothing description is required.';
    if (!coords)
      er.coords =
        'Set the last seen location (search, use your location, or click the map) — alerts are geofenced around it.';
    if (form.lastSeenAt && new Date(form.lastSeenAt) > new Date())
      er.lastSeenAt = 'Time cannot be in the future.';
    setErrors(er);
    if (Object.keys(er).length > 0) return;

    const result = fileReport({
      memberId: form.memberId,
      hair: form.hair.trim(),
      clothing: form.clothing.trim(),
      notes: form.notes.trim(),
      lastSeen: {
        label: coords.label,
        lat: coords.lat,
        lng: coords.lng,
        at: form.lastSeenAt ? new Date(form.lastSeenAt).toISOString() : null,
      },
    });
    if (result) navigate(`/report/${result.reportId}`);
  };

  return (
    <>
      <h1 className="section-title" style={{ marginTop: 0 }}>
        File a Missing Report
      </h1>
      <div className="notice">
        Filing a report activates the person&apos;s QR tag and sends a
        geofenced alert to nearby Lookout users. The alert radius expands
        automatically until a sighting comes in. No photo is required — the
        network works on descriptions and the QR identity layer.
      </div>

      {eligible.length === 0 ? (
        <div className="empty">
          <p>
            All registered family members already have an active report, or you
            haven&apos;t registered anyone yet. Register them on the My Family
            page first.
          </p>
        </div>
      ) : (
        <form className="panel" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="r-member">Who is missing?</label>
            <select
              id="r-member"
              value={form.memberId}
              onChange={set('memberId')}
              style={{ width: '100%' }}
            >
              <option value="">Select a family member…</option>
              {eligible.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.age}, {m.gender}
                </option>
              ))}
            </select>
            {errors.memberId && (
              <div className="error-text">{errors.memberId}</div>
            )}
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="r-hair">Hair</label>
              <input
                id="r-hair"
                placeholder="e.g. short grey hair"
                value={form.hair}
                onChange={set('hair')}
              />
            </div>
            <div className="field">
              <label htmlFor="r-clothing">Clothing when last seen</label>
              <input
                id="r-clothing"
                placeholder="e.g. white kurta, brown sandals"
                value={form.clothing}
                onChange={set('clothing')}
              />
              {errors.clothing && (
                <div className="error-text">{errors.clothing}</div>
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor="r-notes">Circumstances / other details</label>
            <textarea
              id="r-notes"
              placeholder="What happened, direction they may have gone, state of mind…"
              value={form.notes}
              onChange={set('notes')}
            />
          </div>

          <div className="field">
            <label htmlFor="r-when">When were they last seen? (optional)</label>
            <input
              id="r-when"
              type="datetime-local"
              value={form.lastSeenAt}
              onChange={set('lastSeenAt')}
            />
            {errors.lastSeenAt && (
              <div className="error-text">{errors.lastSeenAt}</div>
            )}
          </div>

          <div className="field">
            <label>Last seen location</label>
            <LocationPicker
              value={coords}
              onChange={setCoords}
              placeholder="e.g. Lodhi Garden, New Delhi"
            />
            {errors.coords && <div className="error-text">{errors.coords}</div>}
          </div>

          <button className="btn">Activate alert network</button>
        </form>
      )}
    </>
  );
}
