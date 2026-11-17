/** Assignment desk: create and track reporting assignments. A special payment is credited once, on approval. */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { DISTRICTS, MANDALS } from '@data/locations';
import { PageHead } from '../components/Layout';
import { useStore } from '../lib/store';
import { district, mandal } from '../lib/format';
import { supabase } from '../lib/supabase';
import { loadAssignments, loadReporters, paise, saveAssignment, when, type AssignmentRow, type ReporterRow } from '../newsroom/api';
import { NeedsBackend, Status, label } from '../newsroom/ui';

const MEDIA = ['text', 'photo', 'video', 'audio'];
const blank = (d: string): Partial<AssignmentRow> => ({ title: '', description: '', district_id: d, mandal_id: MANDALS.find((m) => m.districtId === d)?.id ?? null, locality: '', deadline: null, priority: 'normal', assigned_reporter_id: null, media_required: ['photo'], special_amount_paise: 0, status: 'open' });

export default function AssignmentsAdmin() {
  if (!supabase) return <NeedsBackend kicker="Reporter network" title="Assignments" />;
  return <Desk />;
}

function Desk() {
  const { session, toast } = useStore();
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  const [reporters, setReporters] = useState<ReporterRow[]>([]);
  const [edit, setEdit] = useState<Partial<AssignmentRow> | null>(null);
  const [tab, setTab] = useState('active');
  const load = useCallback(async () => {
    try { const [a, r] = await Promise.all([loadAssignments(), loadReporters()]); setRows(a); setReporters(r.filter((x) => ['active', 'verified'].includes(x.status))); }
    catch (e) { toast(`⚠ ${(e as Error).message}`); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  const name = (id: string | null) => reporters.find((r) => r.user_id === id)?.full_name ?? (id ? 'Reporter' : '—');
  const scoped = (rows ?? []).filter((a) => !session.districts.length || session.districts.includes(a.district_id));
  const groups: Record<string, string[]> = { active: ['open', 'assigned', 'accepted', 'submitted'], completed: ['completed'], cancelled: ['cancelled'] };
  const shown = scoped.filter((a) => groups[tab].includes(a.status));

  const cancel = async (a: AssignmentRow) => {
    if (!confirm(`Cancel ${a.code}?`)) return;
    try { await saveAssignment({ id: a.id, status: 'cancelled' }); toast(`${a.code} cancelled`); load(); } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };

  return (
    <>
      <PageHead kicker="Reporter network" title="Assignments">
        <div className="tabs">{Object.keys(groups).map((k) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label(k)} ({scoped.filter((a) => groups[k].includes(a.status)).length})</button>)}</div>
        <button className="btn primary" onClick={() => setEdit(blank(session.districts[0] ?? 'hyd'))}>＋ New assignment</button>
      </PageHead>
      <div className="card table-wrap" style={{ padding: 8 }}>
        <table>
          <thead><tr><th>Assignment</th><th>Area</th><th>Deadline</th><th>Priority</th><th>Reporter</th><th>Special pay</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows === null ? <tr><td colSpan={8} className="empty">Loading…</td></tr> : shown.length === 0 ? <tr><td colSpan={8} className="empty">No assignments</td></tr> : shown.map((a) => {
              const late = a.deadline && new Date(a.deadline) < new Date() && !['submitted', 'completed', 'cancelled'].includes(a.status);
              return (
                <tr key={a.id}>
                  <td><b>{a.title}</b><div className="faint" style={{ fontSize: 12 }}>{a.code} · needs {a.media_required.join(', ') || 'text'}</div></td>
                  <td>{[a.locality, mandal(a.mandal_id ?? undefined), district(a.district_id)].filter(Boolean).join(', ')}</td>
                  <td style={late ? { color: 'var(--red-deep)', fontWeight: 600 } : undefined}>{when(a.deadline)}</td>
                  <td><Status s={a.priority} /></td>
                  <td>{a.assigned_reporter_id ? name(a.assigned_reporter_id) : <span className="faint">Open to area</span>}</td>
                  <td className="money">{a.special_amount_paise ? paise(a.special_amount_paise) : '—'}</td>
                  <td><Status s={a.status} /></td>
                  <td className="row" style={{ gap: 6 }}>
                    {['open', 'assigned'].includes(a.status) && <button className="btn sm ghost" onClick={() => setEdit(a)}>Edit</button>}
                    {['open', 'assigned', 'accepted'].includes(a.status) && <button className="btn sm ghost" onClick={() => cancel(a)}>Cancel</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {edit && <Editor a={edit} reporters={reporters} districts={session.districts} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}

function Editor({ a, reporters, districts, onClose, onSaved }: { a: Partial<AssignmentRow>; reporters: ReporterRow[]; districts: string[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useStore();
  const [f, setF] = useState(a);
  const [busy, setBusy] = useState(false);
  const local = (iso: string | null | undefined) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
  const areaReporters = reporters.filter((r) => r.district_id === f.district_id);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      await saveAssignment({ ...f, status: f.assigned_reporter_id ? (f.status === 'open' ? 'assigned' : f.status) : 'open' });
      toast(a.id ? 'Assignment updated' : 'Assignment created — reporters notified'); onSaved();
    } catch (e2) { toast(`⚠ ${(e2 as Error).message}`); } finally { setBusy(false); }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal grid" style={{ gap: 10, maxWidth: 620, maxHeight: '90vh', overflow: 'auto' }} role="dialog" aria-modal="true" aria-label="Assignment" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 style={{ fontSize: 20 }}>{a.id ? `Edit ${a.code}` : 'New assignment'}</h2>
        <div className="field"><label htmlFor="as-t">Title</label><input id="as-t" className="input" required minLength={5} value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="field"><label htmlFor="as-d">Brief</label><textarea id="as-d" className="input" rows={4} required value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What to cover, who to speak to, what not to do" /></div>
        <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field"><label htmlFor="as-di">District</label>
            <select id="as-di" className="input" value={f.district_id} onChange={(e) => setF({ ...f, district_id: e.target.value, mandal_id: MANDALS.find((m) => m.districtId === e.target.value)?.id ?? null, assigned_reporter_id: null })}>
              {DISTRICTS.filter((d) => !districts.length || districts.includes(d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div className="field"><label htmlFor="as-m">Mandal</label>
            <select id="as-m" className="input" value={f.mandal_id ?? ''} onChange={(e) => setF({ ...f, mandal_id: e.target.value || null })}>
              <option value="">Any</option>{MANDALS.filter((m) => m.districtId === f.district_id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          <div className="field"><label htmlFor="as-l">Locality</label><input id="as-l" className="input" value={f.locality ?? ''} onChange={(e) => setF({ ...f, locality: e.target.value })} /></div>
        </div>
        <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field"><label htmlFor="as-dl">Deadline</label><input id="as-dl" type="datetime-local" className="input" value={local(f.deadline)} onChange={(e) => setF({ ...f, deadline: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
          <div className="field"><label htmlFor="as-p">Priority</label><select id="as-p" className="input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{['low', 'normal', 'high', 'urgent'].map((p) => <option key={p}>{p}</option>)}</select></div>
          <div className="field"><label htmlFor="as-sp">Special payment (₹)</label><input id="as-sp" type="number" min={0} max={100000} step={1} className="input" style={{ width: 130 }} value={(f.special_amount_paise ?? 0) / 100} onChange={(e) => setF({ ...f, special_amount_paise: Math.round(Number(e.target.value) * 100) })} /></div>
        </div>
        <div className="field"><span className="faint">Media required</span>
          <div className="row">{MEDIA.map((m) => <label key={m} className="row" style={{ gap: 4 }}><input type="checkbox" checked={f.media_required?.includes(m)} onChange={(e) => setF({ ...f, media_required: e.target.checked ? [...(f.media_required ?? []), m] : (f.media_required ?? []).filter((x) => x !== m) })} />{m}</label>)}</div></div>
        <div className="field"><label htmlFor="as-r">Assign to</label>
          <select id="as-r" className="input" value={f.assigned_reporter_id ?? ''} onChange={(e) => setF({ ...f, assigned_reporter_id: e.target.value || null })}>
            <option value="">Open to all active reporters in the district</option>
            {areaReporters.map((r) => <option key={r.user_id} value={r.user_id}>{r.full_name} · {label(r.category)}{r.locality ? ` · ${r.locality}` : ''}</option>)}</select></div>
        <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>The special payment is credited once, when an editor approves the reporter's submission for this assignment.</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </div>
  );
}
