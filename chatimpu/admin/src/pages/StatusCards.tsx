/**
 * Daily WhatsApp status: schedule shareable 9:16 cards (good morning / night, proverbs, quotes,
 * devotional, motivation, festival art, memes) for each day. Readers share them as images.
 * Only post text and images you wrote, own, or that are public domain (e.g. traditional proverbs).
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PageHead } from '../components/Layout';
import { useStore } from '../lib/store';
import { mediaUrl } from '../lib/db';
import { supabase } from '../lib/supabase';
import { db, ok } from '../newsroom/api';
import { Kpi, NeedsBackend, Status } from '../newsroom/ui';

// Same presets as app/src/data/status.ts
const BG: Record<string, [string, string]> = {
  saffron: ['#F7971E', '#C0392B'], dawn: ['#FF9A5A', '#7A1F3D'], night: ['#0F2027', '#203A43'], green: ['#0B6E4F', '#08403A'],
  navy: ['#2E3192', '#0B0C3B'], red: ['#ED1C24', '#6E0A0E'], purple: ['#41295A', '#1C0C2E'],
};
const KINDS: [string, string, string][] = [
  ['good_morning', 'Good morning', 'శుభోదయం'], ['good_night', 'Good night', 'శుభరాత్రి'], ['proverb', 'Proverb', 'సామెత'], ['quote', 'Quote', 'సూక్తి'],
  ['devotional', 'Devotional', 'భక్తి'], ['motivation', 'Motivation', 'ప్రేరణ'], ['festival', 'Festival', 'పండుగ'], ['meme', 'Meme', 'మీమ్స్'],
];
interface Card { id: string; kind: string; lang: string; text: string; attribution: string | null; background: string; image_path: string | null; publish_on: string; status: string; shares: number }
const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);

export default function StatusCards() {
  if (!supabase) return <NeedsBackend kicker="Engagement" title="WhatsApp Status" />;
  return <Planner />;
}

function Planner() {
  const { toast } = useStore();
  const [day, setDay] = useState(istToday());
  const [rows, setRows] = useState<Card[] | null>(null);
  const [week, setWeek] = useState<Record<string, number>>({});
  const [edit, setEdit] = useState<Partial<Card> | null>(null);
  const load = useCallback(async () => {
    try {
      setRows(ok(await db().from('status_cards').select('*').eq('publish_on', day).order('created_at')) as Card[]);
      const w = ok(await db().from('status_cards').select('publish_on').gte('publish_on', istToday()).lte('publish_on', addDays(istToday(), 6)).eq('status', 'published')) as { publish_on: string }[];
      setWeek(w.reduce((a, r) => ({ ...a, [r.publish_on]: (a[r.publish_on] ?? 0) + 1 }), {} as Record<string, number>));
    } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  }, [day, toast]);
  useEffect(() => { load(); }, [load]);
  const copyToTomorrow = async (c: Card) => {
    try { ok(await db().from('status_cards').insert({ kind: c.kind, lang: c.lang, text: c.text, attribution: c.attribution, background: c.background, image_path: c.image_path, publish_on: addDays(c.publish_on, 1), status: 'published' })); toast('Copied to the next day'); load(); }
    catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };
  const remove = async (c: Card) => { if (!confirm('Delete this card?')) return; try { ok(await db().from('status_cards').delete().eq('id', c.id)); load(); } catch (e) { toast(`⚠ ${(e as Error).message}`); } };
  const shares = (rows ?? []).reduce((a, r) => a + r.shares, 0);
  return (
    <>
      <PageHead kicker="Engagement" title="WhatsApp Status">
        <input type="date" className="input" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day" />
        <button className="btn primary" onClick={() => setEdit({ kind: 'good_morning', lang: 'te', text: '', background: 'saffron', publish_on: day, status: 'published' })}>＋ New card</button>
      </PageHead>
      <div className="banner">Cards for each day appear in the app (Explore → Today's WhatsApp Status) and are shared as 9:16 images with the Chatimpu logo. Post only your own text, licensed images, or public-domain material such as traditional proverbs.</div>
      <div className="kpis">
        <Kpi label={`Cards on ${day}`} value={rows?.length ?? '…'} />
        <Kpi label="Shares that day" value={shares} />
        {Array.from({ length: 7 }, (_, i) => addDays(istToday(), i)).map((d) => (
          <button key={d} className="kpi" style={{ textAlign: 'left', cursor: 'pointer', outline: d === day ? '2px solid var(--red)' : undefined }} onClick={() => setDay(d)}>
            <div className="label">{new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
            <div className="value" style={{ color: (week[d] ?? 0) === 0 ? 'var(--red-deep)' : undefined }}>{week[d] ?? 0}</div><div className="sub">published</div>
          </button>
        ))}
      </div>
      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14 }}>
        {rows === null ? <div className="card empty">Loading…</div> : rows.length === 0 ? <div className="card empty">Nothing scheduled for this day</div> : rows.map((c) => (
          <div key={c.id} className="card" style={{ padding: 10 }}>
            <Preview c={c} width={150} />
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}><Status s={c.status === 'published' ? 'published' : 'draft'} /><span className="faint" style={{ fontSize: 12 }}>↗ {c.shares}</span></div>
            <div className="row" style={{ marginTop: 6, gap: 4, flexWrap: 'wrap' }}>
              <button className="btn sm ghost" onClick={() => setEdit(c)}>Edit</button>
              <button className="btn sm ghost" onClick={() => copyToTomorrow(c)}>+1 day</button>
              <button className="btn sm ghost" onClick={() => remove(c)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {edit && <Editor card={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}

function Preview({ c, width, imageUrl }: { c: Partial<Card>; width: number; imageUrl?: string | null }) {
  const [a, b] = BG[c.background ?? 'saffron'] ?? BG.saffron;
  const img = imageUrl ?? (c.image_path ? mediaUrl(c.image_path) : null);
  const s = width / 360; const te = c.lang === 'te';
  const label = KINDS.find((k) => k[0] === c.kind);
  return (
    <div style={{ width, aspectRatio: '9 / 16', borderRadius: 14, overflow: 'hidden', position: 'relative', background: img ? `center/cover url(${img})` : `linear-gradient(135deg, ${a}, ${b})`, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 * s, boxSizing: 'border-box' }}>
      <div style={{ position: 'absolute', top: 18 * s, left: 0, right: 0, textAlign: 'center' }}>
        <span className="te-head" style={{ background: 'rgba(255,255,255,.92)', color: '#2E3192', borderRadius: 20, padding: `${2 * s}px ${10 * s}px`, fontSize: 14 * s }}>చాటింపు</span>
      </div>
      {!(c.kind === 'meme' && img) && <>
        <div style={{ textAlign: 'center', fontSize: 11 * s, letterSpacing: te ? 0 : 2 * s, opacity: 0.85, fontWeight: 700, marginBottom: 10 * s }}>{te ? label?.[2] : label?.[1].toUpperCase()}</div>
        <div className={te ? 'te-head' : ''} style={{ textAlign: 'center', fontSize: ((c.text?.length ?? 0) > 120 ? 22 : 28) * s, lineHeight: te ? 1.7 : 1.3, textShadow: '0 1px 6px rgba(0,0,0,.35)', fontFamily: te ? undefined : 'var(--serif)' }}>{c.text || '…'}</div>
        {c.attribution && <div style={{ textAlign: 'center', marginTop: 12 * s, fontSize: 13 * s, opacity: 0.85 }}>— {c.attribution}</div>}
      </>}
      <div style={{ position: 'absolute', bottom: 14 * s, left: 0, right: 0, textAlign: 'center', fontSize: 11 * s, opacity: 0.9 }}>www.chatimpu.com</div>
    </div>
  );
}

function Editor({ card, onClose, onSaved }: { card: Partial<Card>; onClose: () => void; onSaved: () => void }) {
  const { toast } = useStore();
  const [f, setF] = useState(card);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = file ? URL.createObjectURL(file) : null;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      let image_path = f.image_path ?? null;
      if (file) {
        image_path = `status/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`;
        ok(await db().storage.from('media').upload(image_path, file, { contentType: file.type || 'image/jpeg', upsert: false }));
      }
      const row = { kind: f.kind, lang: f.lang, text: (f.text ?? '').trim() || (f.kind === 'meme' ? ' ' : ''), attribution: f.attribution?.trim() || null, background: f.background, image_path, publish_on: f.publish_on, status: f.status };
      if (f.id) ok(await db().from('status_cards').update(row).eq('id', f.id)); else ok(await db().from('status_cards').insert(row));
      toast('Card saved'); onSaved();
    } catch (e2) { toast(`⚠ ${(e2 as Error).message}`); } finally { setBusy(false); }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal grid" style={{ gap: 10, maxWidth: 720, maxHeight: '92vh', overflow: 'auto' }} role="dialog" aria-modal="true" aria-label="Status card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 style={{ fontSize: 20 }}>{f.id ? 'Edit card' : 'New status card'}</h2>
        <div className="grid" style={{ gridTemplateColumns: '210px 1fr', gap: 16, alignItems: 'start' }}>
          <Preview c={f} width={200} imageUrl={preview} />
          <div className="grid" style={{ gap: 8 }}>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>{KINDS.map(([k, en, te]) => <button type="button" key={k} className={`btn sm ${f.kind === k ? 'dark' : 'ghost'}`} onClick={() => setF({ ...f, kind: k })}>{en} · {te}</button>)}</div>
            <div className="row"><label className="row" style={{ gap: 6 }}><input type="radio" checked={f.lang === 'te'} onChange={() => setF({ ...f, lang: 'te' })} />తెలుగు</label><label className="row" style={{ gap: 6 }}><input type="radio" checked={f.lang === 'en'} onChange={() => setF({ ...f, lang: 'en' })} />English</label></div>
            <div className="field"><label htmlFor="st-t">Text</label><textarea id="st-t" className={`input ${f.lang === 'te' ? 'te-body' : ''}`} rows={4} maxLength={400} value={f.text ?? ''} onChange={(e) => setF({ ...f, text: e.target.value })} />
              <span className="faint" style={{ fontSize: 12 }}>{(f.text ?? '').length}/400 · short lines share best (under 120 characters)</span></div>
            <div className="field"><label htmlFor="st-a">Attribution (optional)</label><input id="st-a" className="input" value={f.attribution ?? ''} onChange={(e) => setF({ ...f, attribution: e.target.value })} placeholder="తెలుగు సామెత" /></div>
            <div className="field"><span className="faint">Background</span>
              <div className="row" style={{ gap: 6 }}>{Object.entries(BG).map(([k, [a, b]]) => (
                <button type="button" key={k} aria-label={k} onClick={() => setF({ ...f, background: k })} style={{ width: 34, height: 34, borderRadius: 10, border: f.background === k ? '3px solid var(--text)' : '1px solid var(--border)', background: `linear-gradient(135deg, ${a}, ${b})`, cursor: 'pointer' }} />
              ))}</div></div>
            <label className="btn ghost sm" style={{ justifySelf: 'start' }}>{file ? `✓ ${file.name.slice(0, 24)}` : f.image_path ? 'Replace image' : 'Use an image instead (memes, festival art)'}
              <input type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ margin: 0 }}><label htmlFor="st-d">Show on</label><input id="st-d" type="date" className="input" value={f.publish_on} onChange={(e) => setF({ ...f, publish_on: e.target.value })} /></div>
              <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={f.status === 'published'} onChange={(e) => setF({ ...f, status: e.target.checked ? 'published' : 'draft' })} />Published</label>
            </div>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || (!f.text?.trim() && !(file || f.image_path))}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
