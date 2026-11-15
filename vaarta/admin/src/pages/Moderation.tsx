import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MANDALS } from '@data/locations';
import { PageHead } from '../components/Layout';
import { useStore } from '../lib/store';
import { ai, type Moderation as Mod } from '../lib/ai';
import { ago, cap, district, mandal, wordCount } from '../lib/format';

export default function Moderation() {
  const { submissions, setSubmission, upsertStory, session, toast } = useStore();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const scoped = submissions.filter((s) => !session.districts.length || session.districts.includes(s.districtId));
  const list = scoped.filter((s) => s.status === tab);
  const sel = scoped.find((s) => s.id === params.get('id')) ?? list[0];
  const [edit, setEdit] = useState<{ id: string; headline: string; body: string } | null>(null);
  const [check, setCheck] = useState<Record<string, Mod>>({});
  const [busy, setBusy] = useState(false);
  const draft = sel && edit?.id === sel.id ? edit : sel && { id: sel.id, headline: sel.headline, body: sel.body };

  const approve = () => {
    if (!sel || !draft) return;
    const m = MANDALS.find((x) => x.id === sel.mandalId)!;
    upsertStory({
      id: `cit-${sel.id}`, category: sel.category, stateId: sel.districtId === 'vsp' ? 'ap' : 'tg', districtId: sel.districtId, mandalId: sel.mandalId,
      lat: m.lat, lng: m.lng, image: sel.media[0] ?? '', source: 'Citizen Reporter', publishedAt: new Date().toISOString(),
      reporter: { name: sel.reporterName, verified: sel.verified, citizen: true },
      reactions: { like: 0, wow: 0, sad: 0, angry: 0 }, comments: 0, shares: 0, views: 0,
      content: { en: { headline: draft.headline, summary: draft.body }, [sel.lang]: { headline: draft.headline, summary: draft.body } },
      status: 'published', pushOnPublish: false, author: session.name,
    });
    setSubmission(sel.id, { status: 'approved', headline: draft.headline, body: draft.body });
    toast(`Approved and published to ${district(sel.districtId)}`);
    setParams({});
  };

  return (
    <>
      <PageHead kicker="Citizen Reporter" title="Moderation queue">
        <div className="tabs">{(['pending', 'approved', 'rejected'] as const).map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => { setTab(t); setParams({}); }}>{cap(t)} ({scoped.filter((s) => s.status === t).length})</button>)}</div>
      </PageHead>
      <div style={{ display: 'grid', gridTemplateColumns: '340px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ padding: 8 }}>
          {list.length === 0 && <div className="empty">Nothing here ✓</div>}
          {list.map((s) => (
            <div key={s.id} className={`queue-item ${sel?.id === s.id ? 'on' : ''}`} onClick={() => setParams({ id: s.id })} role="button" tabIndex={0}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block' }}>{s.headline}</b>
                <div className="faint" style={{ fontSize: 12.5 }}>{s.reporterName} {s.verified ? '✓' : '· unverified'} · {district(s.districtId)} · {ago(s.submittedAt)}</div>
                <div style={{ marginTop: 4 }}>{(s.aiFlags ?? []).map((f) => <span key={f} className="flag">{f}</span>)}</div>
              </div>
            </div>
          ))}
        </div>
        {sel && draft ? (
          <div className="card grid" style={{ gap: 14 }}>
            <div className="row">
              <span className="pill">{cap(sel.category)}</span><span className="pill">{mandal(sel.mandalId)}, {district(sel.districtId)}</span><span className="pill">{sel.lang.toUpperCase()}</span>
              <span className={`pill ${sel.verified ? 'published' : 'high'}`}>{sel.verified ? 'Verified reporter' : 'Unverified'}</span>
              <span className="spacer" /><span className="faint">{sel.reporterName} · {sel.reporterPhone}</span>
            </div>
            <input className="input headline" value={draft.headline} onChange={(e) => setEdit({ ...draft, headline: e.target.value })} disabled={sel.status !== 'pending'} />
            <textarea className="input" rows={6} value={draft.body} onChange={(e) => setEdit({ ...draft, body: e.target.value })} disabled={sel.status !== 'pending'} />
            <div className="faint" style={{ fontSize: 12 }}>{wordCount(draft.body)} words</div>
            {sel.media.length > 0 ? <div className="media-grid">{sel.media.map((m) => <img key={m} src={m} alt="Submitted media" />)}</div> : <div className="flag">No photos or video attached</div>}
            <div className="ai-panel">
              <div className="row"><b>AI pre-check</b><span className="spacer" />
                <button className="btn ai sm" disabled={busy} onClick={async () => { setBusy(true); try { setCheck({ ...check, [sel.id]: await ai.moderate({ headline: draft.headline, body: draft.body, lang: sel.lang }) }); } finally { setBusy(false); } }}>{busy ? 'Checking…' : '✦ Run check'}</button></div>
              {check[sel.id] && (
                <div style={{ marginTop: 10 }}>
                  <span className={`pill ${check[sel.id].risk}`}>Risk: {check[sel.id].risk}</span>{' '}
                  {check[sel.id].flags.map((f) => <span key={f} className="flag">{f}</span>)}
                  <p className="muted" style={{ margin: '6px 0 0' }}>{check[sel.id].note}</p>
                  {check[sel.id].suggested && <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => setEdit({ id: sel.id, headline: check[sel.id].suggested!.headline, body: check[sel.id].suggested!.summary })}>Use AI-edited version</button>}
                </div>
              )}
            </div>
            {sel.status === 'pending' && (
              <div className="row">
                <button className="btn primary" onClick={approve}>Approve & publish</button>
                <button className="btn danger" onClick={() => { setSubmission(sel.id, { status: 'rejected' }); toast('Rejected — reporter notified'); setParams({}); }}>Reject</button>
                <span className="faint" style={{ fontSize: 12.5 }}>Edits are saved with the approval. The reporter is credited on the story.</span>
              </div>
            )}
          </div>
        ) : <div className="card empty">Select a report</div>}
      </div>
    </>
  );
}
