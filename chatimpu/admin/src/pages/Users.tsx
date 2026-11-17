import { useCallback, useEffect, useState } from 'react';
import { DISTRICTS } from '@data/locations';
import { supabase } from '../lib/supabase';
import type { Role } from '@data/types';
import { PageHead } from '../components/Layout';
import { useStore } from '../lib/store';
import { ROLE_LABEL } from '../lib/roles';

const PERMS: [string, string, string][] = [
  ['finance', 'Finance', 'Approve withdrawals, pay out, verify payment methods, edit the rate card'],
  ['reporter_admin', 'Reporter admin', 'Verify, activate and suspend contributors in every district'],
];

/** staff_permissions (super admins only; RLS enforces it). Finance is never implied by a newsroom role. */
function usePermissions(enabled: boolean) {
  const [perms, setPerms] = useState<Record<string, string[]>>({});
  const load = useCallback(async () => {
    if (!supabase || !enabled) return;
    const { data } = await supabase.from('staff_permissions').select('user_id, permission');
    const m: Record<string, string[]> = {};
    for (const r of data ?? []) m[r.user_id] = [...(m[r.user_id] ?? []), r.permission];
    setPerms(m);
  }, [enabled]);
  useEffect(() => { load(); }, [load]);
  const toggle = async (userId: string, perm: string, on: boolean) => {
    const q = on ? supabase!.from('staff_permissions').insert({ user_id: userId, permission: perm })
      : supabase!.from('staff_permissions').delete().eq('user_id', userId).eq('permission', perm);
    const { error } = await q;
    if (error) throw new Error(error.message);
    await load();
  };
  return { perms, toggle };
}

export default function Users() {
  const { users, updateUser, toast, session, live } = useStore();
  const showPerms = live && session.role === 'super_admin';
  const { perms, toggle } = usePermissions(showPerms);
  return (
    <>
      <PageHead kicker="Access control" title="Users & roles" />
      <div className="banner">Roles map to Postgres row-level security (supabase/migrations/0002_rls.sql). District moderators can only see and publish stories, alerts and citizen reports for their districts. Finance is a separate permission: editors do not get financial access from their role. A finance-only account can stay a “Reader” and will see only the finance desk.</div>
      <div className="card table-wrap" style={{ padding: 8 }}>
        <table><thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Districts</th><th>Verified reporter</th>{showPerms && PERMS.map(([k, l, d]) => <th key={k} title={d}>{l}</th>)}<th>Joined</th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}>
              <td><b>{u.name}</b></td><td className="faint">+91 {u.phone}</td>
              <td><select className="input" style={{ width: 'auto' }} value={u.role} disabled={u.id === session.userId} title={u.id === session.userId ? "You can't change your own role" : ''} onChange={async (e) => { const v = e.target.value; if (await updateUser(u.id, { role: v as Role | 'reader' })) toast(`${u.name} is now ${v === 'reader' ? 'a reader' : ROLE_LABEL[v as Role]}`); }}>
                <option value="reader">Reader</option>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
              <td><div className="row" style={{ gap: 8 }}>{DISTRICTS.map((d) => (
                <label key={d.id} className="row" style={{ gap: 4, fontSize: 13 }}><input type="checkbox" checked={u.districts.includes(d.id)} onChange={(e) => updateUser(u.id, { districts: e.target.checked ? [...u.districts, d.id] : u.districts.filter((x) => x !== d.id) })} />{d.name}</label>
              ))}</div></td>
              <td><label className="switch"><input type="checkbox" checked={u.verifiedReporter} onChange={(e) => updateUser(u.id, { verifiedReporter: e.target.checked })} /></label></td>
              {showPerms && PERMS.map(([k, l]) => (
                <td key={k}>{u.role === 'super_admin' ? <span className="faint" title="Super admins have every permission">✓</span> : (
                  <label className="switch" title={u.id === session.userId ? "You can't change your own permissions" : ''}>
                    <input type="checkbox" aria-label={`${l} for ${u.name}`} disabled={u.id === session.userId} checked={!!perms[u.id]?.includes(k)}
                      onChange={async (e) => { const on = e.target.checked; if (on && k === 'finance' && !confirm(`Give ${u.name} finance access? They will be able to approve and send payouts.`)) return; try { await toggle(u.id, k, on); toast(`${u.name}: ${l} ${on ? 'granted' : 'removed'}`); } catch (err) { toast(`⚠ ${(err as Error).message}`); } }} />
                  </label>)}</td>
              ))}
              <td className="faint">{u.joined}</td>
            </tr>))}</tbody></table>
      </div>
    </>
  );
}
