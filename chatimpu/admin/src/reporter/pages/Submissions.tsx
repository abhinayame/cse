import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { db, getSubmission, history, listMedia, listSubmissions, signedUrl, type Media, type Submission } from '../api';
import { useLang, useT } from '../i18n';
import { ErrorNote, SubmissionStatus, fmtDate, useToast } from '../ui';

const FILTERS: Record<string, string[] | null> = {
  all: null,
  drafts: ['draft'],
  review: ['submitted', 'ai_processing', 'under_review', 'on_hold'],
  correction: ['correction_required'],
  published: ['approved', 'published'],
  rejected: ['rejected'],
};
const FILTER_LABEL = { all: 'all', drafts: 'drafts', review: 'inReview', correction: 'needsCorrection', published: 'published', rejected: 'rejected' } as const;

export default function Submissions() {
  const t = useT(); const lang = useLang();
  const [qs, setQs] = useSearchParams();
  const f = (qs.get('f') ?? 'all') as keyof typeof FILTERS;
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { listSubmissions().then(setRows).catch((e) => setErr(e.message)); }, []);
  const shown = (rows ?? []).filter((r) => !FILTERS[f] || FILTERS[f]!.includes(r.status));
  const count = (k: keyof typeof FILTERS) => (rows ?? []).filter((r) => !FILTERS[k] || FILTERS[k]!.includes(r.status)).length;

  return (
    <>
      <div className="rp-section rp-section-head"><h1>{t('myNews')}</h1><Link to="/reporter/submit" className="rp-btn primary sm">＋ {t('submit')}</Link></div>
      <div className="rp-seg" role="tablist">
        {(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((k) => (
          <button key={k} role="tab" aria-selected={f === k} className={f === k ? 'on' : ''} onClick={() => setQs(k === 'all' ? {} : { f: k }, { replace: true })}>
            {t(FILTER_LABEL[k as keyof typeof FILTER_LABEL])}{rows ? ` ${count(k)}` : ''}</button>
        ))}
      </div>
      <ErrorNote error={err} />
      <div className="rp-card rp-section" style={{ paddingTop: 0, paddingBottom: 0 }}>
        {rows === null ? <p className="rp-empty">…</p> : shown.length === 0 ? <p className="rp-empty">{t('noSubmissions')}</p> : shown.map((s) => (
          <Link key={s.id} to={s.status === 'draft' ? `/reporter/submit/${s.id}` : `/reporter/submissions/${s.id}`} className="rp-list-item">
            <div className="grow">
              <div className="title">{s.headline || '—'}</div>
              <div className="rp-meta">{s.code ?? t('s_draft')} · {t(`t_${s.submission_type}` as never)} · {fmtDate(s.updated_at, lang)}</div>
              {s.status === 'correction_required' && s.correction_note && <div className="rp-hint" style={{ color: '#9A5B0C' }}>✎ {s.correction_note}</div>}
            </div>
            <SubmissionStatus s={s.status} t={t} />
          </Link>
        ))}
      </div>
    </>
  );
}

const STEPS = ['submitted', 'ai_processing', 'under_review', 'approved', 'published'];

export function SubmissionDetail() {
  const t = useT(); const lang = useLang(); const nav = useNavigate(); const toast = useToast();
  const { id } = useParams();
  const [s, setS] = useState<Submission | null>(null);
  const [media, setMedia] = useState<(Media & { url: string | null })[]>([]);
  const [hist, setHist] = useState<Awaited<ReturnType<typeof history>>>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const sub = await getSubmission(id);
        setS(sub);
        const [m, h] = await Promise.all([listMedia(id), history(id)]);
        setMedia(await Promise.all(m.map(async (x) => ({ ...x, url: await signedUrl(x.bucket, x.storage_path) }))));
        setHist(h);
      } catch (e) { setErr((e as Error).message); }
    })();
  }, [id]);
  if (err) return <div className="rp-section"><ErrorNote error={err} /></div>;
  if (!s) return <p className="rp-empty">…</p>;

  const reached = STEPS.indexOf(s.status === 'on_hold' || s.status === 'correction_required' || s.status === 'rejected' ? 'under_review' : s.status);
  const del = async () => {
    if (!confirm('Delete this draft?')) return;
    const { error } = await db().from('citizen_reports').delete().eq('id', s.id);
    if (error) return setErr(error.message);
    toast('Deleted'); nav('/reporter/submissions');
  };

  return (
    <>
      <div className="rp-section rp-row" style={{ justifyContent: 'space-between' }}>
        <button className="rp-btn ghost sm" onClick={() => nav(-1)}>← {t('back')}</button>
        <SubmissionStatus s={s.status} t={t} />
      </div>
      <p className="rp-meta rp-section">{s.code} · {t(`t_${s.submission_type}` as never)}</p>
      <h1 style={{ margin: '4px 0 10px' }}>{s.headline}</h1>

      {s.status === 'correction_required' && (
        <div className="rp-banner warn"><div className="grow"><b>{t('editorNote')}:</b> {s.correction_note}
          <div style={{ marginTop: 8 }}><Link to={`/reporter/submit/${s.id}`} className="rp-btn sm dark">{t('edit')}</Link></div></div></div>
      )}
      {s.status === 'rejected' && s.rejection_reason && <div className="rp-banner bad"><div><b>{t('editorNote')}:</b> {s.rejection_reason}</div></div>}
      {s.status === 'published' && s.story_id && <div className="rp-banner good">✓ {t('s_published')}</div>}

      {!['draft', 'rejected'].includes(s.status) && (
        <section className="rp-section rp-card" aria-label={t('timeline')}>
          <h2 style={{ marginBottom: 12 }}>{t('timeline')}</h2>
          <div className="rp-row" style={{ gap: 4 }}>
            {STEPS.map((st, i) => <div key={st} style={{ flex: 1, height: 6, borderRadius: 3, background: i <= reached ? 'var(--red)' : 'var(--surface-alt)' }} title={t(`s_${st}` as never)} />)}
          </div>
          <div className="rp-row rp-meta" style={{ justifyContent: 'space-between', marginTop: 6, fontSize: 11 }}>
            {STEPS.map((st) => <span key={st}>{t(`s_${st}` as never)}</span>)}
          </div>
        </section>
      )}

      <section className="rp-section rp-card">
        {media.length > 0 && (
          <div className="rp-media" style={{ marginBottom: 12 }}>
            {media.filter((m) => m.kind !== 'audio').map((m) => (
              <a key={m.id} className="tile" href={m.url ?? undefined} target="_blank" rel="noreferrer">
                {m.kind === 'video' ? <video src={m.url ?? undefined} muted playsInline preload="metadata" /> : m.kind === 'photo' ? <img src={m.url ?? undefined} alt="" /> : <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>📄</div>}
              </a>
            ))}
          </div>
        )}
        {media.filter((m) => m.kind === 'audio').map((m) => <audio key={m.id} controls src={m.url ?? undefined} style={{ width: '100%', marginBottom: 8 }} />)}
        <div className="rp-body-text" style={{ whiteSpace: 'pre-wrap' }}>{s.body}</div>
        <p className="rp-meta" style={{ marginTop: 12 }}>
          {[s.locality, s.incident_location].filter(Boolean).join(' · ')}{s.incident_at ? ` · ${fmtDate(s.incident_at, lang)}` : ''}
        </p>
      </section>

      {hist.length > 0 && (
        <section className="rp-section rp-card" aria-label="History">
          <ul className="rp-timeline">
            {hist.map((h) => (
              <li key={h.id}><b>{t(`s_${h.to_status}` as never) ?? h.to_status}</b> <span className="rp-meta">· {fmtDate(h.created_at, lang)}</span>
                {h.note && <div className="rp-meta">{h.note}</div>}</li>
            ))}
          </ul>
        </section>
      )}
      {s.status === 'draft' && (
        <div className="rp-row rp-section">
          <button className="rp-btn ghost" onClick={del}>{t('remove')}</button>
          <Link to={`/reporter/submit/${s.id}`} className="rp-btn primary grow">{t('edit')}</Link>
        </div>
      )}
    </>
  );
}
