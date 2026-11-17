import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DISTRICTS, MANDALS } from '@data/locations';
import { acceptAssignment, listAssignments, type Assignment } from '../api';
import { rupees, useLang, useT } from '../i18n';
import { useReporter } from '../ReporterApp';
import { ErrorNote, fmtDate, useToast } from '../ui';

const PRI: Record<string, string> = { urgent: 'red', high: 'amber', normal: 'blue', low: '' };

export default function Assignments() {
  const t = useT(); const lang = useLang(); const toast = useToast();
  const { userId, dash } = useReporter();
  const [rows, setRows] = useState<Assignment[] | null>(null);
  const [tab, setTab] = useState<'mine' | 'open'>('mine');
  const [err, setErr] = useState<string | null>(null);
  const load = () => listAssignments().then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const mine = (rows ?? []).filter((a) => a.assigned_reporter_id === userId && !['cancelled'].includes(a.status));
  const open = (rows ?? []).filter((a) => !a.assigned_reporter_id && a.status === 'open');
  const shown = tab === 'mine' ? mine : open;
  const place = (a: Assignment) => {
    const d = DISTRICTS.find((x) => x.id === a.district_id); const m = MANDALS.find((x) => x.id === a.mandal_id);
    return [a.locality, m && (lang === 'te' ? m.nameTe : m.name), d && (lang === 'te' ? d.nameTe : d.name)].filter(Boolean).join(', ');
  };
  const accept = async (a: Assignment) => {
    try { await acceptAssignment(a.id); toast(`${t('accept')} ✓ ${a.code}`); await load(); setTab('mine'); } catch (e) { setErr((e as Error).message); }
  };
  const active = dash.profile?.status === 'active' || dash.profile?.status === 'verified';

  return (
    <>
      <h1 className="rp-section">{t('assignments')}</h1>
      <div className="rp-seg" role="tablist">
        <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>{t('mine')} {rows ? mine.length : ''}</button>
        <button role="tab" aria-selected={tab === 'open'} className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>{t('openNearYou')} {rows ? open.length : ''}</button>
      </div>
      <ErrorNote error={err} />
      {rows === null ? <p className="rp-empty">…</p> : shown.length === 0 ? <p className="rp-empty">{t('noAssignments')}</p> : shown.map((a) => {
        const overdue = a.deadline && new Date(a.deadline) < new Date() && !['submitted', 'completed'].includes(a.status);
        return (
          <article key={a.id} className="rp-card rp-section">
            <div className="rp-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span className="rp-meta">{a.code}</span>
              <div className="rp-row" style={{ gap: 6 }}>
                <span className={`rp-status ${PRI[a.priority]}`}>{a.priority}</span>
                <span className={`rp-status ${a.status === 'completed' ? 'green' : a.status === 'submitted' ? 'blue' : 'amber'}`}>{a.status}</span>
              </div>
            </div>
            <h2 style={{ margin: '8px 0 6px' }}>{a.title}</h2>
            <p className="rp-body-text" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{a.description}</p>
            <p className="rp-meta" style={{ marginTop: 10 }}>📍 {place(a)}</p>
            {a.deadline && <p className="rp-meta" style={overdue ? { color: 'var(--red)', fontWeight: 700 } : undefined}>⏰ {t('deadline')}: {fmtDate(a.deadline, lang)}</p>}
            {a.media_required.length > 0 && <p className="rp-meta">📎 {a.media_required.join(' · ')}</p>}
            {a.special_amount_paise > 0 && <p style={{ fontWeight: 700, margin: '6px 0 0' }}>{t('special')}: {rupees(a.special_amount_paise)}</p>}
            <div className="rp-row" style={{ marginTop: 14 }}>
              {(a.status === 'open' || (a.status === 'assigned' && a.assigned_reporter_id === userId)) && (
                <button className="rp-btn dark grow" disabled={!active} onClick={() => accept(a)}>{t('accept')}</button>
              )}
              {a.status === 'accepted' && a.assigned_reporter_id === userId && (
                <Link className="rp-btn primary grow" to={`/reporter/submit?assignment=${a.id}`}>{t('submitReport')}</Link>
              )}
            </div>
          </article>
        );
      })}
    </>
  );
}
