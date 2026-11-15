import { Link } from 'react-router-dom';
import { ANALYTICS, DISTRICT_STATS } from '@data/catalog';
import { PageHead } from '../components/Layout';
import { BarList, Stat, TrendChart } from '../components/Charts';
import { useScopedStories, useStore } from '../lib/store';
import { compact, district, ago } from '../lib/format';

export default function Dashboard() {
  const { session, submissions } = useStore();
  const stories = useScopedStories();
  const last = ANALYTICS.at(-1)!, prevWeek = ANALYTICS.at(-8)!;
  const pct = (a: number, b: number) => ((a - b) / b) * 100;
  const pending = submissions.filter((s) => s.status === 'pending' && (!session.districts.length || session.districts.includes(s.districtId)));
  const top = [...stories].sort((a, b) => b.views - a.views).slice(0, 5);
  return (
    <>
      <PageHead kicker={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} title={`Good ${new Date().getHours() < 12 ? 'morning' : 'evening'}, ${session.name.split(' ')[0]}`}>
        <Link className="btn primary" to="/stories/new">＋ New story</Link>
      </PageHead>
      <div className="grid cols-4">
        <Stat label="Views today" value={compact(last.views)} delta={pct(last.views, prevWeek.views)} />
        <Stat label="Flips today" value={compact(last.flips)} delta={pct(last.flips, prevWeek.flips)} />
        <Stat label="Shares today" value={compact(last.shares)} delta={pct(last.shares, prevWeek.shares)} />
        <Stat label="Pending moderation" value={String(pending.length)} />
      </div>
      <div className="grid cols-3" style={{ marginTop: 16, gridTemplateColumns: '2fr 1fr' }}>
        <div className="card">
          <h2>Views</h2><div className="muted" style={{ marginBottom: 10 }}>Last 14 days, all districts</div>
          <TrendChart data={ANALYTICS} dataKey="views" label="Views" />
        </div>
        <div className="card">
          <h2>By district</h2><div className="muted" style={{ marginBottom: 16 }}>Views, last 30 days</div>
          <BarList rows={DISTRICT_STATS.map((d) => ({ label: district(d.districtId), value: d.views }))} format={compact} />
          <div className="muted" style={{ marginTop: 18, fontSize: 12.5 }}>Retention D7: {DISTRICT_STATS.map((d) => `${district(d.districtId)} ${Math.round(d.retention * 100)}%`).join(' · ')}</div>
        </div>
      </div>
      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="row"><h2>Top stories</h2><span className="spacer" /><Link to="/stories" className="btn sm ghost">All stories</Link></div>
          <table style={{ marginTop: 8 }}><tbody>
            {top.map((s) => (
              <tr key={s.id}><td><Link to={`/stories/${s.id}`} className="title-cell"><img className="thumb" src={s.image} alt="" /><b>{s.content.en.headline}</b></Link></td>
                <td className="num">{compact(s.views)}<div className="faint" style={{ fontSize: 11 }}>views</div></td></tr>
            ))}
          </tbody></table>
        </div>
        <div className="card">
          <div className="row"><h2>Citizen reports</h2><span className="spacer" /><Link to="/moderation" className="btn sm ghost">Open queue</Link></div>
          {pending.length === 0 ? <div className="empty">Queue is clear ✓</div> : pending.map((s) => (
            <Link key={s.id} to={`/moderation?id=${s.id}`} className="queue-item">
              <div style={{ flex: 1 }}>
                <b>{s.headline}</b>
                <div className="faint" style={{ fontSize: 12.5 }}>{s.reporterName}{s.verified ? ' ✓' : ' · unverified'} · {district(s.districtId)} · {ago(s.submittedAt)}</div>
              </div>
              {s.aiFlags?.length ? <span className="pill high">{s.aiFlags.length} flags</span> : <span className="pill">new</span>}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
