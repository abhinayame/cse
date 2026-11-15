import { NavLink, Outlet } from 'react-router-dom';
import { useStore } from '../lib/store';
import { CAN, ROLE_LABEL, type Section } from '../lib/roles';
import { isDemo } from '../lib/supabase';
import type { Role } from '@data/types';

const NAV: { to: string; section: Section; label: string; icon: string }[] = [
  { to: '/', section: 'dashboard', label: 'Dashboard', icon: '◎' },
  { to: '/stories', section: 'stories', label: 'Stories', icon: '▤' },
  { to: '/moderation', section: 'moderation', label: 'Moderation', icon: '✓' },
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
  const { session, setSession, submissions } = useStore();
  const pending = submissions.filter((s) => s.status === 'pending' && (!session.districts.length || session.districts.includes(s.districtId))).length;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="mono">V</span><div>Vaarta<small>Newsroom</small></div></div>
        <nav className="nav">
          {NAV.filter((n) => CAN[session.role].includes(n.section)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}>
              <span aria-hidden style={{ width: 18, textAlign: 'center' }}>{n.icon}</span>{n.label}
              {n.section === 'moderation' && pending > 0 && <span className="badge">{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="foot">
          <div style={{ color: '#F7F3EA', fontWeight: 600 }}>{session.name}</div>
          <div>{ROLE_LABEL[session.role]}{session.districts.length ? ` · ${session.districts.join(', ').toUpperCase()}` : ''}</div>
          {isDemo && (
            <label style={{ display: 'block', marginTop: 10 }}>Demo: sign in as
              <select value={session.role} onChange={(e) => { const r = e.target.value as Role; setSession({ role: r, ...DEMO_SESSIONS[r] }); }}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </label>
          )}
        </div>
      </aside>
      <main><Outlet /></main>
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
