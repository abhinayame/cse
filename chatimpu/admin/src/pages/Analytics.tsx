import { useMemo, useState } from 'react';
import { PageHead } from '../components/Layout';
import { BarList, Stat, TrendChart } from '../components/Charts';
import { useScopedStories, useStore } from '../lib/store';
import { CATS, CAT_COLOR, cap, compact, district, fmt } from '../lib/format';

export default function Analytics() {
  const stories = useScopedStories();
  const { analytics: ANALYTICS, districtStats: DISTRICT_STATS } = useStore();
  const hasTraffic = ANALYTICS.some((d) => d.views > 0);
  const last7 = ANALYTICS.slice(-7);
  const dau7 = last7.reduce((a, d) => a + d.dau, 0);
  const [metric, setMetric] = useState<'views' | 'flips' | 'shares' | 'dau'>('views');
  const [showTable, setShowTable] = useState(false);
  const byCat = useMemo(() => CATS.map((c) => ({ label: cap(c), dot: CAT_COLOR[c], value: stories.filter((s) => s.category === c).reduce((a, s) => a + s.views, 0) }))
    .filter((r) => r.value).sort((a, b) => b.value - a.value), [stories]);
  const shareRate = useMemo(() => CATS.map((c) => {
    const ss = stories.filter((s) => s.category === c); const v = ss.reduce((a, s) => a + s.views, 0);
    return { label: cap(c), dot: CAT_COLOR[c], value: v ? ss.reduce((a, s) => a + s.shares, 0) / v : 0 };
  }).filter((r) => r.value).sort((a, b) => b.value - a.value), [stories]);
  const sum = (k: 'views' | 'flips' | 'shares') => last7.reduce((a, d) => a + d[k], 0);
  const labels = { views: 'Views', flips: 'Flips', shares: 'Shares', dau: 'Daily active readers' };

  return (
    <>
      <PageHead kicker="Last 14 days" title="Analytics">
        <button className="btn ghost sm" onClick={() => setShowTable(!showTable)}>{showTable ? 'Show charts' : 'Table view'}</button>
      </PageHead>
      <div className="grid cols-4">
        <Stat label="Views · 7d" value={compact(sum('views'))} />
        <Stat label="Flips · 7d" value={compact(sum('flips'))} />
        <Stat label="Flips per session" value={dau7 ? (sum('flips') / dau7).toFixed(1) : '—'} />
        <Stat label="D7 retention" value={ANALYTICS.length ? `${Math.round((ANALYTICS.at(-1)?.retentionD7 ?? 0) * 100)}%` : '—'} />
      </div>
      {showTable ? (
        <div className="card table-wrap" style={{ marginTop: 16 }}>
          <table><thead><tr><th>Day</th><th className="num">Views</th><th className="num">Flips</th><th className="num">Shares</th><th className="num">DAU</th><th className="num">D7</th></tr></thead>
            <tbody>{ANALYTICS.map((d) => <tr key={d.day}><td>{d.day}</td><td className="num">{fmt(d.views)}</td><td className="num">{fmt(d.flips)}</td><td className="num">{fmt(d.shares)}</td><td className="num">{fmt(d.dau)}</td><td className="num">{Math.round(d.retentionD7 * 100)}%</td></tr>)}</tbody></table>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="row" style={{ marginBottom: 12 }}><h2>{labels[metric]}</h2><span className="spacer" />
            <div className="tabs">{(Object.keys(labels) as (keyof typeof labels)[]).map((k) => <button key={k} className={metric === k ? 'on' : ''} onClick={() => setMetric(k)}>{k === 'dau' ? 'Readers' : labels[k]}</button>)}</div></div>
          {hasTraffic ? <TrendChart data={ANALYTICS as unknown as Record<string, number | string>[]} dataKey={metric} label={labels[metric]} height={260} />
            : <div className="empty">No reader activity yet. The app sends views, flips and shares here as people read.</div>}
        </div>
      )}
      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card"><h2>Views by category</h2><div className="muted" style={{ marginBottom: 14 }}>Published stories in scope</div><BarList rows={byCat} format={compact} /></div>
        <div className="card"><h2>Share rate by category</h2><div className="muted" style={{ marginBottom: 14 }}>Shares ÷ views</div><BarList rows={shareRate} format={(n) => `${(n * 100).toFixed(1)}%`} color="--chart-2" /></div>
      </div>
      <div className="card table-wrap" style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 8 }}>By district</h2>
        <table><thead><tr><th>District</th><th className="num">Readers</th><th className="num">Views</th><th className="num">Flips</th><th className="num">Shares</th><th className="num">Flips / reader</th><th className="num">D7 retention</th></tr></thead>
          <tbody>{DISTRICT_STATS.map((d) => (
            <tr key={d.districtId}><td><b>{district(d.districtId)}</b></td><td className="num">{fmt(d.readers)}</td><td className="num">{fmt(d.views)}</td><td className="num">{fmt(d.flips)}</td><td className="num">{fmt(d.shares)}</td><td className="num">{d.readers ? (d.flips / d.readers).toFixed(1) : '—'}</td><td className="num">{Math.round(d.retention * 100)}%</td></tr>
          ))}</tbody></table>
      </div>
    </>
  );
}
