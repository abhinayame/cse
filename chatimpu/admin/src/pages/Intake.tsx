/**
 * Automated intake: approved feeds are read at 05:00 and 17:00 IST and turned into short cards on the
 * editorial desk (ready for the 06:00 / 18:00 editions). Only add sources you are allowed to republish.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { DISTRICTS } from '@data/locations';
import { PageHead } from '../components/Layout';
import { useStore } from '../lib/store';
import { CATS, cap, district } from '../lib/format';
import { supabase } from '../lib/supabase';
import { db, ok, rpc, setSetting, when, loadSettings } from '../newsroom/api';
import { Kpi, NeedsBackend, Status, label } from '../newsroom/ui';

interface Source { id: string; name: string; kind: string; url: string; trust: string; district_id: string; category_id: string | null; language: string; licence_note: string; auto_publish: boolean; active: boolean; last_fetched_at: string | null; last_error: string | null; items_total: number }
interface Run { id: string; edition: string; started_at: string; finished_at: string | null; fetched: number; queued: number; published: number; duplicates: number; errors: number }
interface Dash { target: number; published_today: number; waiting: number; by_category: Record<string, number>; by_source: Record<string, number>; next_edition_at: string }

export default function Intake() {
  if (!supabase) return <NeedsBackend kicker="Newsroom" title="Automated intake" />;
  return <Desk />;
}

function Desk() {
  const { toast, session } = useStore();
  const [dash, setDash] = useState<Dash | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [edit, setEdit] = useState<Partial<Source> | null>(null);
  const [running, setRunning] = useState(false);
  const [cfg, setCfg] = useState({ enabled: true, max: '60', target: '100' });
  const canEdit = ['super_admin', 'editor'].includes(session.role);
  const load = useCallback(async () => {
    try {
      const [d, s, r, st] = await Promise.all([rpc<Dash>('intake_dashboard'), db().from('news_sources').select('*').order('created_at'), db().from('intake_runs').select('*').order('started_at', { ascending: false }).limit(10),
        loadSettings(['intake_enabled', 'intake_max_per_run', 'intake_daily_target'])]);
      setDash(d); setSources(ok(s) as Source[]); setRuns(ok(r) as Run[]);
      setCfg({ enabled: st.intake_enabled !== false && st.intake_enabled !== 'false', max: String(st.intake_max_per_run ?? 60), target: String(st.intake_daily_target ?? 100) });
    } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await db().functions.invoke('intake', { body: {} });
      if (error) throw new Error((await (error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? error.message);
      const r = data as { queued?: number; published?: number; duplicates?: number; errors?: number; skipped?: string };
      toast(r.skipped ? `Skipped: ${r.skipped}` : `Queued ${r.queued} · auto-published ${r.published} · duplicates ${r.duplicates} · errors ${r.errors}`);
      load();
    } catch (e) { toast(`⚠ ${(e as Error).message}`); } finally { setRunning(false); }
  };
  const saveCfg = async () => {
    try { await setSetting('intake_enabled', cfg.enabled); await setSetting('intake_max_per_run', Number(cfg.max)); await setSetting('intake_daily_target', Number(cfg.target)); toast('Intake settings saved'); load(); }
    catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };
  const toggle = async (s: Source) => { try { ok(await db().from('news_sources').update({ active: !s.active }).eq('id', s.id)); load(); } catch (e) { toast(`⚠ ${(e as Error).message}`); } };
  const pct = dash ? Math.min(100, Math.round((dash.published_today / Math.max(1, dash.target)) * 100)) : 0;

  return (
    <>
      <PageHead kicker="Newsroom" title="Automated intake">
        {canEdit && <button className="btn ghost" onClick={() => setEdit({ kind: 'rss', trust: 'official', district_id: 'hyd', language: 'te', active: true, auto_publish: false })}>＋ Add source</button>}
        {canEdit && <button className="btn primary" disabled={running} onClick={runNow}>{running ? 'Running…' : 'Run now'}</button>}
      </PageHead>
      <div className="banner">Runs automatically at <b>05:00</b> and <b>17:00 IST</b> so cards are ready for the <b>06:00</b> and <b>18:00</b> editions. Each item becomes a short card on the <Link to="/editorial">Editorial desk</Link> that credits and links its source, and goes through the same sensitivity and duplicate checks as reporters' news. Only add sources you are allowed to republish (government press releases, licensed agencies, partners).</div>
      {dash && (
        <div className="kpis">
          <Kpi label="Published or scheduled today" value={`${dash.published_today} / ${dash.target}`} sub={<span style={{ display: 'block', height: 6, borderRadius: 3, background: 'var(--surface-alt)', marginTop: 6 }}><span style={{ display: 'block', width: `${pct}%`, height: 6, borderRadius: 3, background: 'var(--red)' }} /></span>} />
          <Kpi label="Waiting on the desk" value={dash.waiting} tone={dash.waiting > 50 ? 'red' : undefined} />
          <Kpi label="Next edition (IST)" value={new Date(dash.next_edition_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })} sub={new Date(dash.next_edition_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })} />
          <Kpi label="Active sources" value={sources.filter((s) => s.active).length} sub={`${sources.filter((s) => s.last_error && s.active).length} with errors`} />
        </div>
      )}
      {dash && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ marginBottom: 10 }}>Today by category</h2>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {CATS.map((c) => <span key={c} className={`pill ${(dash.by_category[c] ?? 0) === 0 ? 'red' : 'green'}`}>{cap(c)} · {dash.by_category[c] ?? 0}</span>)}
          </div>
          <p className="faint" style={{ margin: '8px 0 0', fontSize: 12.5 }}>Red categories have nothing yet today — add a source for them or assign a reporter.</p>
        </div>
      )}
      <div className="card table-wrap" style={{ marginTop: 16, padding: 8 }}>
        <h2 style={{ padding: '8px 10px' }}>Sources</h2>
        <table><thead><tr><th>Source</th><th>Trust</th><th>Area · category</th><th>Last fetch</th><th>Items</th><th>Auto-publish</th><th>Active</th><th /></tr></thead>
          <tbody>{sources.length === 0 ? <tr><td colSpan={8} className="empty">No sources yet — add the official feeds you may republish.</td></tr> : sources.map((s) => (
            <tr key={s.id}>
              <td><b>{s.name}</b><div className="faint" style={{ fontSize: 12, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.url}</div><div className="faint" style={{ fontSize: 11.5 }}>{s.licence_note}</div></td>
              <td><Status s={s.trust === 'official' ? 'active' : s.trust === 'agency' ? 'verified' : 'pending'} /> <span className="faint" style={{ fontSize: 12 }}>{label(s.trust)}</span></td>
              <td>{district(s.district_id)} · {s.category_id ? cap(s.category_id) : 'auto'} · {s.language.toUpperCase()}</td>
              <td className="faint" style={{ fontSize: 12.5 }}>{when(s.last_fetched_at)}{s.last_error && <div style={{ color: 'var(--red-deep)' }}>⚠ {s.last_error}</div>}</td>
              <td>{s.items_total}{dash?.by_source[s.name] ? <div className="faint" style={{ fontSize: 12 }}>+{dash.by_source[s.name]} today</div> : null}</td>
              <td>{s.auto_publish ? <span className="pill green">Yes (non-sensitive)</span> : <span className="faint">Editor review</span>}</td>
              <td><label className="switch"><input type="checkbox" checked={s.active} disabled={!canEdit} onChange={() => toggle(s)} aria-label={`Active: ${s.name}`} /></label></td>
              <td>{canEdit && <button className="btn sm ghost" onClick={() => setEdit(s)}>Edit</button>}</td>
            </tr>
          ))}</tbody></table>
      </div>
      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 16 }}>
        <div className="card table-wrap" style={{ padding: 8 }}>
          <h2 style={{ padding: '8px 10px' }}>Recent runs</h2>
          <table><thead><tr><th>When</th><th>Edition</th><th>Fetched</th><th>Queued</th><th>Auto-published</th><th>Duplicates</th><th>Errors</th></tr></thead>
            <tbody>{runs.length === 0 ? <tr><td colSpan={7} className="empty">No runs yet</td></tr> : runs.map((r) => (
              <tr key={r.id}><td className="faint">{when(r.started_at)}</td><td>{label(r.edition)}</td><td>{r.fetched}</td><td>{r.queued}</td><td>{r.published}</td><td>{r.duplicates}</td><td style={r.errors ? { color: 'var(--red-deep)' } : undefined}>{r.errors}</td></tr>
            ))}</tbody></table>
        </div>
        {canEdit && (
          <div className="card grid" style={{ gap: 8, alignContent: 'start' }}>
            <h2>Settings</h2>
            <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />Run automatically twice a day</label>
            <div className="field" style={{ margin: 0 }}><label htmlFor="in-m">Max cards per run</label><input id="in-m" className="input" type="number" min={1} max={500} value={cfg.max} onChange={(e) => setCfg({ ...cfg, max: e.target.value })} /></div>
            <div className="field" style={{ margin: 0 }}><label htmlFor="in-t">Daily target</label><input id="in-t" className="input" type="number" min={1} max={2000} value={cfg.target} onChange={(e) => setCfg({ ...cfg, target: e.target.value })} /></div>
            <button className="btn dark" onClick={saveCfg}>Save</button>
          </div>
        )}
      </div>
      {edit && <SourceEditor s={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}

function SourceEditor({ s, onClose, onSaved }: { s: Partial<Source>; onClose: () => void; onSaved: () => void }) {
  const { toast } = useStore();
  const [f, setF] = useState(s);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const row = { name: f.name, kind: f.kind, url: f.url?.trim(), trust: f.trust, district_id: f.district_id, category_id: f.category_id || null, language: f.language, licence_note: f.licence_note, auto_publish: f.trust === 'official' && !!f.auto_publish, active: f.active ?? true };
      if (f.id) ok(await db().from('news_sources').update(row).eq('id', f.id)); else ok(await db().from('news_sources').insert(row));
      toast('Source saved'); onSaved();
    } catch (e2) { toast(`⚠ ${(e2 as Error).message}`); } finally { setBusy(false); }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal grid" style={{ gap: 10, maxWidth: 560 }} role="dialog" aria-modal="true" aria-label="News source" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 style={{ fontSize: 20 }}>{f.id ? 'Edit source' : 'Add source'}</h2>
        <div className="field"><label htmlFor="sr-n">Name</label><input id="sr-n" className="input" required value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="District Collectorate, Warangal — press releases" /></div>
        <div className="field"><label htmlFor="sr-u">Feed URL (RSS or Atom, https)</label><input id="sr-u" className="input" required pattern="https://.+" value={f.url ?? ''} onChange={(e) => setF({ ...f, url: e.target.value })} /></div>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field"><label htmlFor="sr-k">Format</label><select id="sr-k" className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="rss">RSS</option><option value="atom">Atom</option></select></div>
          <div className="field"><label htmlFor="sr-t">Trust</label><select id="sr-t" className="input" value={f.trust} onChange={(e) => setF({ ...f, trust: e.target.value, auto_publish: e.target.value === 'official' ? f.auto_publish : false })}>
            <option value="official">Official (government / police / collectorate)</option><option value="agency">Licensed news agency</option><option value="partner">Partner outlet</option><option value="other">Other</option></select></div>
          <div className="field"><label htmlFor="sr-d">District</label><select id="sr-d" className="input" value={f.district_id} onChange={(e) => setF({ ...f, district_id: e.target.value })}>{DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div className="field"><label htmlFor="sr-c">Category</label><select id="sr-c" className="input" value={f.category_id ?? ''} onChange={(e) => setF({ ...f, category_id: e.target.value || null })}><option value="">Guess from text</option>{CATS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</select></div>
          <div className="field"><label htmlFor="sr-l">Language</label><select id="sr-l" className="input" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}><option value="te">Telugu</option><option value="en">English</option><option value="hi">Hindi</option></select></div>
        </div>
        <div className="field"><label htmlFor="sr-x">Why we may republish it</label><input id="sr-x" className="input" required minLength={10} value={f.licence_note ?? ''} onChange={(e) => setF({ ...f, licence_note: e.target.value })} placeholder="Government press release (public) / agency licence no. … / partner agreement dated …" /></div>
        <label className="row" style={{ gap: 8, opacity: f.trust === 'official' ? 1 : 0.5 }}><input type="checkbox" disabled={f.trust !== 'official'} checked={!!f.auto_publish} onChange={(e) => setF({ ...f, auto_publish: e.target.checked })} />
          Auto-publish to the next edition (official sources only; crime, political, health and duplicate items still wait for an editor)</label>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>Save</button></div>
      </form>
    </div>
  );
}
