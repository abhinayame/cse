/**
 * News Reels manager: vertical presenter videos with the two-line headline strip shown in the app
 * (short white line + bold red line), series / episode numbering, draft or published.
 * Files go to the public `media` bucket under reels/ (staff upload policy, 0002).
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { DISTRICTS } from '@data/locations';
import { PageHead } from '../components/Layout';
import { useStore } from '../lib/store';
import { CATS, cap, district } from '../lib/format';
import { mediaUrl } from '../lib/db';
import { supabase } from '../lib/supabase';
import { db, ok, when } from '../newsroom/api';
import { NeedsBackend, Status } from '../newsroom/ui';

interface Reel {
  id: string; video_path: string; poster_path: string; district_id: string | null; category_id: string | null; duration_sec: number;
  caption: Record<string, string>; headline_top: Record<string, string>; headline: Record<string, string>;
  series: string | null; episode: number | null; episode_total: number | null; status: 'draft' | 'published'; published_at: string; likes: number; shares: number;
}
const blank = (d: string): Partial<Reel> => ({ district_id: d, category_id: 'politics', caption: { te: '', en: '' }, headline_top: { te: '', en: '' }, headline: { te: '', en: '' }, series: null, episode: null, episode_total: null, status: 'draft' });

export default function Reels() {
  if (!supabase) return <NeedsBackend kicker="Video" title="News Reels" />;
  return <Manager />;
}

function Manager() {
  const { toast, session } = useStore();
  const [rows, setRows] = useState<Reel[] | null>(null);
  const [edit, setEdit] = useState<Partial<Reel> | null>(null);
  const load = useCallback(async () => {
    try { setRows(ok(await db().from('videos').select('*').order('published_at', { ascending: false }).limit(200)) as Reel[]); } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  const scoped = (rows ?? []).filter((r) => !session.districts.length || !r.district_id || session.districts.includes(r.district_id));
  const remove = async (r: Reel) => {
    if (!confirm('Delete this reel?')) return;
    try { ok(await db().from('videos').delete().eq('id', r.id)); toast('Reel deleted'); load(); } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };
  return (
    <>
      <PageHead kicker="Video" title="News Reels">
        <button className="btn primary" onClick={() => setEdit(blank(session.districts[0] ?? 'hyd'))}>＋ New reel</button>
      </PageHead>
      <div className="banner">Shorter, sharper video stories. Shoot vertical (9:16), 30–90 seconds. The two headline lines appear over the top of the video in the app: a short white line and a bold red line.</div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        {rows === null ? <div className="card empty">Loading…</div> : scoped.length === 0 ? <div className="card empty">No reels yet</div> : scoped.map((r) => (
          <div key={r.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ position: 'relative', aspectRatio: '9 / 14', background: '#000' }}>
              <img src={mediaUrl(r.poster_path)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
              <ReelStrip top={r.headline_top?.te || r.headline_top?.en} main={r.headline?.te || r.headline?.en} />
              {r.episode && <span className="pill" style={{ position: 'absolute', left: 8, bottom: 8 }}>EP {r.episode}{r.episode_total ? `/${r.episode_total}` : ''}</span>}
            </div>
            <div style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}><Status s={r.status === 'published' ? 'published' : 'draft'} /><span className="faint" style={{ fontSize: 12 }}>{r.duration_sec}s</span></div>
              <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>{r.series ? `${r.series} · ` : ''}{cap(r.category_id ?? '')} · {district(r.district_id ?? '')}</div>
              <div className="faint" style={{ fontSize: 12 }}>{when(r.published_at)} · ♥ {r.likes} · ↗ {r.shares}</div>
              <div className="row" style={{ marginTop: 8 }}><button className="btn sm ghost" onClick={() => setEdit(r)}>Edit</button><button className="btn sm ghost" onClick={() => remove(r)}>Delete</button></div>
            </div>
          </div>
        ))}
      </div>
      {edit && <Editor reel={edit} districts={session.districts} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}

function ReelStrip({ top, main }: { top?: string; main?: string }) {
  if (!main) return null;
  return (
    <div style={{ position: 'absolute', top: 14, left: 8, right: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {top && <div className="te-head" style={{ background: '#fff', color: '#0A0A0A', padding: '1px 8px', borderRadius: '4px 4px 0 0', fontSize: 12, lineHeight: 1.6 }}>{top}</div>}
      <div className="te-head" style={{ background: 'var(--red)', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 14, lineHeight: 1.6, textAlign: 'center' }}>{main}</div>
    </div>
  );
}

/** Grab a frame (at ~1 s) from a local video file as a JPEG poster. */
function posterFrom(file: File): Promise<{ blob: Blob; duration: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'auto'; v.muted = true; v.src = URL.createObjectURL(file);
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
    v.onseeked = () => {
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d')!.drawImage(v, 0, 0);
      c.toBlob((b) => (b ? resolve({ blob: b, duration: Math.round(v.duration) }) : reject(new Error('Could not read a frame'))), 'image/jpeg', 0.85);
    };
    v.onerror = () => reject(new Error('This video format cannot be read in the browser; upload a poster image instead'));
  });
}

function Editor({ reel, districts, onClose, onSaved }: { reel: Partial<Reel>; districts: string[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useStore();
  const [f, setF] = useState<Partial<Reel>>(reel);
  const [video, setVideo] = useState<File | null>(null);
  const [poster, setPoster] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(reel.poster_path ? mediaUrl(reel.poster_path) : null);
  const [busy, setBusy] = useState<string | null>(null);
  const posterInput = useRef<HTMLInputElement>(null);
  const loc = (k: 'caption' | 'headline_top' | 'headline', lang: 'te' | 'en', v: string) => setF({ ...f, [k]: { ...(f[k] ?? {}), [lang]: v } });
  const pickVideo = async (file: File) => {
    if (file.size > 200 * 1024 * 1024) return toast('⚠ Keep reels under 200 MB (export at 1080×1920, H.264)');
    setVideo(file);
    try { const p = await posterFrom(file); setPoster(p.blob); setPreview(URL.createObjectURL(p.blob)); setF((x) => ({ ...x, duration_sec: p.duration })); }
    catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };
  const upload = async (b: Blob, folder: string, ext: string, type: string) => {
    const path = `reels/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    ok(await db().storage.from('media').upload(path, b, { contentType: type, upsert: false }));
    return path;
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.id && !video) return toast('⚠ Choose the video file');
    if (!(f.headline?.te || f.headline?.en)) return toast('⚠ Add the red headline line');
    try {
      const row: Record<string, unknown> = {
        district_id: f.district_id, category_id: f.category_id, caption: { en: f.caption?.en || f.headline?.en || f.headline?.te || '', te: f.caption?.te || f.headline?.te || '' },
        headline_top: f.headline_top, headline: f.headline, series: f.series || null, episode: f.episode || null, episode_total: f.episode_total || null,
        status: f.status, duration_sec: f.duration_sec || 30,
      };
      if (video) { setBusy('Uploading video…'); row.video_path = await upload(video, 'video', (video.name.split('.').pop() || 'mp4').toLowerCase(), video.type || 'video/mp4'); }
      if (poster) { setBusy('Uploading poster…'); row.poster_path = await upload(poster, 'poster', 'jpg', poster.type || 'image/jpeg'); }
      setBusy('Saving…');
      if (f.id) ok(await db().from('videos').update(row).eq('id', f.id));
      else ok(await db().from('videos').insert({ ...row, published_at: new Date().toISOString() }));
      toast(f.status === 'published' ? 'Reel published' : 'Reel saved as draft'); onSaved();
    } catch (e2) { toast(`⚠ ${(e2 as Error).message}`); } finally { setBusy(null); }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal grid" style={{ gap: 10, maxWidth: 760, maxHeight: '92vh', overflow: 'auto' }} role="dialog" aria-modal="true" aria-label="Reel" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 style={{ fontSize: 20 }}>{f.id ? 'Edit reel' : 'New reel'}</h2>
        <div className="grid" style={{ gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'start' }}>
          <div>
            <div style={{ position: 'relative', aspectRatio: '9 / 16', background: '#111', borderRadius: 14, overflow: 'hidden' }}>
              {preview && <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              <ReelStrip top={f.headline_top?.te || f.headline_top?.en} main={f.headline?.te || f.headline?.en} />
            </div>
            <label className="btn ghost sm" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>{video ? '✓ ' + video.name.slice(0, 18) : f.id ? 'Replace video' : 'Choose video'}
              <input type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={(e) => e.target.files?.[0] && pickVideo(e.target.files[0])} /></label>
            <button type="button" className="btn ghost sm" style={{ marginTop: 6, width: '100%', justifyContent: 'center' }} onClick={() => posterInput.current?.click()}>Upload poster instead</button>
            <input ref={posterInput} type="file" accept="image/*" hidden onChange={(e) => { const p = e.target.files?.[0]; if (p) { setPoster(p); setPreview(URL.createObjectURL(p)); } }} />
          </div>
          <div className="grid" style={{ gap: 8 }}>
            <div className="field"><label htmlFor="rl-tt">White line (Telugu) — short</label><input id="rl-tt" className="input te-head" maxLength={40} value={f.headline_top?.te ?? ''} onChange={(e) => loc('headline_top', 'te', e.target.value)} placeholder="రేపటి నుంచే" /></div>
            <div className="field"><label htmlFor="rl-mt">Red line (Telugu) — the headline</label><input id="rl-mt" className="input te-head" maxLength={60} value={f.headline?.te ?? ''} onChange={(e) => loc('headline', 'te', e.target.value)} placeholder="కొత్త రిజిస్ట్రేషన్ ఛార్జీలు!" /></div>
            <div className="row">
              <div className="field" style={{ flex: 1 }}><label htmlFor="rl-te">White line (English)</label><input id="rl-te" className="input" maxLength={40} value={f.headline_top?.en ?? ''} onChange={(e) => loc('headline_top', 'en', e.target.value)} /></div>
              <div className="field" style={{ flex: 1 }}><label htmlFor="rl-me">Red line (English)</label><input id="rl-me" className="input" maxLength={60} value={f.headline?.en ?? ''} onChange={(e) => loc('headline', 'en', e.target.value)} /></div>
            </div>
            <div className="field"><label htmlFor="rl-ct">Caption (Telugu)</label><input id="rl-ct" className="input te-body" value={f.caption?.te ?? ''} onChange={(e) => loc('caption', 'te', e.target.value)} /></div>
            <div className="field"><label htmlFor="rl-ce">Caption (English)</label><input id="rl-ce" className="input" value={f.caption?.en ?? ''} onChange={(e) => loc('caption', 'en', e.target.value)} /></div>
            <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field"><label htmlFor="rl-c">Category</label><select id="rl-c" className="input" value={f.category_id ?? ''} onChange={(e) => setF({ ...f, category_id: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</select></div>
              <div className="field"><label htmlFor="rl-d">District</label><select id="rl-d" className="input" value={f.district_id ?? ''} onChange={(e) => setF({ ...f, district_id: e.target.value })}>{DISTRICTS.filter((d) => !districts.length || districts.includes(d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div className="field"><label htmlFor="rl-s">Series</label><input id="rl-s" className="input" style={{ width: 140 }} value={f.series ?? ''} onChange={(e) => setF({ ...f, series: e.target.value })} placeholder="Explainers" /></div>
              <div className="field"><label htmlFor="rl-ep">EP</label><input id="rl-ep" className="input" style={{ width: 70 }} type="number" min={1} value={f.episode ?? ''} onChange={(e) => setF({ ...f, episode: e.target.value ? Number(e.target.value) : null })} /></div>
              <div className="field"><label htmlFor="rl-of">of</label><input id="rl-of" className="input" style={{ width: 70 }} type="number" min={1} value={f.episode_total ?? ''} onChange={(e) => setF({ ...f, episode_total: e.target.value ? Number(e.target.value) : null })} /></div>
            </div>
            <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={f.status === 'published'} onChange={(e) => setF({ ...f, status: e.target.checked ? 'published' : 'draft' })} />Publish now (otherwise saved as draft)</label>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {busy && <span className="faint">{busy}</span>}
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!!busy}>{f.status === 'published' ? 'Publish' : 'Save draft'}</button>
        </div>
      </form>
    </div>
  );
}
