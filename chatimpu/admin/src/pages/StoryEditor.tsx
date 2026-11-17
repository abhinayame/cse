import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DISTRICTS, MANDALS, STATES, VILLAGES } from '@data/locations';
import type { CategoryId, ContentLang, StoryText } from '@data/types';
import { PageHead } from '../components/Layout';
import { useStore, type CmsStory } from '../lib/store';
import { canPublish } from '../lib/roles';
import { ai } from '../lib/ai';
import { CATS, LANGS, cap, district, mandal, wordCount } from '../lib/format';

type Mode = 'now' | 'schedule' | 'draft';

const blank = (districtId = 'hyd'): CmsStory => {
  const d = DISTRICTS.find((x) => x.id === districtId)!;
  const m = MANDALS.find((x) => x.districtId === d.id)!;
  return {
    id: `new-${Date.now()}`, category: 'politics', stateId: d.stateId, districtId: d.id, mandalId: m.id, lat: m.lat, lng: m.lng,
    image: '', source: 'Chatimpu Desk', publishedAt: new Date().toISOString(), reactions: { like: 0, wow: 0, sad: 0, angry: 0 },
    comments: 0, shares: 0, views: 0, content: { en: { headline: '', summary: '' } }, status: 'draft', pushOnPublish: false, author: '',
  };
};

/** Waits for live data so a deep link to /stories/:id opens the real story, not a blank form. */
export default function StoryEditorPage() {
  const { id } = useParams();
  const { loading, stories } = useStore();
  if (id && loading) return <div className="card empty">Loading story…</div>;
  if (id && !stories.some((s) => s.id === id)) return <div className="card empty">Story not found, or you don't have access to it.</div>;
  return <StoryEditor key={id ?? 'new'} />;
}

function StoryEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { stories, saveStory, deleteStory, session, toast } = useStore();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const existing = stories.find((s) => s.id === id);
  const [s, setS] = useState<CmsStory>(() => existing ?? { ...blank(session.districts[0]), author: session.name });
  const [lang, setLang] = useState<ContentLang>('en');
  const [mode, setMode] = useState<Mode>(existing?.status === 'scheduled' ? 'schedule' : existing?.status === 'draft' ? 'draft' : 'now');
  const [article, setArticle] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [targets, setTargets] = useState<string[]>(['te', 'hi']);
  const [err, setErr] = useState<string | null>(null);

  const text: StoryText = (s.content as Record<string, StoryText>)[lang] ?? { headline: '', summary: '' };
  const setText = (patch: Partial<StoryText>) => setS({ ...s, content: { ...s.content, [lang]: { ...text, ...patch } } });
  const wc = wordCount(text.summary);
  const wcOk = lang === 'en' ? wc >= 60 && wc <= 80 : wc >= 30 && wc <= 90;
  const mandals = MANDALS.filter((m) => m.districtId === s.districtId);
  const villages = VILLAGES.filter((v) => v.mandalId === s.mandalId);
  const publishable = canPublish(session.role);
  const valid = s.content.en.headline.trim().length > 8 && wordCount(s.content.en.summary) >= 60 && wordCount(s.content.en.summary) <= 80 && !!s.image;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setErr(null);
    try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  const save = async () => {
    const m = publishable ? mode : 'draft';
    const status = m === 'now' ? 'published' : m === 'schedule' ? 'scheduled' : 'draft';
    if (status === 'scheduled' && !s.publishAt) { setErr('Pick a date and time to schedule this story.'); return; }
    const isNew = s.id.startsWith('new-');
    const id = isNew ? s.content.en.headline.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + Date.now().toString(36) : s.id;
    setSaving(true);
    const saved = await saveStory({ ...s, id, status }, { isNew, imageFile });
    setSaving(false);
    if (!saved) return; // the store already showed the error
    toast(status === 'published' ? (s.pushOnPublish && existing?.status !== 'published' ? 'Published · push sent to readers in ' + district(s.districtId) : 'Published') : status === 'scheduled' ? 'Scheduled' : 'Draft saved');
    nav('/stories');
  };

  const preview = useMemo(() => ({ ...text, place: `${mandal(s.mandalId)}, ${district(s.districtId)}` }), [text, s.mandalId, s.districtId]);

  return (
    <>
      <PageHead kicker={existing ? 'Edit story' : 'New story'} title={text.headline || 'Untitled story'}>
        {existing && session.role === 'super_admin' && <button className="btn ghost" onClick={async () => { if (window.confirm('Delete this story for all readers? This cannot be undone.') && await deleteStory(existing.id)) { toast('Story deleted'); nav('/stories'); } }}>Delete</button>}
        <button className="btn ghost" onClick={() => nav(-1)}>Cancel</button>
        <button className="btn primary" disabled={!valid || saving} onClick={save} title={valid ? '' : 'English headline, 60–80 word summary and an image are required'}>
          {saving ? 'Saving…' : !publishable || mode === 'draft' ? 'Save draft' : mode === 'schedule' ? 'Schedule' : 'Publish'}
        </button>
      </PageHead>
      {err && <div className="banner" style={{ borderColor: 'var(--red)', background: 'rgba(229,72,77,.1)' }}>{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 28, alignItems: 'start' }}>
        <div className="grid" style={{ gap: 16 }}>
          <div className="card grid" style={{ gap: 14 }}>
            <div className="row">
              <div className="tabs" role="tablist">
                {LANGS.map((l) => (
                  <button key={l.code} role="tab" aria-selected={lang === l.code} className={lang === l.code ? 'on' : ''} onClick={() => setLang(l.code as ContentLang)}>
                    {l.name}{(s.content as Record<string, unknown>)[l.code] ? ' •' : ''}
                  </button>
                ))}
              </div>
            </div>
            <div className="field"><label htmlFor="hl">Headline ({lang.toUpperCase()})</label>
              <input id="hl" className="input headline" value={text.headline} onChange={(e) => setText({ headline: e.target.value })} placeholder="Clear, factual, ≤ 14 words" /></div>
            <div className="field">
              <div className="row"><label htmlFor="sm">Summary</label><span className="spacer" /><span className={`counter ${wcOk ? 'ok' : 'bad'}`}>{wc} words · target {lang === 'en' ? '60–80' : '40–80'}</span></div>
              <textarea id="sm" className="input" rows={6} value={text.summary} onChange={(e) => setText({ summary: e.target.value })} placeholder="What happened, where, when — and the most useful fact for local readers." />
            </div>
          </div>

          <div className="card ai-panel grid" style={{ gap: 12 }}>
            <div className="row"><h3>AI assist</h3><span className="pill" title={ai.live ? 'Claude via the ai-assist Edge Function' : 'Local fallback — connect Supabase and set ANTHROPIC_API_KEY for Claude'}>{ai.live ? 'Claude Opus 5.5' : 'Offline demo'}</span></div>
            <div className="field"><label htmlFor="art">Paste a long article or press note</label>
              <textarea id="art" className="input" rows={4} value={article} onChange={(e) => setArticle(e.target.value)} placeholder="Paste the full text — AI condenses it to a 60-word card in the selected language." /></div>
            <div className="row">
              <button className="btn ai" disabled={!article.trim() || !!busy} onClick={() => run('sum', async () => { const r = await ai.summarize(article, lang); setText({ headline: r.headline, summary: r.summary }); })}>
                {busy === 'sum' ? 'Summarising…' : '✦ Summarise to 60 words'}</button>
              <button className="btn ai" disabled={!text.summary || !!busy} onClick={() => run('hl', async () => setSuggestions(await ai.headlines(text, lang)))}>
                {busy === 'hl' ? 'Thinking…' : '✦ Suggest headlines'}</button>
            </div>
            {suggestions.length > 0 && (
              <div className="grid" style={{ gap: 6 }}>
                {suggestions.map((h) => <button key={h} className="suggest" onClick={() => { setText({ headline: h }); setSuggestions([]); }}>{h}</button>)}
              </div>
            )}
            <div className="row">
              <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>Translate {lang.toUpperCase()} to:</span>
              {LANGS.filter((l) => l.code !== lang).map((l) => (
                <label key={l.code} className="row" style={{ gap: 4, fontSize: 13 }}>
                  <input type="checkbox" checked={targets.includes(l.code)} onChange={(e) => setTargets(e.target.checked ? [...targets, l.code] : targets.filter((x) => x !== l.code))} />{l.name}
                </label>
              ))}
              <button className="btn ai sm" disabled={!text.summary || !targets.length || !!busy} onClick={() => run('tr', async () => {
                const r = await ai.translate(text, lang, targets.filter((x) => x !== lang));
                setS((cur) => ({ ...cur, content: { ...cur.content, ...r } }));
                toast(`Translated to ${Object.keys(r).length} languages — review before publishing`);
              })}>{busy === 'tr' ? 'Translating…' : '✦ Auto-translate'}</button>
            </div>
          </div>

          <div className="card grid cols-2" style={{ gap: 14 }}>
            <div className="field"><label>Category</label>
              <select className="input" value={s.category} onChange={(e) => setS({ ...s, category: e.target.value as CategoryId })}>{CATS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</select></div>
            <div className="field"><label>Source</label><input className="input" value={s.source} onChange={(e) => setS({ ...s, source: e.target.value })} /></div>
            <div className="field"><label>State</label>
              <select className="input" value={s.stateId} disabled={!!session.districts.length} onChange={(e) => { const d = DISTRICTS.find((x) => x.stateId === e.target.value)!; const m = MANDALS.find((x) => x.districtId === d.id)!; setS({ ...s, stateId: e.target.value, districtId: d.id, mandalId: m.id, villageId: undefined, lat: m.lat, lng: m.lng }); }}>
                {STATES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
            <div className="field"><label>District</label>
              <select className="input" value={s.districtId} onChange={(e) => { const m = MANDALS.find((x) => x.districtId === e.target.value)!; setS({ ...s, districtId: e.target.value, mandalId: m.id, villageId: undefined, lat: m.lat, lng: m.lng }); }}>
                {DISTRICTS.filter((x) => x.stateId === s.stateId && (!session.districts.length || session.districts.includes(x.id))).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
            <div className="field"><label>Mandal</label>
              <select className="input" value={s.mandalId} onChange={(e) => { const m = MANDALS.find((x) => x.id === e.target.value)!; setS({ ...s, mandalId: m.id, villageId: undefined, lat: m.lat, lng: m.lng }); }}>
                {mandals.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
            <div className="field"><label>Village / ward (optional)</label>
              <select className="input" value={s.villageId ?? ''} onChange={(e) => setS({ ...s, villageId: e.target.value || undefined })}>
                <option value="">Whole mandal</option>{villages.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label>Image</label>
              <div className="row">
                <input className="input" style={{ flex: 1 }} placeholder="https://… (served via image CDN, auto WebP)" value={s.image.startsWith('blob:') ? '' : s.image} onChange={(e) => { setImageFile(null); setS({ ...s, image: e.target.value, imagePath: e.target.value }); }} />
                <label className="btn ghost">Upload<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImageFile(f); setS({ ...s, image: URL.createObjectURL(f) }); } }} /></label>
              </div></div>
          </div>

          <div className="card grid" style={{ gap: 14 }}>
            <h3>Publishing</h3>
            {!valid && <div className="faint" style={{ fontSize: 12.5 }}>To publish: English headline, a 60–80 word English summary and an image.</div>}
            {publishable ? (
              <div className="tabs">
                {(['now', 'schedule', 'draft'] as Mode[]).map((m) => <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m === 'now' ? 'Publish now' : m === 'schedule' ? 'Schedule' : 'Draft'}</button>)}
              </div>
            ) : <div className="banner">Reporters save drafts; an editor or district moderator publishes them.</div>}
            {mode === 'schedule' && publishable && (
              <div className="field" style={{ maxWidth: 280 }}><label>Publish at</label>
                <input type="datetime-local" className="input" value={s.publishAt?.slice(0, 16) ?? ''} onChange={(e) => setS({ ...s, publishAt: new Date(e.target.value).toISOString() })} /></div>
            )}
            <label className="switch"><input type="checkbox" checked={!!s.isBreaking} onChange={(e) => setS({ ...s, isBreaking: e.target.checked })} />Breaking news (red banner + top of feed)</label>
            <label className="switch"><input type="checkbox" checked={s.pushOnPublish} onChange={(e) => setS({ ...s, pushOnPublish: e.target.checked })} />Send push notification to readers in {district(s.districtId)}{s.isBreaking ? ' (breaking → all states)' : ''}</label>
            <label className="switch"><input type="checkbox" checked={!!s.sponsor} onChange={(e) => setS({ ...s, sponsor: e.target.checked ? 'Advertiser name' : undefined })} />Sponsored story (always labelled “Sponsored”)</label>
            {s.sponsor !== undefined && <input className="input" style={{ maxWidth: 320 }} value={s.sponsor} onChange={(e) => setS({ ...s, sponsor: e.target.value })} />}
          </div>
        </div>

        <div className="phone" aria-label="Phone preview">
          <div className="img" style={{ backgroundImage: s.image ? `url(${s.image})` : undefined }}>
            <div className="chips">{s.isBreaking && <span className="brk">BREAKING</span>}<span>{cap(s.category)}</span>{s.sponsor && <span className="spn">SPONSORED</span>}</div>
          </div>
          <div className="body">
            <div className="meta">{s.sponsor || s.source} · {preview.place}</div>
            <h4 style={{ fontFamily: lang === 'te' ? "'Ramabhadra', serif" : undefined, fontWeight: lang === 'te' ? 400 : undefined }}>{preview.headline || 'Your headline appears here'}</h4>
            <div className="rule" />
            <p style={lang === 'te' ? { fontFamily: "'Ramabhadra', sans-serif", fontWeight: 400, fontSize: 13, lineHeight: 1.8 } : undefined}>{preview.summary || 'The 60–80 word summary appears here, exactly as readers will see it in the flip feed.'}</p>
          </div>
          <div className="actions"><span>🎧 Listen</span><span>👍 React</span><span>Share</span></div>
        </div>
      </div>
    </>
  );
}
