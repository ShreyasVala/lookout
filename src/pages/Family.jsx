import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import QRCard from '../components/QRCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function Family() {
  const { currentUser, myMembers, addMember, activeReportForMember } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    age: '',
    gender: 'female',
    heightCm: '',
    marks: '',
  });
  const [error, setError] = useState('');

  if (!currentUser) return <Navigate to="/signup" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const age = Number(form.age);
    if (!form.name.trim() || !form.age || Number.isNaN(age) || age < 0 || age > 120) {
      setError('Name and a valid age are required.');
      return;
    }
    addMember({
      name: form.name.trim(),
      age,
      gender: form.gender,
      heightCm: form.heightCm ? Number(form.heightCm) : null,
      marks: form.marks.trim(),
    });
    setForm({ name: '', age: '', gender: 'female', heightCm: '', marks: '' });
    setError('');
    setShowForm(false);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>
            My Family
          </h1>
          <p className="hint">
            Each registered person gets a unique QR tag. Print it on a
            wristband, school bag, or medical bracelet. The tag stays inactive
            until a missing report is filed.
          </p>
        </div>
        <button className="btn" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '+ Register family member'}
        </button>
      </div>

      {showForm && (
        <form className="panel" onSubmit={submit} style={{ marginBottom: 24 }}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="m-name">Full name</label>
              <input id="m-name" value={form.name} onChange={set('name')} />
            </div>
            <div className="field">
              <label htmlFor="m-age">Age</label>
              <input
                id="m-age"
                type="number"
                min="0"
                max="120"
                value={form.age}
                onChange={set('age')}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="m-gender">Gender</label>
              <select
                id="m-gender"
                value={form.gender}
                onChange={set('gender')}
                style={{ width: '100%' }}
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="m-height">Height (cm, optional)</label>
              <input
                id="m-height"
                type="number"
                min="30"
                max="250"
                value={form.heightCm}
                onChange={set('heightCm')}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="m-marks">
              Identifying details (marks, conditions, behaviour)
            </label>
            <textarea
              id="m-marks"
              placeholder="e.g. scar on left arm, non-verbal, has dementia, responds to a nickname…"
              value={form.marks}
              onChange={set('marks')}
            />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn">Register &amp; generate QR tag</button>
        </form>
      )}

      {myMembers.length === 0 && !showForm ? (
        <div className="empty">
          <p>No family members registered yet.</p>
        </div>
      ) : (
        <div className="qr-grid">
          {myMembers.map((m) => {
            const report = activeReportForMember(m.id);
            return (
              <div key={m.id} className="member-block">
                <div className="member-head">
                  <div>
                    <strong>{m.name}</strong>, {m.age} · {m.gender}
                    {m.heightCm ? ` · ${m.heightCm} cm` : ''}
                  </div>
                  {report ? (
                    <Link to={`/report/${report.id}`}>
                      <StatusBadge report={report} />
                    </Link>
                  ) : (
                    <StatusBadge status="inactive" />
                  )}
                </div>
                <QRCard member={m} active={!!report} />
                {!report && (
                  <Link
                    to={`/report/new?member=${m.id}`}
                    className="btn secondary"
                    style={{ marginTop: 10 }}
                  >
                    File missing report
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
