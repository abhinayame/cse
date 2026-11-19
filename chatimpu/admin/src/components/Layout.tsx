import { NavLink, Outlet } from 'react-router-dom';
import { useStore } from '../lib/store';
import { ROLE_LABEL, sectionsFor, type Section } from '../lib/roles';
import { isDemo } from '../lib/supabase';
import type { Role } from '@data/types';

const NAV: { to: string; section: Section; label: string; icon: string; mode?: 'live' | 'demo' }[] = [
  { to: '/', section: 'dashboard', label: 'Dashboard', icon: '◎' },
  { to: '/stories', section: 'stories', label: 'Stories', icon: '▤' },
  { to: '/moderation', section: 'moderation', label: 'Moderation', icon: '✓', mode: 'demo' },
  { to: '/editorial', section: 'editorial', label: 'Editorial desk', icon: '✓', mode: 'live' },
  { to: '/intake', section: 'intake', label: 'Auto intake', icon: '⇣', mode: 'live' },
  { to: '/reels', section: 'reels', label: 'News Reels', icon: '▶' },
  { to: '/status', section: 'status', label: 'WhatsApp Status', icon: '◐' },
  { to: '/corrections', section: 'corrections', label: 'Corrections & grievances', icon: '⚑', mode: 'live' },
  { to: '/community', section: 'community', label: 'Community & local info', icon: '☏', mode: 'live' },
  { to: '/help-centre', section: 'help', label: 'Help centre', icon: '?', mode: 'live' },
  { to: '/reporters', section: 'reporters', label: 'Reporters', icon: '✎' },
  { to: '/assignments', section: 'assignments', label: 'Assignments', icon: '⌖' },
  { to: '/recognition', section: 'recognition', label: 'Recognition', icon: '★' },
  { to: '/finance', section: 'finance', label: 'Finance', icon: '₹' },
  { to: '/analytics', section: 'analytics', label: 'Analytics', icon: '↗' },
  { to: '/ads', section: 'ads', label: 'Ad manager', icon: '◆' },
  { to: '/polls', section: 'polls', label: 'Polls', icon: '▥' },
  { to: '/users', section: 'users', label: 'Users & roles', icon: '☺' },
];

const DEMO_SESSIONS: Record<Role, { name: string; districts: string[] }> = {
  super_admin: { name: 'Anitha Rao', districts: [] },
  editor: { name: 'Kiran Kumar', districts: [] },
  district_moderator: { name: 'Swathi Reddy', districts: ['wgl'] },
  reporter: { name: 'Ravi Teja K.', districts: ['vsp'] },
};

export function Layout() {
  const { session, setSession, submissions, live, loading, signOut } = useStore();
  const pending = submissions.filter((s) => s.status === 'pending' && (!session.districts.length || session.districts.includes(s.districtId))).length;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><img className="mono" src="/chatimpu-emblem.png" alt="" /><div>Chatimpu<small>Newsroom</small></div></div>
        <nav className="nav">
          {NAV.filter((n) => sectionsFor(session).includes(n.section) && (!n.mode || (n.mode === 'live') === live)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}>
              <span aria-hidden style={{ width: 18, textAlign: 'center' }}>{n.icon}</span>{n.label}
              {(n.section === 'moderation' || n.section === 'editorial') && pending > 0 && <span className="badge">{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="foot">
          <div style={{ color: '#F7F3EA', fontWeight: 600 }}>{session.name}</div>
          <div>{session.staffRole === false ? 'Finance' : ROLE_LABEL[session.role]}{session.staffRole !== false && session.permissions?.includes('finance') && session.role !== 'super_admin' ? ' · Finance' : ''}{session.districts.length ? ` · ${session.districts.join(', ').toUpperCase()}` : ''}</div>
          {live && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11.5 }}><span className="live-dot" />Live data</span>
              <button className="btn sm" style={{ background: 'rgba(255,255,255,.08)', color: '#fff' }} onClick={signOut}>Sign out</button>
            </div>
          )}
          {isDemo && (
            <label style={{ display: 'block', marginTop: 10 }}>Demo: sign in as
              <select value={session.role} onChange={(e) => { const r = e.target.value as Role; setSession({ role: r, ...DEMO_SESSIONS[r] }); }}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </label>
          )}
        </div>
      </aside>
      <main>{loading && <div className="loading-bar" role="progressbar" aria-label="Loading newsroom data" />}<Outlet /></main>
    </div>
  );
}

export function PageHead({ kicker, title, children }: { kicker?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>{kicker && <div className="kicker">{kicker}</div>}<h1>{title}</h1></div>
      <div className="row">{children}</div>
    </div>
  );
}
