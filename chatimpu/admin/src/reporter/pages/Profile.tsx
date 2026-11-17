import { useEffect, useState } from 'react';
import { DISTRICTS, MANDALS } from '@data/locations';
import { supabase } from '../../lib/supabase';
import { CATS } from '../../lib/format';
import { db, ok, register, safeName, submitVerification, uploadWithProgress } from '../api';
import { catLabel, useLang, useT } from '../i18n';
import { useReporter } from '../ReporterApp';
import { ErrorNote, ReporterStatus, fmtDate, useToast } from '../ui';

const DOCS = ['aadhaar_masked', 'voter_id', 'pan', 'driving_licence', 'press_id', 'college_id', 'other'] as const;
const DOC_LABEL: Record<string, string> = { aadhaar_masked: 'Masked Aadhaar', voter_id: 'Voter ID', pan: 'PAN card', driving_licence: 'Driving licence', press_id: 'Press / organisation ID', college_id: 'College ID', other: 'Other government ID' };
interface Verification { id: string; document_type: string; document_last4: string | null; status: string; review_note: string | null; created_at: string }

export default function Profile() {
  const t = useT(); const lang = useLang(); const toast = useToast();
  const { dash, reload, userId, phone } = useReporter();
  const p = dash.profile!;
  const [f, setF] = useState({ full_name: p.full_name, email: p.email ?? '', district: p.district_id, mandal: p.mandal_id ?? '', locality: p.locality ?? '', language: p.preferred_language, interests: p.interests, intro: p.intro ?? '' });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [vs, setVs] = useState<Verification[]>([]);
  const [doc, setDoc] = useState({ type: 'aadhaar_masked', last4: '', file: null as File | null, pct: 0 });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadV = async () => {
    try { setVs(ok(await db().from('reporter_verifications').select('id, document_type, document_last4, status, review_note, created_at').order('created_at', { ascending: false })) as Verification[]); }
    catch (e) { setErr((e as Error).message); }
  };
  useEffect(() => { loadV(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (p.photo_path) setAvatar(db().storage.from('media').getPublicUrl(p.photo_path).data.publicUrl);
  }, [p.photo_path]);

  const saveProfile = async () => {
    setBusy('profile'); setErr(null);
    try { await register({ ...f, photo_path: p.photo_path, accept: true }); await reload(); toast('✓'); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const changePhoto = async (file: File) => {
    setBusy('photo'); setErr(null);
    try {
      const path = `avatars/${userId}/${Date.now()}-${safeName(file.name)}`;
      await uploadWithProgress('media', path, file, () => {});
      await register({ ...f, photo_path: path, accept: true }); await reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const sendDoc = async () => {
    setBusy('doc'); setErr(null);
    try {
      let path: string | null = null;
      if (doc.file) {
        path = `${userId}/id/${Date.now()}-${safeName(doc.file.name)}`;
        await uploadWithProgress('reporter-private', path, doc.file, (pct) => setDoc((d) => ({ ...d, pct })));
      }
      await submitVerification(doc.type, doc.last4, path);
      setDoc({ type: doc.type, last4: '', file: null, pct: 0 });
      await Promise.all([loadV(), reload()]); toast(t('submitDoc') + ' ✓');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const pendingDoc = vs.some((v) => v.status === 'pending');
  const approvedDoc = vs.some((v) => v.status === 'approved');

  return (
    <>
      <section className="rp-section rp-card" style={{ textAlign: 'center' }}>
        <label style={{ cursor: 'pointer', display: 'inline-block' }} aria-label={t('photo')}>
          {avatar ? <img src={avatar} alt="" style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover' }} />
            : <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--surface-alt)', display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 700 }}>{p.full_name[0]}</div>}
          <input type="file" hidden accept="image/*" onChange={(e) => e.target.files?.[0] && changePhoto(e.target.files[0])} />
        </label>
        {busy === 'photo' && <p className="rp-meta">{t('uploading')}…</p>}
        <h2 style={{ marginTop: 10 }}>{p.full_name}</h2>
        <p className="rp-meta">{phone ? `+${phone.replace(/^\+?/, '')}` : ''}</p>
        <div className="rp-row" style={{ justifyContent: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          <ReporterStatus s={p.status} t={t} /><span className="rp-badge">{t(`cat_${p.category}` as never)}</span><span className="rp-status">{dash.level}</span>
        </div>
        {p.status_reason && <p className="rp-meta" style={{ marginTop: 8 }}>{p.status_reason}</p>}
        <p className="rp-hint" style={{ marginTop: 10 }}>{t('contributorNote')}</p>
      </section>
      <ErrorNote error={err} />

      <section className="rp-section rp-card" aria-label={t('idVerification')}>
        <div className="rp-section-head"><h2>{t('idVerification')}</h2>{approvedDoc && <span className="rp-status green">{t('verifiedMethod')}</span>}</div>
        {vs.map((v) => (
          <div key={v.id} className="rp-list-item">
            <div className="grow"><div>{DOC_LABEL[v.document_type]}{v.document_last4 ? ` ••${v.document_last4}` : ''}</div><div className="rp-meta">{fmtDate(v.created_at, lang)}{v.review_note ? ` · ${v.review_note}` : ''}</div></div>
            <span className={`rp-status ${v.status === 'approved' ? 'green' : v.status === 'rejected' ? 'red' : 'amber'}`}>{v.status === 'approved' ? t('verifiedMethod') : v.status === 'rejected' ? t('failedMethod') : t('pendingMethod')}</span>
          </div>
        ))}
        {!approvedDoc && !pendingDoc && p.status !== 'suspended' && p.status !== 'rejected' && (
          <div style={{ marginTop: 10 }}>
            <div className="rp-banner info" style={{ marginBottom: 12 }}>🔒 {t('idNote')}</div>
            <div className="rp-field"><label htmlFor="v-t">{t('docType')}</label>
              <select id="v-t" value={doc.type} onChange={(e) => setDoc({ ...doc, type: e.target.value })}>{DOCS.map((d) => <option key={d} value={d}>{DOC_LABEL[d]}</option>)}</select></div>
            <div className="rp-field"><label htmlFor="v-l">{t('last4')}</label>
              <input id="v-l" className="rp-input" maxLength={4} autoComplete="off" value={doc.last4} onChange={(e) => setDoc({ ...doc, last4: e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 4) })} /></div>
            <div className="rp-field"><label htmlFor="v-f">{t('uploadDoc')}</label>
              <input id="v-f" type="file" accept="image/*,application/pdf" onChange={(e) => setDoc({ ...doc, file: e.target.files?.[0] ?? null })} />
              {busy === 'doc' && doc.file && <div className="rp-progress" style={{ background: 'var(--surface-alt)' }}><i style={{ width: `${doc.pct}%` }} /></div>}</div>
            <button className="rp-btn primary block" disabled={busy === 'doc' || !doc.file || doc.last4.length < 2} onClick={sendDoc}>{busy === 'doc' ? t('uploading') : t('submitDoc')}</button>
          </div>
        )}
      </section>

      <section className="rp-section rp-card" aria-label={t('profile')}>
        <h2 style={{ marginBottom: 12 }}>{t('profile')}</h2>
        <div className="rp-field"><label htmlFor="p-n">{t('fullName')}</label><input id="p-n" className="rp-input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div className="rp-field"><label htmlFor="p-e">{t('email')}</label><input id="p-e" type="email" className="rp-input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="rp-row" style={{ alignItems: 'flex-start' }}>
          <div className="rp-field grow"><label htmlFor="p-d">{t('district')}</label>
            <select id="p-d" value={f.district} onChange={(e) => setF({ ...f, district: e.target.value, mandal: MANDALS.find((m) => m.districtId === e.target.value)?.id ?? '' })}>
              {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{lang === 'te' ? d.nameTe : d.name}</option>)}</select></div>
          <div className="rp-field grow"><label htmlFor="p-m">{t('mandal')}</label>
            <select id="p-m" value={f.mandal} onChange={(e) => setF({ ...f, mandal: e.target.value })}>
              {MANDALS.filter((m) => m.districtId === f.district).map((m) => <option key={m.id} value={m.id}>{lang === 'te' ? m.nameTe : m.name}</option>)}</select></div>
        </div>
        <div className="rp-field"><label htmlFor="p-l">{t('locality')}</label><input id="p-l" className="rp-input" value={f.locality} onChange={(e) => setF({ ...f, locality: e.target.value })} /></div>
        <div className="rp-field"><span className="rp-label">{t('interests')}</span>
          <div className="rp-chips">{CATS.map((c) => <button key={c} type="button" aria-pressed={f.interests.includes(c)} className={`rp-chip ${f.interests.includes(c) ? 'on' : ''}`}
            onClick={() => setF({ ...f, interests: f.interests.includes(c) ? f.interests.filter((x) => x !== c) : [...f.interests, c] })}>{catLabel(lang, c)}</button>)}</div></div>
        <div className="rp-field"><label htmlFor="p-i">{t('intro')}</label><textarea id="p-i" maxLength={600} value={f.intro} onChange={(e) => setF({ ...f, intro: e.target.value })} /></div>
        <button className="rp-btn dark block" disabled={busy === 'profile' || f.full_name.trim().length < 2} onClick={saveProfile}>{busy === 'profile' ? t('saving') : t('save')}</button>
      </section>
      <button className="rp-btn ghost block rp-section" onClick={() => supabase?.auth.signOut()}>{t('signOut')}</button>
    </>
  );
}

