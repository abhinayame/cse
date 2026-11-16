import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DISTRICTS } from '@data/locations';
import { PageHead } from '../components/Layout';
import { useScopedStories, useStore } from '../lib/store';
import { CATS, CAT_COLOR, LANGS, ago, cap, compact, district, mandal } from '../lib/format';

export default function Stories() {
  const { session } = useStore();
  const all = useScopedStories();
  const [q, setQ] = useState('');
  const [d, setD] = useState('');
  const [c, setC] = useState('');
  const [st, setSt] = useState('');
  const [lang, setLang] = useState('');
  const rows = useMemo(() => all.filter((s) =>
    (!q || Object.values(s.content).some((t) => (t!.headline + t!.summary).toLowerCase().includes(q.toLowerCase())))
    && (!d || s.districtId === d) && (!c || s.category === c) && (!st || s.status === st) && (!lang || (s.content as Record<string, unknown>)[lang])
  ).sort((a, b) => +new Date(b.publishAt ?? b.publishedAt) - +new Date(a.publishAt ?? a.publishedAt)), [all, q, d, c, st, lang]);

  return (
    <>
      <PageHead kicker={`${rows.length} of ${all.length}`} title="Stories">
        <Link className="btn primary" to="/stories/new">＋ New story</Link>
      </PageHead>
      <div className="toolbar">
        <input className="input" placeholder="Search headlines…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} />
        {!session.districts.length && <select className="input" value={d} onChange={(e) => setD(e.target.value)}><option value="">All districts</option>{DISTRICTS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
        <select className="input" value={c} onChange={(e) => setC(e.target.value)}><option value="">All categories</option>{CATS.map((x) => <option key={x} value={x}>{cap(x)}</option>)}</select>
        <select className="input" value={st} onChange={(e) => setSt(e.target.value)}><option value="">Any status</option><option value="published">Published</option><option value="scheduled">Scheduled</option><option value="draft">Draft</option></select>
        <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}><option value="">Any language</option>{LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</select>
      </div>
      <div className="card table-wrap" style={{ padding: 8 }}>
        <table>
          <thead><tr><th>Story</th><th>Location</th><th>Category</th><th>Languages</th><th>Status</th><th className="num">Views</th><th className="num">Shares</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td style={{ maxWidth: 420 }}><Link to={`/stories/${s.id}`} className="title-cell"><img className="thumb" src={s.image} alt="" />
                  <div><b>{s.content.en.headline}</b><div className="faint" style={{ fontSize: 12 }}>{s.source} · {s.author}</div></div></Link></td>
                <td>{mandal(s.mandalId)}<div className="faint" style={{ fontSize: 12 }}>{district(s.districtId)}</div></td>
                <td><span className="pill"><span className="dot" style={{ background: CAT_COLOR[s.category] }} />{cap(s.category)}</span></td>
                <td>{Object.keys(s.content).map((l) => l.toUpperCase()).join(' · ')}</td>
                <td><div className="row" style={{ gap: 4 }}>
                  <span className={`pill ${s.status}`}>{cap(s.status)}</span>
                  {s.isBreaking && <span className="pill breaking">Breaking</span>}
                  {s.sponsor && <span className="pill sponsored">Sponsored</span>}
                </div><div className="faint" style={{ fontSize: 12 }}>{s.status === 'scheduled' && s.publishAt ? ago(s.publishAt) : ago(s.publishedAt)}</div></td>
                <td className="num">{compact(s.views)}</td>
                <td className="num">{compact(s.shares)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="empty">No stories match these filters</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
