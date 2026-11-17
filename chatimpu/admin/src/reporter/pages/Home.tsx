import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { listSubmissions, type Submission } from '../api';
import { rupees, useLang, useT } from '../i18n';
import { useReporter } from '../ReporterApp';
import { ReporterStatus, SubmissionStatus, fmtDate } from '../ui';

export default function Home() {
  const t = useT(); const lang = useLang();
  const { dash } = useReporter();
  const p = dash.profile!;
  const w = dash.wallet;
  const [recent, setRecent] = useState<Submission[]>([]);
  useEffect(() => { listSubmissions().then((r) => setRecent(r.slice(0, 4))).catch(() => {}); }, []);
  const pct = Math.min(100, Math.round((w.available_paise / Math.max(1, dash.threshold_paise)) * 100));
  const eligible = w.available_paise >= dash.threshold_paise;
  const maxMonth = Math.max(1, ...dash.monthly.map((m) => m.earned_paise));
  const banner = p.status !== 'active' ? (t(`stBanner_${p.status}` as never) as string | undefined) : undefined;

  return (
    <>
      <div className="rp-section rp-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <p className="rp-meta">{t('hello')},</p>
          <h1 style={{ margin: 0 }}>{p.full_name}</h1>
          <div className="rp-row" style={{ marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
            <ReporterStatus s={p.status} t={t} />
            <span className="rp-meta">{t(`cat_${p.category}` as never)} · {dash.level}</span>
          </div>
        </div>
      </div>

      {banner && (
        <div className={`rp-banner ${p.status === 'suspended' || p.status === 'rejected' ? 'bad' : 'warn'} rp-section`} role="status">
          <div className="grow">
            {banner}{p.status_reason && <><br /><b>{p.status_reason}</b></>}
            {p.status === 'registered' && <div style={{ marginTop: 8 }}><Link className="rp-btn sm dark" to="/reporter/profile">{t('addId')}</Link></div>}
          </div>
        </div>
      )}

      <section className="rp-hero rp-section" aria-label={t('available')}>
        <div className="label">{t('available')}</div>
        <div className="big">{rupees(w.available_paise)}</div>
        <div className="rp-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
        <p style={{ fontSize: 13, margin: '8px 0 0', color: '#E0E0E0' }}>
          {eligible ? t('eligible') : <>{rupees(dash.threshold_paise - w.available_paise)} {t('toGo')} {rupees(dash.threshold_paise)}</>}
        </p>
        <div className="rp-split">
          <div>{t('pending')}<b>{rupees(dash.pending_earnings_paise)}</b></div>
          <div>{t('totalEarned')}<b>{rupees(w.lifetime_earned_paise)}</b></div>
          <div>{t('withdrawn')}<b>{rupees(w.paid_paise)}</b></div>
        </div>
        <Link to="/reporter/withdraw" className={`rp-btn ${eligible ? 'primary' : ''} block`} style={{ marginTop: 16, position: 'relative', zIndex: 1, ...(eligible ? {} : { background: 'rgba(255,255,255,.12)', color: '#fff' }) }}>{t('withdrawNow')}</Link>
      </section>

      <section className="rp-section">
        <div className="rp-stats">
          <Link to="/reporter/submissions" className="rp-stat"><b>{dash.counts.total}</b><span>{t('submissions')}</span></Link>
          <Link to="/reporter/submissions?f=published" className="rp-stat"><b style={{ color: '#1F8A55' }}>{dash.counts.approved}</b><span>{t('approved')}</span></Link>
          <Link to="/reporter/submissions?f=review" className="rp-stat"><b>{dash.counts.under_review}</b><span>{t('underReview')}</span></Link>
          <Link to="/reporter/submissions?f=rejected" className="rp-stat"><b>{dash.counts.rejected}</b><span>{t('rejected')}</span></Link>
        </div>
        {dash.counts.correction_required > 0 && (
          <Link to="/reporter/submissions?f=correction" className="rp-banner warn" style={{ marginTop: 10 }}>✎ {dash.counts.correction_required} · {t('correction')}</Link>
        )}
      </section>

      <Link to="/reporter/submit" className="rp-btn primary block rp-section" style={{ display: 'flex' }}>＋ {t('submitNews')}</Link>

      <section className="rp-section rp-card">
        <div className="rp-section-head"><h2>{t('rank')}</h2><b style={{ fontSize: 22 }}>{dash.rank ? `#${dash.rank}` : '—'}</b></div>
        <div className="rp-label" style={{ marginBottom: 8 }}>{t('badges')}</div>
        {dash.badges.length ? (
          <div className="rp-chips">{dash.badges.map((b) => <span key={b.code + b.period} className="rp-badge">{b.icon} {lang === 'te' ? b.name_te : b.name_en}</span>)}</div>
        ) : <p className="rp-meta">{t('noBadges')}</p>}
      </section>

      {dash.monthly.length > 0 && (
        <section className="rp-section rp-card">
          <h2 style={{ marginBottom: 12 }}>{t('monthly')}</h2>
          <div className="rp-bars" role="img" aria-label={dash.monthly.map((m) => `${m.month}: ${rupees(m.earned_paise)}`).join(', ')}>
            {dash.monthly.map((m) => (
              <div key={m.month}>
                <span>{m.earned_paise ? rupees(m.earned_paise) : ''}</span>
                <i style={{ height: `${Math.max(3, (m.earned_paise / maxMonth) * 70)}px` }} />
                {new Date(m.month + '-01').toLocaleString(lang === 'te' ? 'te-IN' : 'en-IN', { month: 'short' })}
              </div>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="rp-section rp-card">
          <div className="rp-section-head"><h2>{t('myNews')}</h2><Link to="/reporter/submissions" className="rp-meta">{t('viewAll')} →</Link></div>
          {recent.map((s) => (
            <Link key={s.id} to={`/reporter/submissions/${s.id}`} className="rp-list-item">
              <div className="grow"><div className="title">{s.headline || '—'}</div><div className="rp-meta">{s.code ?? t('s_draft')} · {fmtDate(s.updated_at, lang)}</div></div>
              <SubmissionStatus s={s.status} t={t} />
            </Link>
          ))}
        </section>
      )}
      <p className="rp-meta rp-section" style={{ textAlign: 'center' }}>{t('contributorNote')}</p>
    </>
  );
}
