import { useEffect, useState, type FormEvent } from 'react';
import { NavLink } from 'react-router-dom';
import {
  addMethod, cancelWithdrawal, earnings, ledger, methods, rates, removeMethod, requestWithdrawal, utrFor, withdrawals,
  type Earning, type LedgerEntry, type Method, type Rate, type Withdrawal,
} from '../api';
import { rupees, useLang, useT, type T } from '../i18n';
import { useReporter } from '../ReporterApp';
import { ErrorNote, WithdrawalStatus, fmtDate, useToast } from '../ui';

type Tab = 'earnings' | 'withdraw' | 'history' | 'methods';

export default function Wallet({ tab }: { tab: Tab }) {
  const t = useT();
  return (
    <>
      <h1 className="rp-section">{t('wallet')}</h1>
      <nav className="rp-seg" aria-label={t('wallet')} style={{ marginBottom: 4 }}>
        {(['withdraw', 'earnings', 'history', 'methods'] as Tab[]).map((k) => (
          <NavLink key={k} to={`/reporter/${k}`} className={({ isActive }) => (isActive ? 'on' : '')}
            style={{ flex: 1, textAlign: 'center', padding: '9px 10px', borderRadius: 9, fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
            {t(k === 'methods' ? 'tabMethods' : k === 'history' ? 'tabHistory' : k)}</NavLink>
        ))}
      </nav>
      {tab === 'withdraw' && <Withdraw />}
      {tab === 'earnings' && <Earnings />}
      {tab === 'history' && <History />}
      {tab === 'methods' && <Methods />}
    </>
  );
}

function Balance() {
  const t = useT(); const { dash } = useReporter(); const w = dash.wallet;
  const pct = Math.min(100, Math.round((w.available_paise / Math.max(1, dash.threshold_paise)) * 100));
  return (
    <section className="rp-hero rp-section">
      <div className="label">{t('available')}</div>
      <div className="big">{rupees(w.available_paise)}</div>
      <div className="rp-progress"><i style={{ width: `${pct}%` }} /></div>
      <p style={{ fontSize: 13, margin: '8px 0 0', color: '#E0E0E0' }}>{t('threshold')}: {rupees(dash.threshold_paise)}
        {w.available_paise >= dash.threshold_paise ? ` · ✓ ${t('eligible')}` : ` · ${rupees(dash.threshold_paise - w.available_paise)} ${t('toGo')}`}</p>
      <div className="rp-split">
        <div>{t('pending')}<b>{rupees(dash.pending_earnings_paise)}</b></div>
        <div>{t('requested')}<b>{rupees(w.reserved_paise)}</b></div>
        <div>{t('withdrawn')}<b>{rupees(w.paid_paise)}</b></div>
      </div>
    </section>
  );
}

function Withdraw() {
  const t = useT(); const toast = useToast();
  const { dash, reload } = useReporter();
  const [ms, setMs] = useState<Method[] | null>(null);
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    methods().then((m) => { setMs(m); const v = m.filter((x) => x.verification_status === 'verified'); setMethod((v.find((x) => x.is_default) ?? v[0])?.id ?? ''); }).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { setAmount(String(Math.floor(dash.wallet.available_paise / 100))); }, [dash.wallet.available_paise]);
  const verified = (ms ?? []).filter((m) => m.verification_status === 'verified');
  const paise = Math.round(Number(amount || 0) * 100);
  const eligible = dash.wallet.available_paise >= dash.threshold_paise;
  const valid = eligible && paise >= dash.threshold_paise && paise <= dash.wallet.available_paise && !!method && dash.verified_identity;

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const w = await requestWithdrawal(paise, method); toast(`${t('requested')} · ${w.code}`); await reload(); }
    catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <Balance />
      <form className="rp-section rp-card" onSubmit={submit}>
        <h2 style={{ marginBottom: 6 }}>{t('requestWithdrawal')}</h2>
        <p className="rp-meta" style={{ marginBottom: 14 }}>{t('withdrawRules')}</p>
        {!dash.verified_identity && <div className="rp-banner warn" style={{ marginBottom: 12 }}><div>{t('needId')} <NavLink to="/reporter/profile"><b>{t('addId')} →</b></NavLink></div></div>}
        {ms && verified.length === 0 && <div className="rp-banner warn" style={{ marginBottom: 12 }}><div>{t('needVerifiedMethod')} <NavLink to="/reporter/methods"><b>{t('methods')} →</b></NavLink></div></div>}
        <div className="rp-field"><label htmlFor="w-amt">{t('amount')} (₹)</label>
          <input id="w-amt" className="rp-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} disabled={!eligible} style={{ fontSize: 22, fontWeight: 700 }} />
          <span className="rp-hint">{t('threshold')} {rupees(dash.threshold_paise)} · max {rupees(dash.wallet.available_paise)}</span></div>
        {verified.length > 0 && (
          <div className="rp-field"><span className="rp-label">{t('methods')}</span>
            {verified.map((m) => (
              <label key={m.id} className="rp-check" style={{ padding: '10px 0' }}>
                <input type="radio" name="method" checked={method === m.id} onChange={() => setMethod(m.id)} />
                <span>{m.kind === 'upi' ? 'UPI' : m.bank_name ?? 'Bank'} · {m.masked}<br /><span className="rp-meta">{m.holder_name}</span></span>
              </label>
            ))}
          </div>
        )}
        <ErrorNote error={err} />
        <button className="rp-btn primary block" disabled={!valid || busy}>{busy ? t('saving') : `${t('requestWithdrawal')} ${paise > 0 ? rupees(paise) : ''}`}</button>
      </form>
    </>
  );
}

function Earnings() {
  const t = useT(); const lang = useLang();
  const [r, setR] = useState<Rate[]>([]);
  const [e, setE] = useState<Earning[] | null>(null);
  const [l, setL] = useState<LedgerEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { Promise.all([rates(), earnings(), ledger()]).then(([a, b, c]) => { setR(a); setE(b); setL(c); }).catch((x) => setErr(x.message)); }, []);
  const label = (code: string) => { const x = r.find((y) => y.code === code); return x ? (lang === 'te' ? x.label_te : x.label_en) : code; };
  return (
    <>
      <Balance />
      <ErrorNote error={err} />
      <section className="rp-section rp-card">
        <h2 style={{ marginBottom: 6 }}>{t('rateCard')}</h2>
        {r.map((x) => (
          <div key={x.code} className="rp-list-item"><div className="grow">{lang === 'te' ? x.label_te : x.label_en}</div>
            <b className="rp-amount">{x.admin_defined ? '—' : x.min_paise === x.max_paise ? rupees(x.min_paise) : `${rupees(x.min_paise)}–${rupees(x.max_paise)}`}</b></div>
        ))}
        <p className="rp-hint" style={{ marginTop: 8 }}>{t('withdrawRules')}</p>
      </section>
      <section className="rp-section rp-card">
        <h2 style={{ marginBottom: 6 }}>{t('earnings')}</h2>
        {e === null ? <p className="rp-empty">…</p> : e.length === 0 ? <p className="rp-empty">—</p> : e.map((x) => (
          <div key={x.id} className="rp-list-item">
            <div className="grow"><div className="title">{label(x.contribution_code)}</div><div className="rp-meta">{x.code} · {fmtDate(x.approved_at, lang)}</div></div>
            <b className={`rp-amount ${x.status === 'reversed' ? 'minus' : 'plus'}`} style={x.status === 'reversed' ? { textDecoration: 'line-through' } : undefined}>+{rupees(x.amount_paise)}</b>
          </div>
        ))}
      </section>
      {l.length > 0 && (
        <section className="rp-section rp-card">
          <h2 style={{ marginBottom: 6 }}>{t('ledger')}</h2>
          {l.map((x) => <LedgerRow key={x.id} x={x} t={t} lang={lang} />)}
        </section>
      )}
    </>
  );
}

function LedgerRow({ x, t, lang }: { x: LedgerEntry; t: T; lang: string }) {
  const d = x.available_delta;
  return (
    <div className="rp-list-item">
      <div className="grow"><div>{t(`e_${x.entry_type}` as never) ?? x.entry_type}</div><div className="rp-meta">{fmtDate(x.created_at, lang)}{x.note ? ` · ${x.note}` : ''}</div></div>
      <b className={`rp-amount ${d > 0 ? 'plus' : 'minus'}`}>{d > 0 ? '+' : d < 0 ? '−' : ''}{rupees(Math.abs(d || x.paid_delta))}</b>
    </div>
  );
}

function History() {
  const t = useT(); const lang = useLang(); const toast = useToast();
  const { reload } = useReporter();
  const [rows, setRows] = useState<(Withdrawal & { utr?: string | null })[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = async () => {
    const w = await withdrawals();
    setRows(await Promise.all(w.map(async (x) => (x.status === 'paid' ? { ...x, utr: await utrFor(x.id) } : x))));
  };
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);
  const cancel = async (w: Withdrawal) => {
    if (!confirm(`${t('cancel')} ${w.code}?`)) return;
    try { await cancelWithdrawal(w.id); toast(`${w.code} · ${t('w_cancelled')}`); await Promise.all([load(), reload()]); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <ErrorNote error={err} />
      <section className="rp-section rp-card">
        {rows === null ? <p className="rp-empty">…</p> : rows.length === 0 ? <p className="rp-empty">{t('noHistory')}</p> : rows.map((w) => (
          <div key={w.id} className="rp-list-item" style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <div className="rp-row" style={{ justifyContent: 'space-between' }}><b className="rp-amount" style={{ fontSize: 17 }}>{rupees(w.amount_paise)}</b><WithdrawalStatus s={w.status} t={t} /></div>
              <div className="rp-meta">{w.code} · {w.method_snapshot?.kind === 'upi' ? 'UPI' : 'Bank'} {w.method_snapshot?.masked} · {fmtDate(w.created_at, lang)}</div>
              {w.utr && <div className="rp-meta">UTR: <b>{w.utr}</b>{w.paid_at ? ` · ${fmtDate(w.paid_at, lang)}` : ''}</div>}
              {w.reason && ['rejected', 'failed', 'reversed'].includes(w.status) && <div className="rp-hint" style={{ color: 'var(--red)' }}>{w.reason}</div>}
              {['failed', 'reversed', 'rejected'].includes(w.status) && !w.needs_reconciliation && <div className="rp-hint" style={{ color: '#1F8A55' }}>✓ {t('restored')}</div>}
              {w.needs_reconciliation && <div className="rp-hint">⏳ Finance team is reconciling this payout. Your money is safe and will be restored if the payment did not go through.</div>}
              {['requested', 'under_review'].includes(w.status) && <button className="rp-btn ghost sm" style={{ marginTop: 8 }} onClick={() => cancel(w)}>{t('cancel')}</button>}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

function Methods() {
  const t = useT(); const toast = useToast();
  const [ms, setMs] = useState<Method[] | null>(null);
  const [adding, setAdding] = useState<'upi' | 'bank' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => methods().then(setMs).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const remove = async (m: Method) => {
    if (!confirm(`${t('remove')} ${m.masked}?`)) return;
    try { await removeMethod(m.id); await load(); } catch (e) { setErr((e as Error).message); }
  };
  const tone = (s: string) => (s === 'verified' ? 'green' : s === 'failed' ? 'red' : 'amber');
  const label = (s: string) => t(s === 'verified' ? 'verifiedMethod' : s === 'failed' ? 'failedMethod' : 'pendingMethod');
  return (
    <>
      <ErrorNote error={err} />
      <section className="rp-section rp-card">
        <h2 style={{ marginBottom: 6 }}>{t('methods')}</h2>
        {ms === null ? <p className="rp-empty">…</p> : ms.length === 0 ? <p className="rp-meta">{t('needVerifiedMethod')}</p> : ms.map((m) => (
          <div key={m.id} className="rp-list-item">
            <span style={{ fontSize: 24 }}>{m.kind === 'upi' ? '⚡' : '🏦'}</span>
            <div className="grow">
              <div className="title">{m.kind === 'upi' ? 'UPI' : m.bank_name ?? 'Bank'} · {m.masked}</div>
              <div className="rp-meta">{m.holder_name}{m.ifsc ? ` · ${m.ifsc}` : ''}{m.is_default ? ' · ★' : ''}</div>
              {m.verification_note && m.verification_status === 'failed' && <div className="rp-hint">{m.verification_note}</div>}
            </div>
            <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
              <span className={`rp-status ${tone(m.verification_status)}`}>{label(m.verification_status)}</span>
              <button className="rp-btn ghost sm" onClick={() => remove(m)}>{t('remove')}</button>
            </div>
          </div>
        ))}
        <div className="rp-row" style={{ marginTop: 12 }}>
          <button className="rp-btn dark grow" onClick={() => setAdding('upi')}>⚡ {t('addUpi')}</button>
          <button className="rp-btn ghost grow" onClick={() => setAdding('bank')}>🏦 {t('addBank')}</button>
        </div>
        <p className="rp-hint" style={{ marginTop: 12 }}>🔒 Payment details are encrypted and only shown to you masked. The Chatimpu finance team verifies each method before the first payout. A mobile number alone is not accepted.</p>
      </section>
      {adding && <AddMethod kind={adding} onClose={() => setAdding(null)} onAdded={() => { setAdding(null); toast(t('pendingMethod')); load(); }} />}
    </>
  );
}

function AddMethod({ kind, onClose, onAdded }: { kind: 'upi' | 'bank'; onClose: () => void; onAdded: () => void }) {
  const t = useT();
  const { dash } = useReporter();
  const [f, setF] = useState({ holderName: dash.profile?.full_name ?? '', upi: '', accountNumber: '', confirm: '', ifsc: '', bankName: '', makeDefault: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mismatch = kind === 'bank' && f.confirm.length > 0 && f.confirm !== f.accountNumber;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await addMethod(kind === 'upi' ? { kind, holderName: f.holderName, upi: f.upi, makeDefault: f.makeDefault }
        : { kind, holderName: f.holderName, accountNumber: f.accountNumber, ifsc: f.ifsc, bankName: f.bankName, makeDefault: f.makeDefault });
      onAdded();
    } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="rp-sheet-bg" onClick={onClose}>
      <form className="rp-sheet" role="dialog" aria-modal="true" aria-label={kind === 'upi' ? t('addUpi') : t('addBank')} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 style={{ marginBottom: 14 }}>{kind === 'upi' ? t('addUpi') : t('addBank')}</h2>
        <div className="rp-field"><label htmlFor="m-h">{t('holderName')}</label><input id="m-h" className="rp-input" autoComplete="name" value={f.holderName} onChange={(e) => setF({ ...f, holderName: e.target.value })} /></div>
        {kind === 'upi' ? (
          <div className="rp-field"><label htmlFor="m-u">{t('upiId')}</label><input id="m-u" className="rp-input" autoCapitalize="none" placeholder="name@okaxis" value={f.upi} onChange={(e) => setF({ ...f, upi: e.target.value.trim() })} /></div>
        ) : (
          <>
            <div className="rp-field"><label htmlFor="m-a">{t('accountNumber')}</label><input id="m-a" className="rp-input" inputMode="numeric" autoComplete="off" value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 18) })} /></div>
            <div className="rp-field"><label htmlFor="m-c">{t('confirmAccount')}</label><input id="m-c" className="rp-input" inputMode="numeric" autoComplete="off" onPaste={(e) => e.preventDefault()} value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value.replace(/\D/g, '').slice(0, 18) })} />
              {mismatch && <span className="rp-hint" style={{ color: 'var(--red)' }}>✕</span>}</div>
            <div className="rp-row">
              <div className="rp-field grow"><label htmlFor="m-i">{t('ifsc')}</label><input id="m-i" className="rp-input" autoCapitalize="characters" maxLength={11} value={f.ifsc} onChange={(e) => setF({ ...f, ifsc: e.target.value.toUpperCase() })} /></div>
              <div className="rp-field grow"><label htmlFor="m-b">{t('bankName')}</label><input id="m-b" className="rp-input" value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} /></div>
            </div>
          </>
        )}
        <label className="rp-check" style={{ marginBottom: 14 }}><input type="checkbox" checked={f.makeDefault} onChange={(e) => setF({ ...f, makeDefault: e.target.checked })} />Default</label>
        <ErrorNote error={err} />
        <div className="rp-row">
          <button type="button" className="rp-btn ghost" onClick={onClose}>{t('cancel')}</button>
          <button className="rp-btn primary grow" disabled={busy || mismatch || (kind === 'bank' ? !f.accountNumber || f.confirm !== f.accountNumber || f.ifsc.length !== 11 : !f.upi.includes('@'))}>{busy ? t('saving') : t('save')}</button>
        </div>
      </form>
    </div>
  );
}
