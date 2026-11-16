import { useState } from 'react';
import { DISTRICTS } from '@data/locations';
import type { Ad } from '@data/types';
import { PageHead } from '../components/Layout';
import { useStore } from '../lib/store';
import { cap, compact, district, fmt } from '../lib/format';

const blank = (): Ad => ({ id: `ad-${Date.now()}`, advertiser: '', districtIds: ['hyd'], image: '', headline: { en: '' }, body: { en: '' }, cta: { en: 'Learn more' }, url: '', impressions: 0, clicks: 0, budgetInr: 25000, status: 'paused' });

export default function Ads() {
  const { ads, upsertAd, adFrequency, setAdFrequency, toast } = useStore();
  const [form, setForm] = useState<Ad | null>(null);
  const spend = ads.reduce((a, x) => a + Math.round(x.impressions / 1000 * 120), 0);
  return (
    <>
      <PageHead kicker="Monetisation" title="Ad manager"><button className="btn primary" onClick={() => setForm(blank())}>＋ New campaign</button></PageHead>
      <div className="grid cols-4">
        <div className="card stat"><div className="label">Active campaigns</div><div className="value">{ads.filter((a) => a.status === 'active').length}</div></div>
        <div className="card stat"><div className="label">Impressions</div><div className="value">{compact(ads.reduce((a, x) => a + x.impressions, 0))}</div></div>
        <div className="card stat"><div className="label">Avg CTR</div><div className="value">{(ads.reduce((a, x) => a + x.clicks, 0) / Math.max(1, ads.reduce((a, x) => a + x.impressions, 0)) * 100).toFixed(2)}%</div></div>
        <div className="card stat"><div className="label">Revenue (₹120 CPM)</div><div className="value">₹{compact(spend)}</div></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row"><h3>Native ad frequency</h3><span className="spacer" />
          <label className="row">One full-screen ad every
            <select className="input" style={{ width: 80 }} value={adFrequency} onChange={(e) => { setAdFrequency(+e.target.value); toast('Frequency updated for all readers'); }}>{[8, 9, 10].map((n) => <option key={n}>{n}</option>)}</select> flips (rotates 8 → 9 → 10)</label></div>
        <div className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>Premium subscribers never see ads. Sponsored local stories are created from the story editor and always carry a “Sponsored” label.</div>
      </div>
      {form && (
        <div className="card grid cols-2" style={{ marginTop: 16, gap: 14 }}>
          <div className="field"><label>Advertiser / business</label><input className="input" value={form.advertiser} onChange={(e) => setForm({ ...form, advertiser: e.target.value })} /></div>
          <div className="field"><label>Target districts</label>
            <div className="row">{DISTRICTS.map((d) => <label key={d.id} className="row" style={{ gap: 4 }}><input type="checkbox" checked={form.districtIds !== 'all' && form.districtIds.includes(d.id)}
              onChange={(e) => { const cur = form.districtIds === 'all' ? [] : form.districtIds; setForm({ ...form, districtIds: e.target.checked ? [...cur, d.id] : cur.filter((x) => x !== d.id) }); }} />{d.name}</label>)}
              <label className="row" style={{ gap: 4 }}><input type="checkbox" checked={form.districtIds === 'all'} onChange={(e) => setForm({ ...form, districtIds: e.target.checked ? 'all' : [] })} />All</label></div></div>
          <div className="field"><label>Headline (English)</label><input className="input" value={form.headline.en} onChange={(e) => setForm({ ...form, headline: { ...form.headline, en: e.target.value } })} /></div>
          <div className="field"><label>Headline (తెలుగు)</label><input className="input" value={form.headline.te ?? ''} onChange={(e) => setForm({ ...form, headline: { ...form.headline, te: e.target.value } })} /></div>
          <div className="field"><label>Body</label><input className="input" value={form.body.en} onChange={(e) => setForm({ ...form, body: { ...form.body, en: e.target.value } })} /></div>
          <div className="field"><label>Call to action</label><input className="input" value={form.cta.en} onChange={(e) => setForm({ ...form, cta: { ...form.cta, en: e.target.value } })} /></div>
          <div className="field"><label>Image URL</label><input className="input" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} /></div>
          <div className="field"><label>Link or phone (tel:)</label><input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></div>
          <div className="field"><label>Budget (₹)</label><input type="number" className="input" value={form.budgetInr} onChange={(e) => setForm({ ...form, budgetInr: +e.target.value })} /></div>
          <div className="row" style={{ alignSelf: 'end' }}><button className="btn primary" disabled={!form.advertiser || !form.headline.en} onClick={() => { upsertAd({ ...form, status: 'active' }); setForm(null); toast('Campaign launched'); }}>Launch</button><button className="btn ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </div>
      )}
      <div className="card table-wrap" style={{ marginTop: 16, padding: 8 }}>
        <table><thead><tr><th>Campaign</th><th>Districts</th><th>Status</th><th className="num">Budget</th><th className="num">Impressions</th><th className="num">CTR</th><th></th></tr></thead>
          <tbody>{ads.map((a) => (
            <tr key={a.id}>
              <td><div className="title-cell">{a.image ? <img className="thumb" src={a.image} alt="" /> : <div className="thumb" />}<div><b>{a.headline.en}</b><div className="faint" style={{ fontSize: 12 }}>{a.advertiser}</div></div></div></td>
              <td>{a.districtIds === 'all' ? 'All' : a.districtIds.map(district).join(', ')}</td>
              <td><span className={`pill ${a.status === 'active' ? 'published' : 'draft'}`}>{cap(a.status)}</span></td>
              <td className="num">₹{fmt(a.budgetInr)}</td><td className="num">{compact(a.impressions)}</td>
              <td className="num">{a.impressions ? (a.clicks / a.impressions * 100).toFixed(2) : '0.00'}%</td>
              <td className="num"><button className="btn sm ghost" onClick={() => upsertAd({ ...a, status: a.status === 'active' ? 'paused' : 'active' })}>{a.status === 'active' ? 'Pause' : 'Resume'}</button></td>
            </tr>))}</tbody></table>
      </div>
    </>
  );
}
