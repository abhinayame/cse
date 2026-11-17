/**
 * Monthly recognition. Scores are quality-weighted (accuracy, original media, consistency; at most
 * five approvals per day count), so volume alone is not rewarded. Badges are awarded by editors;
 * cash bonuses additionally need the finance permission and are credited through the ledger.
 */
import { useCallback, useEffect, useState } from 'react';
import { PageHead } from '../components/Layout';
import { useStore } from '../lib/store';
import { district } from '../lib/format';
import { supabase } from '../lib/supabase';
import { awardBadge, loadAwards, loadBadges, loadScores, paise, type Award, type Badge, type ScoreRow } from '../newsroom/api';
import { NeedsBackend, label } from '../newsroom/ui';

const ICON: Record<string, string> = { trophy: '🏆', check: '🎯', video: '🎥', megaphone: '📣', calendar: '📅', building: '🏛️' };
const monthStart = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

export default function Recognition() {
  if (!supabase) return <NeedsBackend kicker="Reporter network" title="Recognition" />;
  return <Board />;
}

function Board() {
  const { toast, session } = useStore();
  const [month, setMonth] = useState(monthStart());
  const [scores, setScores] = useState<ScoreRow[] | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [award, setAward] = useState<{ reporter: ScoreRow; badge: string; reason: string; bonus: string } | null>(null);
  const canBonus = session.role === 'super_admin' || !!session.permissions?.includes('finance');
  const load = useCallback(async () => {
    try { const [s, b, a] = await Promise.all([loadScores(month), loadBadges(), loadAwards(month)]); setScores(s.sort((x, y) => y.score - x.score)); setBadges(b.filter((x) => x.active)); setAwards(a); }
    catch (e) { toast(`⚠ ${(e as Error).message}`); }
  }, [month, toast]);
  useEffect(() => { load(); }, [load]);

  const scoped = (scores ?? []).filter((s) => !session.districts.length || session.districts.includes(s.district_id));
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return monthStart(d); });
  const give = async () => {
    if (!award) return;
    try {
      await awardBadge(award.reporter.reporter_id, award.badge, month, award.reason, Math.round(Number(award.bonus || 0) * 100));
      toast(`Badge awarded to ${award.reporter.name}${Number(award.bonus) > 0 ? ` with ₹${award.bonus} bonus` : ''}`); setAward(null); load();
    } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };
  // Suggestions follow the documented criteria; editors still decide.
  const suggest = (s: ScoreRow) => [
    s === scoped[0] && s.approved >= 3 ? 'best_reporter_month' : null,
    s.approved >= 5 && s.rejected === 0 && s.corrections === 0 ? 'accuracy_champion' : null,
    s.active_weeks >= 4 ? 'consistent_contributor' : null,
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHead kicker="Reporter network" title="Recognition">
        <select className="input" style={{ width: 'auto' }} value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>{new Date(m).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</option>)}</select>
      </PageHead>
      <div className="banner">Scores weight accuracy (rejections and corrections lower it), original photos/videos and consistency across weeks. Only five approvals per reporter per day count, so volume alone does not win.</div>
      <div className="desk" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px' }}>
        <div className="card table-wrap" style={{ padding: 8 }}>
          <table><thead><tr><th>#</th><th>Reporter</th><th>Approved</th><th>Accuracy</th><th>Original media</th><th>Active weeks</th><th>Score</th><th /></tr></thead>
            <tbody>{scores === null ? <tr><td colSpan={8} className="empty">Loading…</td></tr> : scoped.length === 0 ? <tr><td colSpan={8} className="empty">No approved work this month yet</td></tr> : scoped.map((s, i) => (
              <tr key={s.reporter_id}>
                <td><b>{i + 1}</b></td>
                <td><b>{s.name}</b><div className="faint" style={{ fontSize: 12 }}>{district(s.district_id)} · {label(s.category)}</div>
                  <div>{awards.filter((a) => a.reporter_id === s.reporter_id).map((a) => <span key={a.id} title={a.reason ?? ''}>{ICON[badges.find((b) => b.code === a.badge_code)?.icon ?? ''] ?? '🏅'}</span>)}</div></td>
                <td>{s.approved}<span className="faint"> / {s.approved + s.rejected}</span></td>
                <td>{Math.round(Number(s.accuracy) * 100)}%{s.corrections ? <span className="faint"> · {s.corrections} corr.</span> : null}</td>
                <td>{s.original_media}</td><td>{s.active_weeks}</td><td><b>{Number(s.score).toFixed(1)}</b></td>
                <td><button className="btn sm ghost" onClick={() => setAward({ reporter: s, badge: suggest(s)[0] ?? badges[0]?.code ?? '', reason: '', bonus: '' })}>Award…</button>
                  {suggest(s).length > 0 && <div className="faint" style={{ fontSize: 11 }}>Suggested: {suggest(s).map((c) => badges.find((b) => b.code === c)?.name_en).join(', ')}</div>}</td>
              </tr>
            ))}</tbody></table>
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 10 }}>Awarded this month</h2>
          {awards.length === 0 ? <p className="faint">None yet.</p> : awards.map((a) => {
            const b = badges.find((x) => x.code === a.badge_code);
            return <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              {ICON[b?.icon ?? ''] ?? '🏅'} <b>{b?.name_en ?? a.badge_code}</b> → {scores?.find((s) => s.reporter_id === a.reporter_id)?.name ?? 'Reporter'}
              {a.bonus_paise > 0 && <span className="money"> · {paise(a.bonus_paise)}</span>}<div className="faint" style={{ fontSize: 12 }}>{a.reason}</div></div>;
          })}
          <h2 style={{ margin: '18px 0 8px' }}>Badges</h2>
          {badges.map((b) => <div key={b.code} style={{ fontSize: 13, marginBottom: 6 }}>{ICON[b.icon] ?? '🏅'} <b>{b.name_en}</b> <span className="te-body faint">{b.name_te}</span><div className="faint">{b.description}</div></div>)}
        </div>
      </div>
      {award && (
        <div className="modal-bg" onClick={() => setAward(null)}>
          <div className="modal grid" style={{ gap: 10 }} role="dialog" aria-modal="true" aria-label="Award badge" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 20 }}>Award {award.reporter.name}</h2>
            <select className="input" value={award.badge} onChange={(e) => setAward({ ...award, badge: e.target.value })}>{badges.map((b) => <option key={b.code} value={b.code}>{b.name_en}</option>)}</select>
            <textarea className="input" rows={3} placeholder="Why? (shown to the reporter)" value={award.reason} onChange={(e) => setAward({ ...award, reason: e.target.value })} />
            {canBonus ? <label className="row">Bonus ₹ <input className="input" type="number" min={0} max={10000} value={award.bonus} onChange={(e) => setAward({ ...award, bonus: e.target.value })} style={{ width: 120 }} /><span className="faint" style={{ fontSize: 12 }}>credited once via the ledger</span></label>
              : <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>Cash bonuses need the finance permission.</p>}
            <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn ghost" onClick={() => setAward(null)}>Cancel</button><button className="btn primary" disabled={!award.badge || award.reason.trim().length < 5} onClick={give}>Award</button></div>
          </div>
        </div>
      )}
    </>
  );
}
