import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

type Method = 'phone' | 'email';

/** Staff sign-in: phone OTP (same accounts as the app) or email + password. */
export default function Login() {
  const [method, setMethod] = useState<Method>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = async (fn: () => Promise<{ error: { message: string } | null }>) => {
    setBusy(true); setError(null); setInfo(null);
    try {
      const { error } = await fn();
      if (error) setError(error.message);
      return !error;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally { setBusy(false); }
  };

  const fullPhone = `+91${phone}`;

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => supabase!.auth.signInWithOtp({ phone: fullPhone, options: { shouldCreateUser: false } }))) {
      setCodeSent(true); setInfo(`Code sent to ${fullPhone}`);
    }
  };
  const verify = (e: FormEvent) => { e.preventDefault(); run(() => supabase!.auth.verifyOtp({ phone: fullPhone, token: code, type: 'sms' })); };
  const emailSignIn = (e: FormEvent) => { e.preventDefault(); run(() => supabase!.auth.signInWithPassword({ email: email.trim(), password })); };
  const resetPassword = async () => {
    if (!email.trim()) return setError('Enter your email first');
    if (await run(() => supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin }))) setInfo('Password reset link sent — check your email.');
  };

  return (
    <div className="auth-shell">
      <div className="auth-card grid" style={{ gap: 18 }}>
        <div className="brand-lg"><span className="mono">చా</span>Chatimpu Newsroom</div>
        <div>
          <h1 style={{ fontSize: 26 }}>Staff sign in</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>For editors, district moderators and reporters.</p>
        </div>
        <div className="tabs" role="tablist" style={{ width: '100%' }}>
          {(['phone', 'email'] as Method[]).map((m) => (
            <button key={m} role="tab" aria-selected={method === m} className={method === m ? 'on' : ''} style={{ flex: 1 }}
              onClick={() => { setMethod(m); setError(null); setInfo(null); }}>{m === 'phone' ? 'Phone OTP' : 'Email'}</button>
          ))}
        </div>

        {method === 'phone' ? (
          !codeSent ? (
            <form className="grid" style={{ gap: 12 }} onSubmit={sendCode}>
              <div className="field"><label htmlFor="ph">Mobile number</label>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <span className="input" style={{ width: 70, textAlign: 'center' }}>+91</span>
                  <input id="ph" className="input" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
                </div></div>
              <button className="btn primary" style={{ justifyContent: 'center' }} disabled={phone.length !== 10 || busy}>{busy ? 'Sending…' : 'Send code'}</button>
            </form>
          ) : (
            <form className="grid" style={{ gap: 12 }} onSubmit={verify}>
              <div className="field"><label htmlFor="otp">6-digit code</label>
                <input id="otp" className="input" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="••••••" value={code}
                  style={{ letterSpacing: '0.5em', fontSize: 20, textAlign: 'center' }} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /></div>
              <button className="btn primary" style={{ justifyContent: 'center' }} disabled={code.length !== 6 || busy}>{busy ? 'Verifying…' : 'Verify & sign in'}</button>
              <button type="button" className="btn ghost" style={{ justifyContent: 'center' }} onClick={() => { setCodeSent(false); setCode(''); setInfo(null); }}>Use a different number</button>
            </form>
          )
        ) : (
          <form className="grid" style={{ gap: 12 }} onSubmit={emailSignIn}>
            <div className="field"><label htmlFor="em">Email</label>
              <input id="em" type="email" className="input" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label htmlFor="pw">Password</label>
              <input id="pw" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <button className="btn primary" style={{ justifyContent: 'center' }} disabled={!email || !password || busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <button type="button" className="btn ghost sm" style={{ justifySelf: 'start' }} onClick={resetPassword}>Forgot password?</button>
          </form>
        )}

        {error && <div className="banner" role="alert" style={{ borderColor: 'var(--red)', background: 'rgba(215,20,26,.08)', margin: 0 }}>{error}</div>}
        {info && <div className="banner" role="status" style={{ margin: 0 }}>{info}</div>}
        <p className="faint" style={{ fontSize: 12, margin: 0 }}>Only existing staff accounts can sign in. A Super Admin assigns roles in <b>Users & roles</b>.</p>
      </div>
    </div>
  );
}
