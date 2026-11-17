/**
 * Reporter portal (mobile-first) at /reporter. Same Supabase project, login and API as the
 * reader app and the newsroom CMS — no second backend.
 */
import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { loadDashboard, type Dashboard } from './api';
import { setLang, useLang, useT } from './i18n';
import { ToastProvider } from './ui';
import Register from './pages/Register';
import Home from './pages/Home';
import Submit from './pages/Submit';
import Submissions, { SubmissionDetail } from './pages/Submissions';
import Assignments from './pages/Assignments';
import Wallet from './pages/Wallet';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Help from './pages/Help';
import More from './pages/More';
import './reporter.css';

interface Ctx { dash: Dashboard; reload: () => Promise<void>; userId: string; phone: string | null }
const ReporterCtx = createContext<Ctx | null>(null);
export const useReporter = () => {
  const c = useContext(ReporterCtx);
  if (!c) throw new Error('ReporterCtx missing');
  return c;
};

export default function ReporterApp() {
  const lang = useLang();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = 'Chatimpu Reporter';
  }, [lang]);
  useEffect(() => {
    if (!supabase) return setSession(null);
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div className="rp" lang={lang}>
      <ToastProvider>
        {!supabase ? <NoBackend /> : session === undefined ? <Splash /> : !session ? <Login /> : <Signed session={session} />}
      </ToastProvider>
    </div>
  );
}

function Splash() {
  return <div className="rp-auth"><div className="rp-logo"><span className="mono">చా</span></div></div>;
}

function NoBackend() {
  return (
    <div className="rp-auth"><div className="rp-card">
      <h2>Reporter portal needs the backend</h2>
      <p className="rp-meta">Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see docs/SUPABASE_SETUP.md) and run migrations 0001–0005.</p>
    </div></div>
  );
}

function LangToggle() {
  const lang = useLang(); const t = useT();
  return <button className="rp-lang" onClick={() => setLang(lang === 'te' ? 'en' : 'te')} aria-label="Change language">{t('language')}</button>;
}

function Login() {
  const t = useT();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<{ error: { message: string } | null }>) => {
    setBusy(true); setErr(null);
    const { error } = await fn().catch((e) => ({ error: e as { message: string } }));
    setBusy(false);
    if (error) setErr(error.message);
    return !error;
  };
  const send = async (e: FormEvent) => { e.preventDefault(); if (await run(() => supabase!.auth.signInWithOtp({ phone: `+91${phone}` }))) setSent(true); };
  const verify = (e: FormEvent) => { e.preventDefault(); run(() => supabase!.auth.verifyOtp({ phone: `+91${phone}`, token: code, type: 'sms' })); };
  return (
    <div className="rp-auth">
      <div className="rp-card">
        <div className="rp-row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
          <div className="rp-logo"><span className="mono">చా</span><div>చాటింపు<small>{t('brandSub')}</small></div></div>
          <LangToggle />
        </div>
        <h1>{t('signInTitle')}</h1>
        <p className="rp-meta" style={{ margin: '6px 0 18px' }}>{t('signInSub')}</p>
        {!sent ? (
          <form onSubmit={send}>
            <div className="rp-field"><label htmlFor="rp-phone">{t('mobile')}</label>
              <div className="rp-row"><span className="rp-input" style={{ width: 64, display: 'grid', placeItems: 'center' }}>+91</span>
                <input id="rp-phone" className="rp-input grow" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="98765 43210" /></div></div>
            <button className="rp-btn primary block" disabled={phone.length !== 10 || busy}>{t('sendCode')}</button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <div className="rp-field"><label htmlFor="rp-otp">{t('code')}</label>
              <input id="rp-otp" className="rp-input" inputMode="numeric" autoComplete="one-time-code" autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ letterSpacing: '0.5em', textAlign: 'center', fontSize: 22 }} /></div>
            <button className="rp-btn primary block" disabled={code.length !== 6 || busy}>{t('verify')}</button>
            <div className="rp-gap" />
            <button type="button" className="rp-btn ghost block" onClick={() => { setSent(false); setCode(''); }}>{t('changeNumber')}</button>
          </form>
        )}
        {err && <div className="rp-banner bad" style={{ marginTop: 14 }} role="alert">{err}</div>}
        <p className="rp-meta" style={{ marginTop: 18, textAlign: 'center', fontWeight: 700, letterSpacing: '.06em' }}>{t('tagline')}</p>
      </div>
    </div>
  );
}

function Signed({ session }: { session: Session }) {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try { setDash(await loadDashboard()); setErr(null); } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  if (err) return <div className="rp-auth"><div className="rp-card"><div className="rp-banner bad">{err}</div><div className="rp-gap" /><button className="rp-btn block" onClick={() => supabase!.auth.signOut()}>Sign out</button></div></div>;
  if (!dash) return <Splash />;
  const ctx: Ctx = { dash, reload, userId: session.user.id, phone: session.user.phone ?? null };
  if (!dash.profile) return <ReporterCtx.Provider value={ctx}><Register /></ReporterCtx.Provider>;
  return (
    <ReporterCtx.Provider value={ctx}>
      <Shell>
        <Routes>
          <Route index element={<Home />} />
          <Route path="submit" element={<Submit />} />
          <Route path="submit/:id" element={<Submit />} />
          <Route path="submissions" element={<Submissions />} />
          <Route path="submissions/:id" element={<SubmissionDetail />} />
          <Route path="assignments" element={<Assignments />} />
          <Route path="earnings" element={<Wallet tab="earnings" />} />
          <Route path="withdraw" element={<Wallet tab="withdraw" />} />
          <Route path="history" element={<Wallet tab="history" />} />
          <Route path="methods" element={<Wallet tab="methods" />} />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="help" element={<Help />} />
          <Route path="more" element={<More />} />
          <Route path="*" element={<Navigate to="/reporter" replace />} />
        </Routes>
      </Shell>
    </ReporterCtx.Provider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const t = useT();
  const nav = useNavigate();
  const { dash } = useReporter();
  return (
    <>
      <header className="rp-top"><div className="rp-top-in">
        <div className="rp-logo" style={{ flex: 1 }}><span className="mono">చా</span><div>చాటింపు<small>{t('brandSub')}</small></div></div>
        <LangToggle />
        <button className="rp-icon-btn" aria-label={t('notifications')} onClick={() => nav('/reporter/notifications')}>
          🔔{dash.unread > 0 && <span className="dot">{dash.unread > 9 ? '9+' : dash.unread}</span>}
        </button>
      </div></header>
      <main className="rp-wrap">{children}</main>
      <nav className="rp-tabs" aria-label="Reporter navigation"><div className="rp-tabs-in">
        <NavLink to="/reporter" end><span className="ic">⌂</span>{t('home')}</NavLink>
        <NavLink to="/reporter/submissions"><span className="ic">☰</span>{t('myNews')}</NavLink>
        <NavLink to="/reporter/submit" className="submit"><span className="ic">＋</span>{t('submit')}</NavLink>
        <NavLink to="/reporter/withdraw"><span className="ic">₹</span>{t('wallet')}</NavLink>
        <NavLink to="/reporter/more"><span className="ic">⋯</span>{t('more')}</NavLink>
      </div></nav>
    </>
  );
}
