import { DISTRICTS } from '@data/locations';
import type { Role } from '@data/types';
import { PageHead } from '../components/Layout';
import { useStore } from '../lib/store';
import { ROLE_LABEL } from '../lib/roles';

export default function Users() {
  const { users, updateUser, toast, session } = useStore();
  return (
    <>
      <PageHead kicker="Access control" title="Users & roles" />
      <div className="banner">Roles map to Postgres row-level security (supabase/migrations/0002_rls.sql). District moderators can only see and publish stories, alerts and citizen reports for their districts.</div>
      <div className="card table-wrap" style={{ padding: 8 }}>
        <table><thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Districts</th><th>Verified reporter</th><th>Joined</th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}>
              <td><b>{u.name}</b></td><td className="faint">+91 {u.phone}</td>
              <td><select className="input" style={{ width: 'auto' }} value={u.role} disabled={u.id === session.userId} title={u.id === session.userId ? "You can't change your own role" : ''} onChange={async (e) => { const v = e.target.value; if (await updateUser(u.id, { role: v as Role | 'reader' })) toast(`${u.name} is now ${v === 'reader' ? 'a reader' : ROLE_LABEL[v as Role]}`); }}>
                <option value="reader">Reader</option>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
              <td><div className="row" style={{ gap: 8 }}>{DISTRICTS.map((d) => (
                <label key={d.id} className="row" style={{ gap: 4, fontSize: 13 }}><input type="checkbox" checked={u.districts.includes(d.id)} onChange={(e) => updateUser(u.id, { districts: e.target.checked ? [...u.districts, d.id] : u.districts.filter((x) => x !== d.id) })} />{d.name}</label>
              ))}</div></td>
              <td><label className="switch"><input type="checkbox" checked={u.verifiedReporter} onChange={(e) => updateUser(u.id, { verifiedReporter: e.target.checked })} /></label></td>
              <td className="faint">{u.joined}</td>
            </tr>))}</tbody></table>
      </div>
    </>
  );
}
