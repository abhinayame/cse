import { useState } from 'react';
import type { CategoryId, Poll } from '@data/types';
import { PageHead } from '../components/Layout';
import { BarList } from '../components/Charts';
import { useStore } from '../lib/store';
import { CATS, cap, district, fmt } from '../lib/format';

export default function Polls() {
  const { polls, addPoll, toast } = useStore();
  const [q, setQ] = useState({ en: '', te: '' });
  const [opts, setOpts] = useState(['', '', '']);
  const [cat, setCat] = useState<CategoryId>('politics');
  const [hours, setHours] = useState(48);
  const [scope, setScope] = useState<Record<string, string>>({});

  return (
    <>
      <PageHead kicker="Engagement" title="Polls" />
      <div className="card grid cols-2" style={{ gap: 14 }}>
        <div className="field"><label>Question (English)</label><input className="input" value={q.en} onChange={(e) => setQ({ ...q, en: e.target.value })} /></div>
        <div className="field"><label>Question (తెలుగు)</label><input className="input" value={q.te} onChange={(e) => setQ({ ...q, te: e.target.value })} /></div>
        {opts.map((o, i) => <div key={i} className="field"><label>Option {i + 1}</label><input className="input" value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} /></div>)}
        <div className="row" style={{ alignSelf: 'end' }}>
          <select className="input" style={{ width: 'auto' }} value={cat} onChange={(e) => setCat(e.target.value as CategoryId)}>{CATS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</select>
          <select className="input" style={{ width: 'auto' }} value={hours} onChange={(e) => setHours(+e.target.value)}>{[12, 24, 48, 72].map((h) => <option key={h} value={h}>{h}h</option>)}</select>
          <button className="btn primary" disabled={!q.en || opts.filter(Boolean).length < 2} onClick={() => {
            const p: Poll = { id: `poll-${Date.now()}`, category: cat, closesAt: new Date(Date.now() + hours * 3.6e6).toISOString(), question: q.te ? q : { en: q.en },
              options: opts.filter(Boolean).map((label, i) => ({ id: `o${i}`, label: { en: label } })), votes: { national: {} } };
            addPoll(p).then((ok) => { if (ok) { setQ({ en: '', te: '' }); setOpts(['', '', '']); toast('Poll is live'); } });
          }}>Publish poll</button>
        </div>
      </div>
      <div className="grid cols-2" style={{ marginTop: 16 }}>
        {polls.map((p) => {
          const sc = scope[p.id] ?? 'national';
          const v = p.votes[sc] ?? {};
          const total = Object.values(v).reduce((a, b) => a + b, 0);
          return (
            <div key={p.id} className="card grid" style={{ gap: 12 }}>
              <div className="row"><span className="pill">{cap(p.category)}</span><span className="faint" style={{ fontSize: 12.5 }}>closes {new Date(p.closesAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
              <h3>{p.question.en}</h3>
              <select className="input" style={{ width: 'auto' }} value={sc} onChange={(e) => setScope({ ...scope, [p.id]: e.target.value })}>
                {Object.keys(p.votes).map((k) => <option key={k} value={k}>{k === 'national' ? 'Nationwide' : district(k)}</option>)}</select>
              <BarList rows={p.options.map((o) => ({ label: o.label.en, value: total ? (v[o.id] ?? 0) / total : 0 }))} format={(n) => `${Math.round(n * 100)}%`} />
              <div className="faint" style={{ fontSize: 12.5 }}>{fmt(total)} votes</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
