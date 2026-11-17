/**
 * Editorial desk for contributor submissions:
 * SUBMITTED → AUTOMATED CHECKS → UNDER REVIEW → APPROVED → PUBLISHED, plus Correction required, On hold and Rejected.
 * Every decision goes through an audited SQL function (editorial_* in migrations/0005_reporters.sql).
 * AI tools assist editors; they are never treated as proof that something is true.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DISTRICTS } from '@data/locations';
import { PageHead } from '../components/Layout';
import { useStore } from '../lib/store';
import { ai, type Moderation as Mod } from '../lib/ai';
import { CATS, cap, district, mandal, wordCount } from '../lib/format';
import { supabase } from '../lib/supabase';
import {
  QUEUES, approveReport, editReport, loadRates, loadReports, paise, promoteCover, reportCounts, reportMedia, reporterStats, reportersByIds, reviewHistory, setStatus, when,
  type Rate, type Report, type ReporterLite, type Review, type SubMedia, db, ok,
} from '../newsroom/api';
import { NeedsBackend, Status, label, useReasonDialog } from '../newsroom/ui';

const TABS: [keyof typeof QUEUES, string][] = [['review', 'Under review'], ['hold', 'On hold'], ['correction', 'Correction requested'], ['approved', 'Approved'], ['published', 'Published'], ['rejected', 'Rejected']];
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const SENSITIVE_CHECKS = [
  'Facts confirmed with at least one independent source (official, document or second witness)',
  'Accused / named persons given a chance to respond, or not named',
  'No identification of victims, minors or patients',
  'Not likely to inflame communal, caste or political tension as written',
];

export default function Editorial() {
  if (!supabase) return <NeedsBackend kicker="Reporter network" title="Editorial desk" />;
  return <Desk />;
}

function Desk() {
  const { session } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('q') ?? 'review') as keyof typeof QUEUES;
  const [rows, setRows] = useState<Report[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reporters, setReporters] = useState<Record<string, ReporterLite>>({});
  const [filter, setFilter] = useState({ district: '', category: '', sensitive: false, text: '' });
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([loadReports(QUEUES[tab]), reportCounts()]);
      r.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2) || Number(b.is_sensitive) - Number(a.is_sensitive));
      setRows(r); setCounts(c);
      const rp = await reportersByIds(r.map((x) => x.reporter_id));
      setReporters(Object.fromEntries(rp.map((x) => [x.user_id, x])));
      setErr(null);
    } catch (e) { setErr((e as Error).message); }
  }, [tab]);
  useEffect(() => { setRows(null); load(); }, [load]);

  const shown = (rows ?? []).filter((r) =>
    (!session.districts.length || session.districts.includes(r.district_id)) && (!filter.district || r.district_id === filter.district)
    && (!filter.category || r.category_id === filter.category) && (!filter.sensitive || r.is_sensitive)
    && (!filter.text || `${r.code} ${r.headline} ${reporters[r.reporter_id]?.full_name ?? ''}`.toLowerCase().includes(filter.text.toLowerCase())));
  const selId = params.get('id');
  const sel = shown.find((r) => r.id === selId) ?? (selId ? (rows ?? []).find((r) => r.id === selId) : shown[0]);

  return (
    <>
      <PageHead kicker="Reporter network" title="Editorial desk">
        <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setParams({ q: k })}>{l} ({counts[k] ?? '·'})</button>)}</div>
      </PageHead>
      {err && <div className="banner" role="alert">⚠ {err}</div>}
      <div className="filters">
        <input className="input" placeholder="Search code, headline, reporter" value={filter.text} onChange={(e) => setFilter({ ...filter, text: e.target.value })} />
        <select className="input" value={filter.district} onChange={(e) => setFilter({ ...filter, district: e.target.value })}><option value="">All districts</option>{DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <select className="input" value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}><option value="">All categories</option>{CATS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</select>
        <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={filter.sensitive} onChange={(e) => setFilter({ ...filter, sensitive: e.target.checked })} />Sensitive only</label>
      </div>
      <div className="desk">
        <div className="card" style={{ padding: 8 }}>
          {rows === null ? <div className="empty">Loading…</div> : shown.length === 0 ? <div className="empty">Nothing here ✓</div> : shown.map((r) => (
            <div key={r.id} className={`queue-item ${sel?.id === r.id ? 'on' : ''}`} onClick={() => setParams({ q: tab, id: r.id })} onKeyDown={(e) => e.key === 'Enter' && setParams({ q: tab, id: r.id })} role="button" tabIndex={0}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block' }}>{r.headline}</b>
                <div className="faint" style={{ fontSize: 12.5 }}>{r.code} · {reporters[r.reporter_id]?.full_name ?? 'Contributor'} · {district(r.district_id)} · {when(r.submitted_at)}</div>
                <div className="row" style={{ marginTop: 4, gap: 4 }}>
                  {r.priority !== 'normal' && <Status s={r.priority} />}
                  {r.is_sensitive && <span className={`pill ${r.human_verified ? 'green' : 'red'}`}>{r.human_verified ? 'Sensitive · verified' : 'Sensitive'}</span>}
                  {r.duplicate_candidates?.length > 0 && <span className="pill amber">Possible duplicate</span>}
                  {r.assignment_id && <span className="pill blue">Assignment</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
        {sel ? <Detail key={sel.id} r={sel} reporter={reporters[sel.reporter_id]} onChange={load} /> : <div className="card empty">Select a submission</div>}
      </div>
    </>
  );
}

function Detail({ r, reporter, onChange }: { r: Report; reporter?: ReporterLite; onChange: () => Promise<void> }) {
  const { toast } = useStore();
  const { ask, dialog } = useReasonDialog();
  const [media, setMedia] = useState<SubMedia[]>([]);
  const [hist, setHist] = useState<Review[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [stats, setStats] = useState<{ total: number; published: number; rejected: number } | null>(null);
  const [assignmentAmount, setAssignmentAmount] = useState<number | null>(null);
  const [draft, setDraft] = useState({ headline: r.headline, body: r.body, summary: r.summary ?? '', category: r.category_id });
  const [cover, setCover] = useState<string | null>(null);
  const [contribution, setContribution] = useState('');
  const [amount, setAmount] = useState(0);
  const [checks, setChecks] = useState<boolean[]>(SENSITIVE_CHECKS.map(() => r.human_verified));
  const [vnotes, setVnotes] = useState(r.verification_notes ?? '');
  const [aiCheck, setAiCheck] = useState<Mod | null>(null);
  const [heads, setHeads] = useState<string[]>([]);
  const [translations, setTranslations] = useState<Record<string, { headline: string; summary: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const editable = ['submitted', 'ai_processing', 'under_review', 'on_hold', 'approved'].includes(r.status);
  const dirty = draft.headline !== r.headline || draft.body !== r.body || draft.summary !== (r.summary ?? '') || draft.category !== r.category_id;

  useEffect(() => {
    (async () => {
      const [m, h, rt, st] = await Promise.all([reportMedia(r.id), reviewHistory(r.id), loadRates(), reporterStats(r.reporter_id)]);
      setMedia(m); setHist(h); setRates(rt.filter((x) => x.active)); setStats(st);
      setCover(m.find((x) => x.kind === 'photo')?.id ?? null);
      let special: number | null = null;
      if (r.assignment_id) {
        const a = ok(await db().from('reporter_assignments').select('special_amount_paise').eq('id', r.assignment_id).maybeSingle()) as { special_amount_paise: number } | null;
        special = a?.special_amount_paise ?? null; setAssignmentAmount(special);
      }
      // Suggest a contribution type from what was actually submitted (editor can change it).
      const suggested = special ? 'special_assignment' : r.submission_type === 'detailed_report' ? 'detailed_report'
        : m.some((x) => x.kind === 'video') ? 'original_video' : m.some((x) => x.kind === 'photo') ? 'original_photo' : 'text_news';
      setContribution(suggested);
      const rate = rt.find((x) => x.code === suggested);
      setAmount(suggested === 'special_assignment' ? special ?? 0 : rate?.min_paise ?? 0);
    })().catch((e) => toast(`⚠ ${(e as Error).message}`));
  }, [r.id, r.assignment_id, r.reporter_id, r.submission_type, toast]);

  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(key);
    try { const extra = await fn(); toast(typeof extra === 'string' ? `${okMsg} · ${extra}` : okMsg); await onChange(); setHist(await reviewHistory(r.id)); return true; }
    catch (e) { toast(`⚠ ${(e as Error).message}`); return false; } finally { setBusy(null); }
  };
  const saveEdits = () => run('save', () => editReport(r.id, { headline: draft.headline, body: draft.body, summary: draft.summary, category_id: draft.category }), 'Edits saved');
  const rate = rates.find((x) => x.code === contribution);
  const summaryWords = wordCount(draft.summary);
  const sensitiveBlock = r.is_sensitive && !r.human_verified;
  const approveBlock = !editable ? '' : sensitiveBlock ? 'Sensitive: complete human verification first'
    : summaryWords < 30 || summaryWords > 100 ? `Published summary must be 30–100 words (now ${summaryWords})`
    : draft.headline.trim().length < 10 ? 'Headline too short'
    : contribution && contribution !== 'none' && contribution !== 'special_assignment' && rate && (amount < rate.min_paise || amount > rate.max_paise) ? `Amount must be ${paise(rate.min_paise)}–${paise(rate.max_paise)}` : '';

  const approve = async (publish: boolean) => {
    const note = await ask(publish ? 'Approve & publish' : 'Approve (publish later)', { required: false, hint: 'Optional note for the reporter and the audit trail.' });
    if (note === null) return;
    await run(publish ? 'publish' : 'approve', async () => {
      if (dirty) await editReport(r.id, { headline: draft.headline, body: draft.body, summary: draft.summary, category_id: draft.category });
      const m = media.find((x) => x.id === cover);
      const imagePath = m ? await promoteCover(m, r.code ?? r.id) : null;
      const res = await approveReport({ id: r.id, headline: draft.headline, summary: draft.summary, contribution: contribution || 'none', amountPaise: amount, publish, imagePath, note: note || undefined, translations });
      return res.earning ? `credited ${paise(res.earning.amount_paise)} (${res.earning.code})` : 'no payment';
    }, publish ? 'Approved and published' : 'Approved');
  };
  const decide = async (status: 'correction_required' | 'on_hold' | 'rejected' | 'under_review') => {
    const titles = { correction_required: 'Request a correction', on_hold: 'Put on hold', rejected: 'Reject submission', under_review: 'Move back to review' };
    const note = await ask(titles[status], { required: status === 'correction_required' || status === 'rejected', hint: status === 'rejected' ? 'The reporter sees this reason.' : status === 'correction_required' ? 'Tell the reporter exactly what to fix or add.' : 'Optional note (internal history).' });
    if (note === null) return;
    await run(status, () => setStatus(r.id, status, note || undefined), `Moved to ${label(status)}`);
  };
  const verify = async () => {
    if (!checks.every(Boolean)) return toast('Tick every verification step first');
    if (vnotes.trim().length < 10) return toast('Record how the facts and sources were verified');
    await run('verify', () => editReport(r.id, { human_verified: true, verification_notes: vnotes.trim() }), 'Human verification recorded');
  };
  const clearSensitive = async () => {
    const why = await ask('Mark as not sensitive', { hint: 'Explain why the automatic flag does not apply. This is logged.' });
    if (!why) return;
    await run('clear', () => editReport(r.id, { is_sensitive: false, verification_notes: why }), 'Sensitivity flag cleared');
  };
  const markSensitive = () => run('mark', () => editReport(r.id, { is_sensitive: true, human_verified: false }), 'Marked sensitive — human verification required');

  const aiSummarize = async () => {
    setBusy('ai'); try { const c = await ai.summarize(draft.body, r.lang); setDraft((d) => ({ ...d, summary: c.summary })); toast('AI draft summary inserted — check every fact against the report'); }
    catch (e) { toast(`⚠ ${(e as Error).message}`); } finally { setBusy(null); }
  };
  const aiModerate = async () => {
    setBusy('ai'); try { setAiCheck(await ai.moderate({ headline: draft.headline, body: draft.body, lang: r.lang })); } catch (e) { toast(`⚠ ${(e as Error).message}`); } finally { setBusy(null); }
  };
  const aiHeadlines = async () => {
    setBusy('ai'); try { setHeads(await ai.headlines({ headline: draft.headline, summary: draft.summary || draft.body }, r.lang)); } catch (e) { toast(`⚠ ${(e as Error).message}`); } finally { setBusy(null); }
  };
  const aiTranslate = async () => {
    const to = ['te', 'en', 'hi'].filter((l) => l !== r.lang);
    setBusy('ai'); try { setTranslations(await ai.translate({ headline: draft.headline, summary: draft.summary }, r.lang, to)); toast('Machine translations added — they are labelled as machine-translated'); }
    catch (e) { toast(`⚠ ${(e as Error).message}`); } finally { setBusy(null); }
  };

  const photos = useMemo(() => media.filter((m) => m.kind === 'photo'), [media]);

  return (
    <div className="card grid" style={{ gap: 14 }}>
      {dialog}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <b>{r.code}</b><Status s={r.status} /><span className="pill">{label(r.submission_type)}</span><span className="pill">{cap(r.category_id)}</span><span className="pill">{r.lang.toUpperCase()}</span>
        <span className="spacer" />
        <label className="row faint" style={{ gap: 6, fontSize: 12.5 }}>Priority
          <select className="input" style={{ width: 'auto', padding: '4px 8px' }} value={r.priority} disabled={!editable}
            onChange={(e) => run('priority', () => editReport(r.id, { priority: e.target.value }), 'Priority updated')}>
            {['urgent', 'high', 'normal', 'low'].map((p) => <option key={p}>{p}</option>)}</select></label>
      </div>

      <div className="row" style={{ flexWrap: 'wrap', gap: 6, fontSize: 13 }}>
        <span>👤 <b>{reporter?.full_name ?? 'Contributor'}</b></span>
        {reporter && <><Status s={reporter.status} /><span className="faint">{label(reporter.category)}</span></>}
        {stats && <span className="faint">· {stats.total} submitted · {stats.published} accepted · {stats.rejected} rejected</span>}
        <span className="faint">· 📍 {[r.locality, mandal(r.mandal_id ?? undefined), district(r.district_id)].filter(Boolean).join(', ')}</span>
      </div>
      <div className="faint" style={{ fontSize: 12.5 }}>
        Incident: {r.incident_location || '—'} · {r.incident_at ? when(r.incident_at) : 'time not given'} · Submitted {when(r.submitted_at)} · Rights &amp; consent {r.rights_confirmed ? '✓ confirmed' : '✕ missing'}
      </div>

      {r.is_sensitive && (
        <div className={r.human_verified ? 'ok-box' : 'warn-box'}>
          <div className="row"><b>{r.human_verified ? '✓ Sensitive — human-verified' : '⚠ Sensitive — needs human verification before approval'}</b><span className="spacer" />
            {editable && !r.human_verified && <button className="btn sm ghost" onClick={clearSensitive}>Not sensitive…</button>}</div>
          <div style={{ marginTop: 6 }}>{r.sensitivity_reasons.map((x) => <span key={x} className="flag">{x}</span>)}</div>
          {r.human_verified ? <p className="muted" style={{ margin: '6px 0 0' }}>{r.verification_notes}</p> : editable && (
            <div className="grid" style={{ gap: 6, marginTop: 10 }}>
              {SENSITIVE_CHECKS.map((c, i) => <label key={c} className="row" style={{ gap: 8, alignItems: 'flex-start' }}><input type="checkbox" checked={checks[i]} onChange={(e) => setChecks(checks.map((x, j) => (j === i ? e.target.checked : x)))} />{c}</label>)}
              <textarea className="input" rows={2} placeholder="How were the facts and sources verified? (who, when, documents)" value={vnotes} onChange={(e) => setVnotes(e.target.value)} />
              <div><button className="btn dark sm" disabled={busy === 'verify'} onClick={verify}>Record human verification</button></div>
            </div>
          )}
        </div>
      )}
      {!r.is_sensitive && editable && <div><button className="btn sm ghost" onClick={markSensitive}>Flag as sensitive</button></div>}

      {r.duplicate_candidates?.length > 0 && (
        <div className="warn-box">
          <b>Possible duplicates</b>
          {r.duplicate_candidates.map((d) => (
            <div key={d.id} style={{ fontSize: 13, marginTop: 4 }}>
              {Math.round(d.score * 100)}% · {d.type === 'story' ? <Link to={`/stories/${d.id}`}>Published story</Link> : <Link to={`/editorial?id=${d.id}`}>{d.code ?? 'Submission'}</Link>} — {d.headline}
            </div>
          ))}
        </div>
      )}

      <div className="field"><label htmlFor="ed-h">Headline</label>
        <input id="ed-h" className="input headline" value={draft.headline} disabled={!editable} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} /></div>
      {heads.length > 0 && <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>{heads.map((h) => <button key={h} className="btn sm ghost" onClick={() => setDraft({ ...draft, headline: h })}>{h}</button>)}</div>}
      <div className="field"><label htmlFor="ed-b">Reporter's full text</label>
        <textarea id="ed-b" className={`input ${r.lang === 'te' ? 'te-body' : ''}`} rows={8} value={draft.body} disabled={!editable} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        <span className="faint" style={{ fontSize: 12 }}>{wordCount(draft.body)} words</span></div>
      <div className="row">
        <label className="row faint" style={{ gap: 6 }}>Category
          <select className="input" style={{ width: 'auto' }} value={draft.category} disabled={!editable} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</select></label>
        <span className="spacer" />
        {editable && dirty && <button className="btn sm dark" disabled={busy === 'save'} onClick={saveEdits}>Save edits</button>}
      </div>

      <div>
        <b>Media</b> <span className="faint" style={{ fontSize: 12.5 }}>· originals stay private; the selected photo is copied to public storage only when publishing</span>
        {media.length === 0 ? <div className="flag" style={{ marginTop: 6 }}>No media attached</div> : (
          <div className="media-row" style={{ marginTop: 8 }}>
            {media.map((m) => (
              <figure key={m.id} className={cover === m.id ? 'cover' : ''}>
                {m.kind === 'photo' && <a href={m.url ?? undefined} target="_blank" rel="noreferrer"><img src={m.url ?? undefined} alt="Submitted photo" /></a>}
                {m.kind === 'video' && <video src={m.url ?? undefined} controls preload="metadata" />}
                {m.kind === 'audio' && <audio src={m.url ?? undefined} controls style={{ width: 180 }} />}
                {m.kind === 'document' && <a className="btn ghost" href={m.url ?? undefined} target="_blank" rel="noreferrer">📄 Document</a>}
                <figcaption>
                  {m.kind}{m.size_bytes ? ` · ${(m.size_bytes / 1048576).toFixed(1)} MB` : ''}{m.duration_sec ? ` · ${m.duration_sec}s` : ''}
                  {m.kind === 'photo' && editable && <label className="row" style={{ gap: 4 }}><input type="radio" name="cover" checked={cover === m.id} onChange={() => setCover(m.id)} />cover</label>}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        {editable && photos.length === 0 && <p className="faint" style={{ fontSize: 12.5 }}>No photo: the story will use the category placeholder image.</p>}
      </div>

      <div className="confidential">
        <b>🔒 Sources &amp; evidence — confidential</b>
        <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{r.source_notes || <span className="faint">None given</span>}</p>
        <p className="faint" style={{ margin: '6px 0 0', fontSize: 12 }}>Never publish or share source details. Protect the identity of confidential sources.</p>
      </div>

      <div className="ai-panel">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}><b>AI assistant</b><span className="faint" style={{ fontSize: 12 }}>· suggestions only, never proof of truth</span><span className="spacer" />
          <button className="btn ai sm" disabled={!!busy} onClick={aiModerate}>✦ Risk check</button>
          <button className="btn ai sm" disabled={!!busy || !editable} onClick={aiSummarize}>✦ Draft summary</button>
          <button className="btn ai sm" disabled={!!busy || !editable} onClick={aiHeadlines}>✦ Headlines</button>
          <button className="btn ai sm" disabled={!!busy || !editable || summaryWords < 30} onClick={aiTranslate}>✦ Translate</button></div>
        {busy === 'ai' && <p className="faint">Working…</p>}
        {aiCheck && (
          <div style={{ marginTop: 8 }}>
            <span className={`pill ${aiCheck.risk}`}>Risk: {aiCheck.risk}</span> {aiCheck.flags.map((f) => <span key={f} className="flag">{f}</span>)}
            <p className="muted" style={{ margin: '6px 0 0' }}>{aiCheck.note}</p>
            {aiCheck.suggested && editable && <button className="btn sm ghost" style={{ marginTop: 6 }} onClick={() => setDraft({ ...draft, headline: aiCheck.suggested!.headline, summary: aiCheck.suggested!.summary })}>Use suggested wording (spelling / style)</button>}
          </div>
        )}
        {Object.keys(translations).length > 0 && (
          <div className="grid" style={{ gap: 6, marginTop: 8 }}>
            {Object.entries(translations).map(([l, c]) => (
              <div key={l} style={{ fontSize: 13 }}><span className="pill">{l.toUpperCase()} · machine</span> <b>{c.headline}</b><div className="muted">{c.summary}</div></div>
            ))}
            <button className="btn sm ghost" onClick={() => setTranslations({})}>Discard translations</button>
          </div>
        )}
      </div>

      {editable && (
        <div className="card" style={{ background: 'var(--surface-alt)', boxShadow: 'none' }}>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>Approve</h2>
          <div className="field"><label htmlFor="ed-s">Published summary (30–100 words; 60–80 ideal)</label>
            <textarea id="ed-s" className={`input ${r.lang === 'te' ? 'te-body' : ''}`} rows={4} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
            <span className={`counter ${summaryWords >= 30 && summaryWords <= 100 ? 'ok' : ''}`}>{summaryWords} words</span></div>
          <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ margin: 0 }}><label htmlFor="ed-c">Contribution (rate card)</label>
              <select id="ed-c" className="input" value={contribution} disabled={r.status === 'approved'} onChange={(e) => {
                const c = e.target.value; setContribution(c);
                const rr = rates.find((x) => x.code === c); setAmount(c === 'special_assignment' ? assignmentAmount ?? 0 : rr?.min_paise ?? 0);
              }}>
                <option value="none">No payment</option>
                {rates.filter((x) => x.code !== 'bonus' && (x.code !== 'special_assignment' || r.assignment_id)).map((x) => <option key={x.code} value={x.code}>{x.label_en}</option>)}
              </select></div>
            {contribution && contribution !== 'none' && (
              <div className="field" style={{ margin: 0 }}><label htmlFor="ed-a">Amount (₹)</label>
                {contribution === 'special_assignment' ? <div className="money" style={{ padding: '10px 0' }}>{paise(assignmentAmount)} <span className="faint">(set on the assignment, paid once)</span></div>
                  : <input id="ed-a" className="input" style={{ width: 120 }} type="number" min={(rate?.min_paise ?? 0) / 100} max={(rate?.max_paise ?? 0) / 100} step="1"
                    value={amount / 100} disabled={!rate || rate.min_paise === rate.max_paise || r.status === 'approved'} onChange={(e) => setAmount(Math.round(Number(e.target.value) * 100))} />}
              </div>
            )}
            {r.status === 'approved' && <span className="faint" style={{ fontSize: 12.5 }}>Already approved — earnings were credited once; publishing will not pay again.</span>}
          </div>
          <div className="row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn primary" disabled={!!busy || !!approveBlock} title={approveBlock} onClick={() => approve(true)}>{busy === 'publish' ? 'Publishing…' : 'Approve & publish'}</button>
            {r.status !== 'approved' && <button className="btn dark" disabled={!!busy || !!approveBlock} title={approveBlock} onClick={() => approve(false)}>Approve only</button>}
            {r.status !== 'approved' && <>
              <button className="btn ghost" disabled={!!busy} onClick={() => decide('correction_required')}>Request correction</button>
              {r.status !== 'on_hold' ? <button className="btn ghost" disabled={!!busy} onClick={() => decide('on_hold')}>Hold</button>
                : <button className="btn ghost" disabled={!!busy} onClick={() => decide('under_review')}>Resume review</button>}
              <button className="btn danger" disabled={!!busy} onClick={() => decide('rejected')}>Reject</button>
            </>}
          </div>
          {approveBlock && <p className="faint" style={{ fontSize: 12.5, margin: '8px 0 0' }}>{approveBlock}</p>}
        </div>
      )}
      {r.status === 'correction_required' && <div className="warn-box"><b>Waiting for the reporter:</b> {r.correction_note}</div>}
      {r.status === 'rejected' && <div className="warn-box"><b>Rejected:</b> {r.rejection_reason}</div>}
      {r.story_id && <div><Link className="btn ghost sm" to={`/stories/${r.story_id}`}>Open the story in the editor →</Link></div>}

      <div>
        <b>Audit history</b>
        <ul className="timeline" style={{ marginTop: 8 }}>
          {hist.map((h) => (
            <li key={h.id}><b>{label(h.action)}</b> {h.to_status && h.to_status !== h.from_status && <span className="faint">→ {label(h.to_status)}</span>} <span className="faint">· {when(h.created_at)}{h.actor_id ? '' : ' · system'}</span>
              {h.note && <div className="muted">{h.note}</div>}
              {h.details && 'amount_paise' in h.details && Number(h.details.amount_paise) > 0 && <div className="faint">Earning {String(h.details.earning)} · {paise(Number(h.details.amount_paise))}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
