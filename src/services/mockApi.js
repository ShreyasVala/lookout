// Simulated backend. Every function returns a Promise with realistic
// latency so the UI is written exactly as it would be against a real API.
// Swapping this file for real endpoints (Supabase/Twilio Verify) is the
// intended upgrade path.

const delay = (value, ms = 700) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const otpStore = new Map(); // phone -> code (in-memory only)

export async function requestOtp(phone) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(phone, code);
  // In production the code is sent via SMS and never returned to the
  // client. It is returned here only so the demo is usable.
  return delay({ ok: true, demoCode: code });
}

export async function verifyOtp(phone, code) {
  const ok = otpStore.get(phone) === String(code).trim();
  if (ok) otpStore.delete(phone);
  return delay({ ok });
}
