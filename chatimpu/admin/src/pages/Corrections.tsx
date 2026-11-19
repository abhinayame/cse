/**
 * Corrections & grievances. Readers' "Report this story" flags, and formal grievances with the
 * deadlines digital news publishers must meet (IT Rules 2021: acknowledge in 24 h, dispose in 15 days).
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PageHead } from '../components/Layout';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { db, ok, rpc, when } from '../newsroom/api';
import { Kpi, NeedsBackend, Status, label, useReasonDialog } from '../newsroom/ui';

interface Flag { id: string; story_id: string; reason: string; details: string | null; status: string; created_at: string; resolution: string | null }
interface Grievance { id: string; code: string; name: string; contact: string; story_id: string | null; category: string; details: string; status: string; ack_due_at: string; resolve_due_at: string; acknowledged_at: string | null; resolved_at: string | null; resolution: string | null; created_at: string }
interface Officer { name: string; email: string; phone: string; address: string }

export default function Corrections() {
  if (!supabase) return <NeedsBackend kicker="Trust" title="Corrections & grievances" />;
  return <Inner />;
}

const left = (iso: string) => {
  const ms = Date.parse(iso) - Date.now(), h = Math.round(Math.abs(ms) / 36e5);
  const txt = h >= 48 ? `${Math.round(h / 24)} days` : `${h} h`;
  return ms < 0 ? { txt: `${txt} overdue`, late: true } : { txt: `${txt} left`, late: false };
};

function Inner() {
  const { toast, session } = useStore();
  const isEditor = session.role === 'super_admin' || session.role === 'editor';
  const [tab, setTab] = useState<'flags' | 'grievances' | 'officer'>('flags');
  const [flags, setFlags] = useState<(Flag & { headline?: string; count: number })[]>([]);
  const [griev, setGriev] = useState<Grievance[]>([]);
  const [open, setOpen] = useState<Grievance | null>(null);
  const reason = useReasonDialog();
  const load = useCallback(async () => {
    try {
      const fl = ok(await db().from('story_flags').select('*').eq('status', 'open').order('created_at')) as Flag[];
      const ids = [...new Set(fl.map((f) => f.story_id))];
      const heads = ids.length ? ok(await db().from('story_translations').select('story_id, headline, lang').in('story_id', ids)) as { story_id: string; headline: string; lang: string }[] : [];
      setFlags(fl.map((f) => ({ ...f, headline: (heads.find((h) => h.story_id === f.story_id && h.lang === 'te') ?? heads.find((h) => h.story_id === f.story_id))?.headline, count: fl.filter((x) => x.story_id === f.story_id).length })));
      if (isEditor) setGriev(ok(await db().from('grievances').select('*').order('created_at', { ascending: false }).limit(200)) as Grievance[]);
    } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  }, [toast, isEditor]);
  useEffect(() => { load(); }, [load]);
  const resolveFlag = async (f: Flag, status: 'corrected' | 'dismissed') => {
    const note = await reason.ask(status === 'corrected' ? 'Correction note (shown to readers on the story)' : 'Why is this report dismissed?', { required: true,
      hint: status === 'corrected' ? 'Edit the story first, then describe what changed, e.g. "An earlier version gave the wrong date; it was 12 November."' : undefined });
    if (!note) return;
    try { await rpc('resolve_story_flag', { p_id: f.id, p_status: status, p_note: note }); toast(status === 'corrected' ? 'Correction note added' : 'Dismissed'); load(); } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };
  const openG = griev.filter((g) => g.status === 'received' || g.status === 'acknowledged');
  const overdueAck = griev.filter((g) => g.status === 'received' && Date.parse(g.ack_due_at) < Date.now()).length;
  const overdueRes = openG.filter((g) => Date.parse(g.resolve_due_at) < Date.now()).length;
  const byStory = flags.filter((f, i) => flags.findIndex((x) => x.story_id === f.story_id) === i);
  const tabs: [typeof tab, string][] = [['flags', `Story reports (${byStory.length})`], ...(isEditor ? [['grievances', `Grievances (${openG.length})`], ['officer', 'Grievance officer']] as [typeof tab, string][] : [])];
  return (
    <>
      <PageHead kicker="Trust" title="Corrections & grievances">
        <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      </PageHead>
      {isEditor && <div className="kpis">
        <Kpi label="Stories reported by readers" value={byStory.length} />
        <Kpi label="Open grievances" value={openG.length} />
        <Kpi label="Not acknowledged in 24 h" value={overdueAck} tone={overdueAck ? 'red' : 'green'} />
        <Kpi label="Past 15-day deadline" value={overdueRes} tone={overdueRes ? 'red' : 'green'} />
      </div>}
      {tab === 'flags' && (
        <div className="card table-wrap" style={{ marginTop: 16, padding: 8 }}>
          <table><thead><tr><th>Story</th><th>Reports</th><th>Reasons</th><th>First reported</th><th /></tr></thead>
            <tbody>{byStory.length === 0 ? <tr><td colSpan={5} className="empty">No open reports. 🎉</td></tr> : byStory.map((f) => {
              const all = flags.filter((x) => x.story_id === f.story_id);
              return (
                <tr key={f.story_id}>
                  <td><b className="te-body">{f.headline ?? f.story_id}</b><div className="faint" style={{ fontSize: 12 }}>{f.story_id}</div></td>
                  <td><span className={`pill ${all.length >= 3 ? 'red' : 'amber'}`}>{all.length}</span></td>
                  <td style={{ maxWidth: 360 }}>{all.map((x) => <div key={x.id} style={{ fontSize: 12.5 }}><b>{label(x.reason)}</b>{x.details ? ` — ${x.details}` : ''}</div>)}</td>
                  <td className="faint">{when(f.created_at)}</td>
                  <td><div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                    <a className="btn sm ghost" href={`/stories/${f.story_id}`}>Open story</a>
                    <button className="btn sm dark" onClick={() => resolveFlag(f, 'corrected')}>Mark corrected</button>
                    {all.map((x) => <button key={x.id} className="btn sm ghost" title={x.details ?? ''} onClick={() => resolveFlag(x, 'dismissed')}>Dismiss {label(x.reason).toLowerCase()}</button>)}
                  </div></td>
                </tr>
              );
            })}</tbody></table>
        </div>
      )}
      {tab === 'grievances' && (
        <div className="card table-wrap" style={{ marginTop: 16, padding: 8 }}>
          <table><thead><tr><th>Code</th><th>From</th><th>Category</th><th>Status</th><th>Deadline</th><th /></tr></thead>
            <tbody>{griev.length === 0 ? <tr><td colSpan={6} className="empty">No grievances</td></tr> : griev.map((g) => {
              const done = g.status === 'resolved' || g.status === 'rejected';
              const d = g.status === 'received' ? left(g.ack_due_at) : left(g.resolve_due_at);
              return (
                <tr key={g.id}>
                  <td><b>{g.code}</b><div className="faint" style={{ fontSize: 12 }}>{when(g.created_at)}</div></td>
                  <td>{g.name}<div className="faint" style={{ fontSize: 12 }}>{g.contact}</div></td>
                  <td>{label(g.category)}</td>
                  <td><Status s={done ? (g.status === 'resolved' ? 'completed' : 'rejected') : g.status === 'received' ? 'pending' : 'processing'} /> <span className="faint" style={{ fontSize: 12 }}>{label(g.status)}</span></td>
                  <td>{done ? <span className="faint">{when(g.resolved_at)}</span> : <span style={{ color: d.late ? 'var(--red-deep)' : undefined, fontWeight: d.late ? 700 : 400 }}>{g.status === 'received' ? 'Acknowledge: ' : 'Resolve: '}{d.txt}</span>}</td>
                  <td><button className="btn sm ghost" onClick={() => setOpen(g)}>Open</button></td>
                </tr>
              );
            })}</tbody></table>
        </div>
      )}
      {tab === 'officer' && <OfficerForm canEdit={session.role === 'super_admin'} />}
      {open && <GrievanceDialog g={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); load(); }} />}
      {reason.dialog}
    </>
  );
}

function GrievanceDialog({ g, onClose, onDone }: { g: Grievance; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore();
  const [text, setText] = useState(g.resolution ?? '');
  const act = async (status: 'acknowledged' | 'resolved' | 'rejected') => {
    try { await rpc('handle_grievance', { p_id: g.id, p_status: status, p_resolution: text || null }); toast(`${g.code}: ${status}`); onDone(); } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };
  const done = g.status === 'resolved' || g.status === 'rejected';
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal grid" style={{ gap: 10, maxWidth: 620 }} role="dialog" aria-modal="true" aria-label={g.code} onClick={(e) => e.stopPropagation()}>
        <h2>{g.code} · {label(g.category)}</h2>
        <div className="faint">{g.name} · {g.contact} · received {when(g.created_at)}{g.story_id && <> · story <a href={`/stories/${g.story_id}`}>{g.story_id}</a></>}</div>
        <div className="card" style={{ whiteSpace: 'pre-wrap' }}>{g.details}</div>
        <div className="faint" style={{ fontSize: 12.5 }}>Acknowledge by {when(g.ack_due_at)}{g.acknowledged_at ? ` ✓ (${when(g.acknowledged_at)})` : ''} · resolve by {when(g.resolve_due_at)}</div>
        <label className="field">Outcome sent to the complainant<textarea className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} disabled={done} placeholder="What you checked, what you changed (or why no change is needed), and how to appeal." /></label>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn ghost" onClick={onClose}>Close</button>
          {g.status === 'received' && <button className="btn dark" onClick={() => act('acknowledged')}>Acknowledge</button>}
          {!done && <button className="btn ghost" disabled={!text.trim()} onClick={() => act('rejected')}>Reject</button>}
          {!done && <button className="btn primary" disabled={!text.trim()} onClick={() => act('resolved')}>Resolve</button>}
        </div>
      </div>
    </div>
  );
}

function OfficerForm({ canEdit }: { canEdit: boolean }) {
  const { toast } = useStore();
  const [o, setO] = useState<Officer>({ name: '', email: '', phone: '', address: '' });
  useEffect(() => { db().from('app_settings').select('value').eq('key', 'grievance_officer').maybeSingle().then(({ data }) => data?.value && setO(data.value as Officer)); }, []);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try { ok(await db().from('app_settings').upsert({ key: 'grievance_officer', value: o })); toast('Saved: shown in the app under Help & complaints'); } catch (er) { toast(`⚠ ${(er as Error).message}`); }
  };
  const f = (k: keyof Officer, l: string) => <label className="field">{l}<input className="input" value={o[k]} disabled={!canEdit} onChange={(e) => setO({ ...o, [k]: e.target.value })} /></label>;
  return (
    <form className="card grid" style={{ marginTop: 16, gap: 10, maxWidth: 560 }} onSubmit={save}>
      <div className="banner" style={{ margin: 0 }}>Digital news publishers must publish the name and contact details of a Grievance Officer based in India, and report to the self-regulatory body. Fill this in before launch.</div>
      {f('name', 'Name')}{f('email', 'Email')}{f('phone', 'Phone')}{f('address', 'Postal address')}
      {canEdit ? <button className="btn primary">Save</button> : <p className="faint">Only a Super Admin can change this.</p>}
    </form>
  );
}
