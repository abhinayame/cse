import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DISTRICTS, MANDALS } from '@data/locations';
import { CATS, wordCount } from '../../lib/format';
import {
  addMediaRow, db, getSubmission, listMedia, removeMedia, safeName, saveSubmission, sendForReview, signedUrl, uploadWithProgress,
  type Assignment, type Media, type Submission,
} from '../api';
import { catLabel, rupees, useLang, useT } from '../i18n';
import { useReporter } from '../ReporterApp';
import { ErrorNote, useToast } from '../ui';

const TYPES = ['text_news', 'photo_story', 'video_story', 'voice_report', 'detailed_report', 'civic_issue', 'education', 'government', 'event', 'community', 'business_jobs'] as const;
const TYPE_ICON: Record<string, string> = { text_news: '📝', photo_story: '📷', video_story: '🎥', voice_report: '🎙️', detailed_report: '📰', civic_issue: '🚧', education: '🎓', government: '🏛️', event: '📅', community: '🤝', business_jobs: '💼' };
const TYPE_CAT: Record<string, string> = { education: 'education', business_jobs: 'jobs', government: 'politics' };
const MAX_BYTES = 100 * 1024 * 1024;

type Upload = { key: string; file: File; pct: number; state: 'uploading' | 'error'; error?: string };
type Form = Pick<Submission, 'headline' | 'body' | 'summary' | 'submission_type' | 'category_id' | 'lang' | 'district_id' | 'mandal_id' | 'locality' | 'incident_location' | 'incident_at' | 'source_notes' | 'assignment_id' | 'rights_confirmed'>;

const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export default function Submit() {
  const t = useT(); const lang = useLang(); const toast = useToast(); const nav = useNavigate();
  const { id: routeId } = useParams();
  const [qs] = useSearchParams();
  const { dash, reload, userId } = useReporter();
  const p = dash.profile!;
  const [id, setId] = useState<string | null>(routeId ?? null);
  const [f, setF] = useState<Form>({
    headline: '', body: '', summary: '', submission_type: 'text_news', category_id: p.interests[0] ?? 'politics', lang: p.preferred_language === 'en' ? 'en' : p.preferred_language,
    district_id: p.district_id, mandal_id: p.mandal_id, locality: p.locality, incident_location: '', incident_at: null, source_notes: '', assignment_id: null, rights_confirmed: false,
  });
  const [status, setStatus] = useState('draft');
  const [correction, setCorrection] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [media, setMedia] = useState<(Media & { url?: string | null })[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState<'save' | 'send' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!routeId);
  const fileRef = useRef<HTMLInputElement>(null);
  const canSubmit = ['verified', 'active'].includes(p.status);

  useEffect(() => {
    if (!routeId) return;
    (async () => {
      try {
        const s = await getSubmission(routeId);
        setStatus(s.status); setCorrection(s.correction_note);
        setF({ headline: s.headline, body: s.body, summary: s.summary ?? '', submission_type: s.submission_type, category_id: s.category_id, lang: s.lang, district_id: s.district_id,
          mandal_id: s.mandal_id, locality: s.locality, incident_location: s.incident_location ?? '', incident_at: s.incident_at, source_notes: s.source_notes ?? '', assignment_id: s.assignment_id, rights_confirmed: s.rights_confirmed });
        await loadMedia(routeId);
      } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
    })();
  }, [routeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const aid = qs.get('assignment') ?? f.assignment_id;
    if (!aid) return;
    db().from('reporter_assignments').select('*').eq('id', aid).single().then(({ data }) => {
      if (!data) return;
      setAssignment(data as Assignment);
      if (!routeId) setF((x) => ({ ...x, assignment_id: data.id, district_id: data.district_id, mandal_id: data.mandal_id ?? x.mandal_id, locality: data.locality ?? x.locality }));
    });
  }, [qs, f.assignment_id, routeId]);

  const loadMedia = async (sid: string) => {
    const rows = await listMedia(sid);
    setMedia(await Promise.all(rows.map(async (m) => ({ ...m, url: await signedUrl(m.bucket, m.storage_path) }))));
  };

  const editable = status === 'draft' || status === 'correction_required';
  const payload = () => ({ ...f, summary: f.summary || null, source_notes: f.source_notes || null, incident_location: f.incident_location || null });

  /** Makes sure a draft row exists (media rows need its id). */
  const draft = useRef<Promise<string> | null>(null);
  const ensureDraft = () => {
    if (id) return Promise.resolve(id);
    draft.current ??= saveSubmission(null, payload()).then((s) => { setId(s.id); window.history.replaceState(null, '', `/reporter/submit/${s.id}`); return s.id; })
      .catch((e) => { draft.current = null; throw e; });
    return draft.current;
  };

  const save = async () => {
    setBusy('save'); setErr(null);
    try { const sid = await ensureDraft(); await saveSubmission(sid, payload()); toast(t('draftSaved')); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  const send = async () => {
    setBusy('send'); setErr(null);
    try {
      const sid = await ensureDraft();
      await saveSubmission(sid, payload());
      const s = await sendForReview(sid);
      toast(`${t('submittedOk')} · ${s.code ?? ''}`);
      await reload();
      nav(`/reporter/submissions/${sid}`, { replace: true });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  const upload = async (file: File, key = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, durationSec?: number) => {
    if (file.size > MAX_BYTES) { setErr(`${file.name}: max 100 MB`); return; }
    setUploads((u) => [...u.filter((x) => x.key !== key), { key, file, pct: 0, state: 'uploading' }]);
    try {
      const sid = await ensureDraft();
      const path = `${userId}/${sid}/${key}-${safeName(file.name)}`;
      await uploadWithProgress('submissions', path, file, (pct) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, pct } : x))));
      const kind = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : file.type.startsWith('image') ? 'photo' : 'document';
      await addMediaRow({ submission_id: sid, kind, bucket: 'submissions', storage_path: path, mime_type: file.type || null, size_bytes: file.size, duration_sec: durationSec ?? null });
      setUploads((u) => u.filter((x) => x.key !== key));
      await loadMedia(sid);
    } catch (e) {
      setUploads((u) => u.map((x) => (x.key === key ? { ...x, state: 'error', error: (e as Error).message } : x)));
    }
  };

  const drop = async (m: Media) => {
    try { await removeMedia(m); setMedia((x) => x.filter((y) => y.id !== m.id)); } catch (e) { setErr((e as Error).message); }
  };

  if (loading) return <p className="rp-empty">…</p>;
  if (!editable) return (
    <div className="rp-section rp-card"><p>{t('s_' + status as never)}</p><button className="rp-btn block" onClick={() => nav(`/reporter/submissions/${id}`)}>{t('timeline')}</button></div>
  );

  const words = wordCount(f.body);
  const mandals = MANDALS.filter((m) => m.districtId === f.district_id);
  const photosVideos = media.filter((m) => m.kind === 'photo' || m.kind === 'video' || m.kind === 'document');
  const audio = media.filter((m) => m.kind === 'audio');

  return (
    <>
      <h1 className="rp-section">{routeId ? t('editSubmission') : t('newSubmission')}</h1>
      {!canSubmit && <div className="rp-banner warn rp-section">{t(`stBanner_${p.status}` as never)}</div>}
      {correction && <div className="rp-banner warn rp-section"><div><b>{t('editorNote')}:</b> {correction}</div></div>}
      {assignment && (
        <div className="rp-banner info rp-section"><div><b>{t('forAssignment')} {assignment.code}:</b> {assignment.title}
          {assignment.special_amount_paise > 0 && <> · {t('special')} {rupees(assignment.special_amount_paise)}</>}</div></div>
      )}

      <section className="rp-section" aria-label={t('type')}>
        <div className="rp-label" style={{ marginBottom: 8 }}>{t('type')}</div>
        <div className="rp-chips">
          {TYPES.map((ty) => (
            <button key={ty} type="button" aria-pressed={f.submission_type === ty} className={`rp-chip ${f.submission_type === ty ? 'on' : ''}`}
              onClick={() => setF({ ...f, submission_type: ty, category_id: TYPE_CAT[ty] ?? f.category_id })}>{TYPE_ICON[ty]} {t(`t_${ty}` as never)}</button>
          ))}
        </div>
      </section>

      <section className="rp-section rp-card">
        <div className="rp-field"><label htmlFor="s-h">{t('headline')}</label>
          <input id="s-h" className="rp-input" maxLength={160} placeholder={t('headlineHint')} value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} />
          <span className="rp-hint">{f.headline.length}/160</span></div>
        <div className="rp-field"><label htmlFor="s-b">{t('description')}</label>
          <textarea id="s-b" className="rp-body-text" style={{ minHeight: 180 }} placeholder={t('descHint')} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          <span className="rp-hint">{words} {t('words')}</span></div>
        <div className="rp-field"><label htmlFor="s-s">{t('summary')}</label>
          <textarea id="s-s" style={{ minHeight: 80 }} maxLength={700} value={f.summary ?? ''} onChange={(e) => setF({ ...f, summary: e.target.value })} /></div>
        <div className="rp-row" style={{ alignItems: 'flex-start' }}>
          <div className="rp-field grow"><label htmlFor="s-c">{t('category')}</label>
            <select id="s-c" value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{catLabel(lang, c)}</option>)}</select></div>
          <div className="rp-field grow"><label htmlFor="s-l">{t('newsLanguage')}</label>
            <select id="s-l" value={f.lang} onChange={(e) => setF({ ...f, lang: e.target.value })}><option value="te">తెలుగు</option><option value="en">English</option><option value="hi">हिन्दी</option></select></div>
        </div>
      </section>

      <section className="rp-section rp-card" aria-label={t('yourArea')}>
        <div className="rp-row" style={{ alignItems: 'flex-start' }}>
          <div className="rp-field grow"><label htmlFor="s-d">{t('district')}</label>
            <select id="s-d" value={f.district_id} onChange={(e) => setF({ ...f, district_id: e.target.value, mandal_id: MANDALS.find((m) => m.districtId === e.target.value)?.id ?? null })}>
              {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{lang === 'te' ? d.nameTe : d.name}</option>)}</select></div>
          <div className="rp-field grow"><label htmlFor="s-m">{t('mandal')}</label>
            <select id="s-m" value={f.mandal_id ?? ''} onChange={(e) => setF({ ...f, mandal_id: e.target.value || null })}>
              {mandals.map((m) => <option key={m.id} value={m.id}>{lang === 'te' ? m.nameTe : m.name}</option>)}</select></div>
        </div>
        <div className="rp-field"><label htmlFor="s-loc">{t('locality')}</label><input id="s-loc" className="rp-input" value={f.locality ?? ''} onChange={(e) => setF({ ...f, locality: e.target.value })} /></div>
        <div className="rp-field"><label htmlFor="s-il">{t('incidentLocation')}</label>
          <div className="rp-row"><input id="s-il" className="rp-input grow" value={f.incident_location ?? ''} onChange={(e) => setF({ ...f, incident_location: e.target.value })} />
            <button type="button" className="rp-btn ghost sm" aria-label="Use my location" onClick={() => navigator.geolocation?.getCurrentPosition(
              (pos) => setF((x) => ({ ...x, incident_location: `${x.incident_location ? x.incident_location + ' · ' : ''}${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` })),
              () => setErr('Location permission denied'))}>📍</button></div></div>
        <div className="rp-field"><label htmlFor="s-at">{t('incidentAt')}</label>
          <input id="s-at" type="datetime-local" className="rp-input" max={toLocalInput(new Date().toISOString())} value={toLocalInput(f.incident_at)}
            onChange={(e) => setF({ ...f, incident_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
      </section>

      <section className="rp-section rp-card" aria-label={t('media')}>
        <h2 style={{ marginBottom: 10 }}>{t('media')}</h2>
        <div className="rp-media">
          {photosVideos.map((m) => (
            <div key={m.id} className="tile">
              {m.kind === 'video' ? <video src={m.url ?? undefined} muted playsInline preload="metadata" /> : m.kind === 'photo' ? <img src={m.url ?? undefined} alt="" /> : <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>📄</div>}
              <span className="state">✓</span>
              <button className="x" aria-label={t('remove')} onClick={() => drop(m)}>×</button>
            </div>
          ))}
          {uploads.filter((u) => !u.file.type.startsWith('audio')).map((u) => (
            <div key={u.key} className="tile">
              {u.file.type.startsWith('image') && <img src={URL.createObjectURL(u.file)} alt="" style={{ opacity: 0.6 }} />}
              <span className="state">{u.state === 'error' ? '!' : `${u.pct}%`}</span>
              {u.state === 'error'
                ? <button className="rp-btn sm primary" style={{ position: 'absolute', bottom: 6, left: 6, right: 6 }} title={u.error} onClick={() => upload(u.file, u.key)}>{t('retry')}</button>
                : <div className="bar"><i style={{ width: `${u.pct}%` }} /></div>}
            </div>
          ))}
          <button type="button" className="rp-add-tile" onClick={() => fileRef.current?.click()}>＋<br />{t('addMedia')}</button>
        </div>
        <input ref={fileRef} type="file" hidden multiple accept="image/*,video/*,application/pdf" onChange={(e) => { Array.from(e.target.files ?? []).forEach((file) => upload(file)); e.target.value = ''; }} />
        {uploads.some((u) => u.state === 'error') && <p className="rp-hint" style={{ color: 'var(--red)' }}>{uploads.find((u) => u.state === 'error')?.error}</p>}

        <div className="rp-label" style={{ margin: '16px 0 8px' }}>{t('voice')}</div>
        {audio.map((m) => (
          <div key={m.id} className="rp-row" style={{ marginBottom: 8 }}>
            <audio controls src={m.url ?? undefined} style={{ flex: 1, minWidth: 0 }} />
            <button className="rp-btn ghost sm" onClick={() => drop(m)}>{t('removeRec')}</button>
          </div>
        ))}
        {uploads.filter((u) => u.file.type.startsWith('audio')).map((u) => (
          <div key={u.key} className="rp-progress rp-light" style={{ background: 'var(--surface-alt)' }}><i style={{ width: `${u.pct}%` }} /></div>
        ))}
        <VoiceRecorder onDone={(blob, secs) => upload(new File([blob], `voice.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`, { type: blob.type }), undefined, secs)} />
      </section>

      <section className="rp-section rp-card">
        <div className="rp-field"><label htmlFor="s-src">🔒 {t('sources')}</label>
          <textarea id="s-src" value={f.source_notes ?? ''} onChange={(e) => setF({ ...f, source_notes: e.target.value })} />
          <span className="rp-hint">{t('sourcesHint')}</span></div>
        <label className="rp-check"><input type="checkbox" checked={f.rights_confirmed} onChange={(e) => setF({ ...f, rights_confirmed: e.target.checked })} />{t('rights')}</label>
      </section>

      <div className="rp-section"><ErrorNote error={err} /></div>
      <div className="rp-row" style={{ marginTop: 4 }}>
        <button className="rp-btn ghost" disabled={!!busy || uploads.some((u) => u.state === 'uploading')} onClick={save}>{busy === 'save' ? t('saving') : t('saveDraft')}</button>
        <button className="rp-btn primary grow" disabled={!!busy || !canSubmit || !f.rights_confirmed || f.headline.trim().length < 10 || f.body.trim().length < 40 || uploads.some((u) => u.state === 'uploading')} onClick={send}>
          {busy === 'send' ? t('saving') : t('sendForReview')}</button>
      </div>
    </>
  );
}

function VoiceRecorder({ onDone }: { onDone: (b: Blob, secs: number) => void }) {
  const t = useT();
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(0);
  useEffect(() => {
    if (!rec) return;
    const h = setInterval(() => setSecs(Math.round((Date.now() - started.current) / 1000)), 500);
    return () => clearInterval(h);
  }, [rec]);
  if (typeof MediaRecorder === 'undefined') return null;
  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => { stream.getTracks().forEach((x) => x.stop()); onDone(new Blob(chunks, { type: r.mimeType || 'audio/webm' }), Math.round((Date.now() - started.current) / 1000)); setRec(null); };
      started.current = Date.now(); setSecs(0); r.start(); setRec(r);
    } catch { setErr('Microphone permission denied'); }
  };
  return (
    <div className="rp-row">
      {rec ? <button type="button" className="rp-btn primary" onClick={() => rec.stop()}>■ {t('stopRec')} · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</button>
        : <button type="button" className="rp-btn ghost" onClick={start}>🎙️ {t('record')}</button>}
      {err && <span className="rp-hint">{err}</span>}
    </div>
  );
}
