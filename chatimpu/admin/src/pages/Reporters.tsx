/**
 * Reporter network: onboarding queue, identity verification, approval / suspension and
 * contributor categories. Categories describe a role on Chatimpu and are never presented as press accreditation.
 */
import { useCallback, useEffect, useState } from 'react';
import { DISTRICTS } from '@data/locations';
import { PageHead } from '../components/Layout';
import { useStore } from '../lib/store';
import { district, mandal } from '../lib/format';
import { mediaUrl } from '../lib/db';
import { supabase } from '../lib/supabase';
import {
  docUrl, loadNetwork, loadReporters, loadVerifications, reporterStats, reviewReporter, when, downloadCsv,
  type NetworkRow, type ReporterRow, type Verification,
} from '../newsroom/api';
import { Kpi, NeedsBackend, Status, label, useReasonDialog } from '../newsroom/ui';

const CATEGORIES = ['community_contributor', 'verified_local_reporter', 'area_correspondent', 'senior_correspondent', 'editorial_contributor'];
const STATUSES = ['verification_pending', 'registered', 'verified', 'active', 'suspended', 'rejected'];
const DOC_LABEL: Record<string, string> = { aadhaar_masked: 'Masked Aadhaar', voter_id: 'Voter ID', pan: 'PAN', driving_licence: 'Driving licence', press_id: 'Press / org ID', college_id: 'College ID', other: 'Other ID' };

export default function Reporters() {
  if (!supabase) return <NeedsBackend kicker="Reporter network" title="Reporters" />;
  return <Network />;
}

function Network() {
  const { session, toast } = useStore();
  const [rows, setRows] = useState<ReporterRow[] | null>(null);
  const [net, setNet] = useState<NetworkRow[]>([]);
  const [f, setF] = useState({ status: 'verification_pending', district: '', text: '' });
  const [sel, setSel] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const [r, n] = await Promise.all([loadReporters(), loadNetwork()]); setRows(r); setNet(n); } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const scoped = (rows ?? []).filter((r) => !session.districts.length || session.districts.includes(r.district_id));
  const shown = scoped.filter((r) => (f.status === 'all' || r.status === f.status) && (!f.district || r.district_id === f.district)
    && (!f.text || r.full_name.toLowerCase().includes(f.text.toLowerCase()) || (r.locality ?? '').toLowerCase().includes(f.text.toLowerCase())));
  const count = (s: string) => scoped.filter((r) => r.status === s).length;
  const current = scoped.find((r) => r.user_id === sel);

  return (
    <>
      <PageHead kicker="Reporter network" title="Reporters">
        <button className="btn ghost" onClick={() => downloadCsv('chatimpu-reporters.csv', shown.map((r) => ({ name: r.full_name, status: r.status, category: r.category, district: district(r.district_id), mandal: mandal(r.mandal_id ?? undefined), locality: r.locality, joined: r.created_at.slice(0, 10) })))}>Export CSV</button>
      </PageHead>
      <div className="kpis">
        <Kpi label="Active reporters" value={count('active')} />
        <Kpi label="Awaiting verification" value={count('verification_pending') + count('registered')} tone={count('verification_pending') ? 'red' : undefined} sub={`${count('verification_pending')} with documents`} />
        <Kpi label="Verified, not yet active" value={count('verified')} />
        <Kpi label="Suspended" value={count('suspended')} />
        <Kpi label="Submissions (30 days)" value={net.reduce((a, n) => a + n.submissions_30d, 0)} sub={`${net.reduce((a, n) => a + n.published_30d, 0)} published`} />
      </div>

      <div className="card table-wrap" style={{ marginTop: 16, padding: 8 }}>
        <h2 style={{ padding: '8px 10px' }}>District network</h2>
        <table><thead><tr><th>District</th><th>Active</th><th>Pending</th><th>Suspended</th><th>Submissions 30d</th><th>Published 30d</th><th>Acceptance</th></tr></thead>
          <tbody>{net.filter((n) => !session.districts.length || session.districts.includes(n.district_id)).map((n) => (
            <tr key={n.district_id}><td><b>{district(n.district_id)}</b></td><td>{n.active}</td><td>{n.pending}</td><td>{n.suspended}</td><td>{n.submissions_30d}</td><td>{n.published_30d}</td>
              <td>{n.submissions_30d ? `${Math.round((n.published_30d / n.submissions_30d) * 100)}%` : '—'}</td></tr>
          ))}</tbody></table>
      </div>

      <div className="filters" style={{ marginTop: 16 }}>
        <div className="tabs">{['verification_pending', 'active', 'all'].map((s) => <button key={s} className={f.status === s ? 'on' : ''} onClick={() => setF({ ...f, status: s })}>{s === 'all' ? 'All' : label(s)} ({s === 'all' ? scoped.length : count(s)})</button>)}</div>
        <select className="input" value={STATUSES.includes(f.status) && !['verification_pending', 'active'].includes(f.status) ? f.status : ''} onChange={(e) => setF({ ...f, status: e.target.value || 'all' })}>
          <option value="">Other statuses…</option>{STATUSES.filter((s) => !['verification_pending', 'active'].includes(s)).map((s) => <option key={s} value={s}>{label(s)} ({count(s)})</option>)}</select>
        <select className="input" value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })}><option value="">All districts</option>{DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <input className="input" placeholder="Search name or locality" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
      </div>

      <div className="desk">
        <div className="card" style={{ padding: 8 }}>
          {rows === null ? <div className="empty">Loading…</div> : shown.length === 0 ? <div className="empty">No reporters here</div> : shown.map((r) => (
            <div key={r.user_id} className={`queue-item ${sel === r.user_id ? 'on' : ''}`} role="button" tabIndex={0} onClick={() => setSel(r.user_id)} onKeyDown={(e) => e.key === 'Enter' && setSel(r.user_id)}>
              {r.photo_path ? <img className="thumb" src={mediaUrl(r.photo_path)} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }} /> : <span className="thumb" style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{r.full_name[0]}</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block' }}>{r.full_name}</b>
                <div className="faint" style={{ fontSize: 12.5 }}>{[r.locality, mandal(r.mandal_id ?? undefined), district(r.district_id)].filter(Boolean).join(', ')} · joined {r.created_at.slice(0, 10)}</div>
              </div>
              <Status s={r.status} />
            </div>
          ))}
        </div>
        {current ? <ReporterDetail key={current.user_id} r={current} onChange={load} /> : <div className="card empty">Select a reporter</div>}
      </div>
    </>
  );
}

function ReporterDetail({ r, onChange }: { r: ReporterRow; onChange: () => Promise<void> }) {
  const { toast } = useStore();
  const { ask, dialog } = useReasonDialog();
  const [vs, setVs] = useState<Verification[]>([]);
  const [stats, setStats] = useState<{ total: number; published: number; rejected: number } | null>(null);
  const [category, setCategory] = useState(r.category);
  const [busy, setBusy] = useState(false);
  useEffect(() => { Promise.all([loadVerifications(r.user_id), reporterStats(r.user_id)]).then(([v, s]) => { setVs(v); setStats(s); }).catch((e) => toast(`⚠ ${e.message}`)); }, [r.user_id, toast]);

  const act = async (decision: string, needsReason: boolean, title: string) => {
    const reason = await ask(title, { required: needsReason, hint: needsReason ? 'The reporter sees this reason.' : 'Optional note (sent to the reporter).' });
    if (reason === null) return;
    setBusy(true);
    try { await reviewReporter(r.user_id, decision, reason || undefined, category !== r.category ? category : undefined); toast(`${r.full_name}: ${label(decision)}`); await onChange(); setVs(await loadVerifications(r.user_id)); }
    catch (e) { toast(`⚠ ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const openDoc = async (path: string) => { const u = await docUrl(path); if (u) window.open(u, '_blank', 'noopener'); else toast('⚠ Could not open document'); };
  const pending = vs.find((v) => v.status === 'pending');

  return (
    <div className="card grid" style={{ gap: 14 }}>
      {dialog}
      <div className="row">
        {r.photo_path ? <img src={mediaUrl(r.photo_path)} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} /> : null}
        <div><h2>{r.full_name}</h2><div className="faint">{[r.locality, mandal(r.mandal_id ?? undefined), district(r.district_id)].filter(Boolean).join(', ')} · {r.preferred_language.toUpperCase()}</div></div>
        <span className="spacer" /><Status s={r.status} />
      </div>
      {r.status_reason && <div className="warn-box">{r.status_reason}</div>}
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
        <span>Email: {r.email ?? '—'}</span>
        <span>Interests: {r.interests.join(', ') || '—'}</span>
        {stats && <span>{stats.total} submitted · {stats.published} accepted · {stats.rejected} rejected</span>}
        <span className="faint">Reviewed {when(r.reviewed_at)}</span>
      </div>
      {r.intro && <p className="muted" style={{ margin: 0 }}>“{r.intro}”</p>}

      <div>
        <b>Identity verification</b> <span className="faint" style={{ fontSize: 12.5 }}>· documents are private; only masked last characters are stored</span>
        {vs.length === 0 ? <p className="faint">No document submitted yet.</p> : (
          <table style={{ marginTop: 6 }}><tbody>{vs.map((v) => (
            <tr key={v.id}><td>{DOC_LABEL[v.document_type] ?? v.document_type}{v.document_last4 ? ` ••${v.document_last4}` : ''}</td><td><Status s={v.status === 'approved' ? 'verified' : v.status} /></td>
              <td className="faint">{when(v.created_at)}</td><td>{v.document_path && <button className="btn sm ghost" onClick={() => openDoc(v.document_path!)}>View document</button>}</td></tr>
          ))}</tbody></table>
        )}
        {pending?.document_type === 'aadhaar_masked' && <p className="faint" style={{ fontSize: 12.5 }}>Check that only the last 4 Aadhaar digits are visible. If the full number is visible, reject and ask for a masked copy.</p>}
      </div>

      <div className="field"><label htmlFor="rp-cat">Contributor category</label>
        <select id="rp-cat" className="input" style={{ width: 'auto' }} value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select>
        <span className="faint" style={{ fontSize: 12 }}>Describes their role on Chatimpu only. It is not press accreditation.</span></div>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        {pending && <button className="btn dark" disabled={busy} onClick={() => act('verify', false, 'Approve identity document')}>✓ Verify identity</button>}
        {['registered', 'verification_pending', 'verified'].includes(r.status) && <button className="btn primary" disabled={busy} onClick={() => act('approve', false, 'Activate reporter')}>Activate</button>}
        {r.status === 'active' && category !== r.category && <button className="btn dark" disabled={busy} onClick={() => act('approve', false, `Change category to ${label(category)}`)}>Save category</button>}
        {r.status === 'suspended' && <button className="btn primary" disabled={busy} onClick={() => act('reinstate', false, 'Reinstate reporter')}>Reinstate</button>}
        {['registered', 'verification_pending', 'verified'].includes(r.status) && <button className="btn ghost" disabled={busy} onClick={() => act('reject', true, 'Reject application')}>Reject</button>}
        {['active', 'verified'].includes(r.status) && <button className="btn danger" disabled={busy} onClick={() => act('suspend', true, 'Suspend reporter')}>Suspend</button>}
      </div>
    </div>
  );
}
