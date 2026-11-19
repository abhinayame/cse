import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { rupees, setLang, useLang, useT } from '../i18n';
import { useReporter } from '../ReporterApp';

export default function More() {
  const t = useT(); const lang = useLang();
  const { dash } = useReporter();
  const items: [string, string, string, string?][] = [
    ['/reporter/assignments', '📌', t('assignments')],
    ['/reporter/earnings', '₹', t('earnings'), rupees(dash.wallet.lifetime_earned_paise)],
    ['/reporter/withdraw', '💸', t('withdraw'), rupees(dash.wallet.available_paise)],
    ['/reporter/history', '🧾', t('history')],
    ['/reporter/methods', '🏦', t('methods')],
    ['/reporter/profile', '👤', t('profile')],
    ['/reporter/notifications', '🔔', t('notifications'), dash.unread ? String(dash.unread) : undefined],
    ['/reporter/academy', '🎓', lang === 'te' ? 'రిపోర్టర్ అకాడమీ' : 'Reporter Academy'],
    ['/reporter/help', '❓', t('help')],
  ];
  return (
    <>
      <h1 className="rp-section">{t('more')}</h1>
      <nav className="rp-card rp-more rp-section" style={{ padding: '0 12px' }}>
        {items.map(([to, ic, label, extra]) => (
          <Link key={to} to={to}><span className="ic">{ic}</span><span style={{ flex: 1 }}>{label}</span>{extra && <span className="rp-meta">{extra}</span>}<span aria-hidden>›</span></Link>
        ))}
      </nav>
      <div className="rp-row rp-section">
        <button className="rp-btn ghost grow" onClick={() => setLang(lang === 'te' ? 'en' : 'te')}>{t('language')}</button>
        <button className="rp-btn ghost grow" onClick={() => supabase?.auth.signOut()}>{t('signOut')}</button>
      </div>
      <p className="rp-meta" style={{ textAlign: 'center', marginTop: 24, fontWeight: 700, letterSpacing: '.06em' }}>{t('tagline')}</p>
    </>
  );
}
