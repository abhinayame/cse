import { useState } from 'react';
import { DISTRICTS, MANDALS } from '@data/locations';
import { supabase } from '../../lib/supabase';
import { CATS } from '../../lib/format';
import { register, safeName, uploadWithProgress } from '../api';
import { catLabel, setLang, useLang, useT } from '../i18n';
import { useReporter } from '../ReporterApp';
import { ErrorNote } from '../ui';
import { ContributorAgreement } from './Help';

export default function Register() {
  const t = useT(); const lang = useLang();
  const { reload, userId } = useReporter();
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ full_name: '', email: '', district: 'hyd', mandal: 'hyd-amp', locality: '', language: lang, interests: [] as string[], intro: '', accept: false });
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mandals = MANDALS.filter((m) => m.districtId === f.district);
  const canNext = step === 1 ? f.full_name.trim().length >= 2 : step === 2 ? !!f.district : true;

  const finish = async () => {
    setBusy(true); setErr(null);
    try {
      let photo_path: string | null = null;
      if (photo) {
        photo_path = `avatars/${userId}/${Date.now()}-${safeName(photo.name)}`;
        await uploadWithProgress('media', photo_path, photo, () => {});
      }
      await register({ ...f, photo_path });
      await reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="rp-wrap" style={{ paddingTop: 20 }}>
      <div className="rp-row" style={{ justifyContent: 'space-between' }}>
        <div className="rp-logo"><img className="mono" src="/chatimpu-emblem.png" alt="" /><div><span className="wordmark" lang="te">చాటింపు</span><small>{t('brandSub')}</small></div></div>
        <button className="rp-lang" onClick={() => setLang(lang === 'te' ? 'en' : 'te')}>{t('language')}</button>
      </div>
      <h1 style={{ marginTop: 18 }}>{t('joinTitle')}</h1>
      <p className="rp-meta">{t('step')} {step} {t('of')} 4</p>
      <div className="rp-progress rp-light" style={{ margin: '8px 0 18px', background: 'var(--surface-alt)' }}><i style={{ width: `${step * 25}%` }} /></div>
      <ErrorNote error={err} />

      {step === 1 && (
        <section className="rp-card" aria-label={t('aboutYou')}>
          <h2 style={{ marginBottom: 12 }}>{t('aboutYou')}</h2>
          <div className="rp-field"><label htmlFor="r-name">{t('fullName')}</label><input id="r-name" className="rp-input" autoComplete="name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div className="rp-field"><label htmlFor="r-email">{t('email')}</label><input id="r-email" type="email" className="rp-input" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="rp-field"><label htmlFor="r-photo">{t('photo')}</label>
            <input id="r-photo" type="file" accept="image/*" capture="user" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            {photo && <img src={URL.createObjectURL(photo)} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />}</div>
        </section>
      )}
      {step === 2 && (
        <section className="rp-card" aria-label={t('yourArea')}>
          <h2 style={{ marginBottom: 12 }}>{t('yourArea')}</h2>
          <div className="rp-field"><label htmlFor="r-d">{t('district')}</label>
            <select id="r-d" value={f.district} onChange={(e) => setF({ ...f, district: e.target.value, mandal: MANDALS.find((m) => m.districtId === e.target.value)?.id ?? '' })}>
              {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{lang === 'te' ? d.nameTe : d.name}</option>)}</select></div>
          <div className="rp-field"><label htmlFor="r-m">{t('mandal')}</label>
            <select id="r-m" value={f.mandal} onChange={(e) => setF({ ...f, mandal: e.target.value })}>
              {mandals.map((m) => <option key={m.id} value={m.id}>{lang === 'te' ? m.nameTe : m.name}</option>)}</select></div>
          <div className="rp-field"><label htmlFor="r-l">{t('locality')}</label><input id="r-l" className="rp-input" value={f.locality} onChange={(e) => setF({ ...f, locality: e.target.value })} /></div>
          <div className="rp-field"><span className="rp-label">{t('prefLang')}</span>
            <div className="rp-chips">{[['te', 'తెలుగు'], ['en', 'English'], ['hi', 'हिन्दी']].map(([c, n]) => <button key={c} type="button" className={`rp-chip ${f.language === c ? 'on' : ''}`} onClick={() => setF({ ...f, language: c as typeof lang })}>{n}</button>)}</div></div>
        </section>
      )}
      {step === 3 && (
        <section className="rp-card" aria-label={t('interests')}>
          <h2 style={{ marginBottom: 12 }}>{t('interests')}</h2>
          <div className="rp-chips" style={{ marginBottom: 16 }}>
            {CATS.map((c) => <button key={c} type="button" aria-pressed={f.interests.includes(c)} className={`rp-chip ${f.interests.includes(c) ? 'on' : ''}`}
              onClick={() => setF({ ...f, interests: f.interests.includes(c) ? f.interests.filter((x) => x !== c) : [...f.interests, c] })}>{catLabel(lang, c)}</button>)}
          </div>
          <div className="rp-field"><label htmlFor="r-intro">{t('intro')}</label><textarea id="r-intro" maxLength={600} placeholder={t('introHint')} value={f.intro} onChange={(e) => setF({ ...f, intro: e.target.value })} /></div>
        </section>
      )}
      {step === 4 && (
        <section className="rp-card" aria-label={t('agreement')}>
          <h2 style={{ marginBottom: 8 }}>{t('agreement')}</h2>
          <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 14 }}><ContributorAgreement /></div>
          <label className="rp-check"><input type="checkbox" checked={f.accept} onChange={(e) => setF({ ...f, accept: e.target.checked })} />{t('agree')}</label>
        </section>
      )}

      <div className="rp-row" style={{ marginTop: 16 }}>
        {step > 1 && <button className="rp-btn ghost" onClick={() => setStep(step - 1)}>{t('back')}</button>}
        {step < 4 ? <button className="rp-btn primary grow" disabled={!canNext} onClick={() => setStep(step + 1)}>{t('next')}</button>
          : <button className="rp-btn primary grow" disabled={!f.accept || busy} onClick={finish}>{busy ? t('saving') : t('finish')}</button>}
      </div>
      <button className="rp-btn ghost block" style={{ marginTop: 24 }} onClick={() => supabase?.auth.signOut()}>{t('signOut')}</button>
    </div>
  );
}
