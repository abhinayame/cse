import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { markAllRead, notifications, type Notification } from '../api';
import { useLang, useT } from '../i18n';
import { useReporter } from '../ReporterApp';
import { ErrorNote, fmtDate } from '../ui';

const ICON: Record<string, string> = {
  registration: '👋', verification: '🪪', submission_received: '📨', review: '👀', correction: '✎', approved: '✅', published: '📰',
  earning: '₹', withdrawal_eligible: '🎉', withdrawal: '💸', payout_approved: '👍', payment: '✅', payment_failed: '⚠️', rejected: '✕', payout_method: '🏦', assignment: '📌', badge: '🏅',
};

export default function Notifications() {
  const t = useT(); const lang = useLang();
  const { reload, dash } = useReporter();
  const [rows, setRows] = useState<Notification[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { notifications().then(setRows).catch((e) => setErr(e.message)); }, []);
  const readAll = async () => {
    try { await markAllRead(); setRows((r) => r?.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })) ?? null); await reload(); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <div className="rp-section rp-section-head"><h1>{t('notifications')}</h1>{dash.unread > 0 && <button className="rp-btn ghost sm" onClick={readAll}>{t('markAllRead')}</button>}</div>
      <ErrorNote error={err} />
      <section className="rp-card" style={{ paddingTop: 0, paddingBottom: 0 }}>
        {rows === null ? <p className="rp-empty">…</p> : rows.length === 0 ? <p className="rp-empty">{t('noNotifications')}</p> : rows.map((n) => {
          const body = (
            <>
              <span style={{ fontSize: 22, width: 32, textAlign: 'center' }} aria-hidden>{ICON[n.kind] ?? '•'}</span>
              <div className="grow">
                <div style={{ fontWeight: n.read_at ? 500 : 700 }}>{lang === 'te' ? n.title_te ?? n.title_en : n.title_en}</div>
                {(n.body_en || n.body_te) && <div className="rp-meta">{lang === 'te' ? n.body_te ?? n.body_en : n.body_en}</div>}
                <div className="rp-meta">{fmtDate(n.created_at, lang)}</div>
              </div>
              {!n.read_at && <span aria-label="unread" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--red)' }} />}
            </>
          );
          return n.link?.startsWith('/reporter') ? <Link key={n.id} to={n.link} className="rp-list-item">{body}</Link> : <div key={n.id} className="rp-list-item">{body}</div>;
        })}
      </section>
    </>
  );
}
