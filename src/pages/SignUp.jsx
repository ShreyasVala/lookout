import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { requestOtp, verifyOtp } from '../services/mockApi.js';

export default function SignUp() {
  const { currentUser, completeSignIn, userExists } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState('phone'); // phone → otp → name
  const [phone, setPhone] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (currentUser) return <Navigate to="/" replace />;

  const sendOtp = async (e) => {
    e.preventDefault();
    const clean = phone.replace(/[^\d+]/g, '');
    if (clean.replace(/\D/g, '').length < 10) {
      setError('Enter a valid phone number (10+ digits).');
      return;
    }
    setError('');
    setBusy(true);
    const res = await requestOtp(clean);
    setBusy(false);
    setDemoCode(res.demoCode);
    setStep('otp');
  };

  const checkOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await verifyOtp(phone.replace(/[^\d+]/g, ''), code);
    setBusy(false);
    if (!res.ok) {
      setError('Incorrect code. Try again.');
      return;
    }
    setError('');
    if (userExists(phone.replace(/[^\d+]/g, ''))) {
      completeSignIn(phone.replace(/[^\d+]/g, ''), '');
      navigate('/');
    } else {
      setStep('name');
    }
  };

  const finish = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    completeSignIn(phone.replace(/[^\d+]/g, ''), name.trim());
    navigate('/family');
  };

  return (
    <div className="narrow">
      <h1 className="section-title" style={{ marginTop: 0 }}>
        {step === 'name' ? 'Create your profile' : 'Sign up / Sign in'}
      </h1>

      {step === 'phone' && (
        <form className="panel" onSubmit={sendOtp}>
          <div className="field">
            <label htmlFor="phone">Phone number</label>
            <input
              id="phone"
              type="tel"
              placeholder="+91 98xxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
            <div className="hint">
              We verify every account with a one-time code so reports and
              alerts stay trustworthy. Returning users can use the same phone
              number and will go straight to their dashboard.
            </div>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn" disabled={busy}>
            {busy ? 'Sending…' : 'Send OTP'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form className="panel" onSubmit={checkOtp}>
          <div className="notice">
            Demo mode: your OTP is <strong>{demoCode}</strong>. In production
            this arrives by SMS and is never shown on screen.
          </div>
          <div className="field">
            <label htmlFor="otp">Enter the 6-digit code sent to {phone}</label>
            <input
              id="otp"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
          </div>
          {error && <div className="error-text">{error}</div>}
          <div className="actions">
            <button className="btn" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setStep('phone')}
            >
              Change number
            </button>
          </div>
        </form>
      )}

      {step === 'name' && (
        <form className="panel" onSubmit={finish}>
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn">Create account</button>
        </form>
      )}
    </div>
  );
}
