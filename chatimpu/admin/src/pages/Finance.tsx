/**
 * Finance desk (requires the 'finance' permission; editors do not get it from their role).
 * The wallet ledger is the source of truth. A payout is only "paid" when the provider (or the bank,
 * for manual payouts with a UTR) confirms it — never because an API request was accepted.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DISTRICTS } from '@data/locations';
import { PageHead } from '../components/Layout';
import { BarList } from '../components/Charts';
import { useStore } from '../lib/store';
import { district } from '../lib/format';
import { supabase } from '../lib/supabase';
import {
  downloadCsv, exportCsv, financeSummary, ledgerCheck, loadAudit, loadMethods, loadRates, loadReporters, loadSettings, loadTxns, loadWithdrawals,
  manualFailed, manualPaid, paise, payouts, rpc, reviewWithdrawal, searchReporterIds, setSetting, updateRate, verifyMethod, when,
  exportTdsWorksheet, fyOf, loadTaxProfiles, monthlyPayouts, recordChallan, taxReport, verifyTaxProfile,
  type AuditRow, type FinanceSummary, type MethodRow, type MonthRow, type Rate, type ReporterRow, type TaxProfile, type TaxRow, type Txn, type WithdrawalRow,
} from '../newsroom/api';
import { Kpi, NeedsBackend, Status, label, useReasonDialog } from '../newsroom/ui';

type Tab = 'overview' | 'withdrawals' | 'methods' | 'rates' | 'tax' | 'audit';
interface ProviderStatus { provider: string; mode: string; production: boolean; webhookConfigured: boolean }

export default function Finance() {
  if (!supabase) return <NeedsBackend kicker="Finance" title="Payouts & earnings" />;
  return <Desk />;
}

function Desk() {
  const { toast } = useStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [providerErr, setProviderErr] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, ReporterRow>>({});
  useEffect(() => {
    payouts<ProviderStatus>({ action: 'status' }).then(setProvider).catch((e) => setProviderErr(e.message));
    loadReporters().then((r) => setNames(Object.fromEntries(r.map((x) => [x.user_id, x])))).catch((e) => toast(`⚠ ${e.message}`));
  }, [toast]);

  return (
    <>
      <PageHead kicker="Finance" title="Payouts & earnings">
        <div className="tabs">{(['overview', 'withdrawals', 'methods', 'rates', 'tax', 'audit'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{{ overview: 'Overview', withdrawals: 'Withdrawals', methods: 'Payment methods', rates: 'Rate card & rules', tax: 'Tax & reports', audit: 'Ledger & audit' }[t]}</button>
        ))}</div>
      </PageHead>
      <ProviderBanner p={provider} err={providerErr} />
      {tab === 'overview' && <Overview />}
      {tab === 'withdrawals' && <Withdrawals names={names} provider={provider} />}
      {tab === 'methods' && <Methods names={names} />}
      {tab === 'rates' && <Rates />}
      {tab === 'tax' && <Tax names={names} />}
      {tab === 'audit' && <Audit names={names} />}
    </>
  );
}

function ProviderBanner({ p, err }: { p: ProviderStatus | null; err: string | null }) {
  if (err) return <div className="banner" role="alert">⚠ Payout service unreachable ({err}). Approvals, manual payouts with UTR and reconciliation still work; deploy the <code>payouts</code> Edge Function for provider payouts.</div>;
  if (!p) return null;
  if (p.provider === 'mock') return <div className="banner">🧪 <b>Test mode — mock payout provider.</b> No money moves. Use “Simulate” to rehearse success, failure and reversal. Real payouts need RazorpayX credentials (see docs/REPORTER_ECOSYSTEM.md).</div>;
  return <div className="banner">💳 <b>RazorpayX · {p.mode === 'live' ? 'LIVE' : 'test'} mode</b>{p.webhookConfigured ? ' · webhook verified' : ' · ⚠ webhook secret not set — statuses only update on manual sync'}</div>;
}

// ── Overview ─────────────────────────────────────────────────────────────────
function Overview() {
  const { toast } = useStore();
  const [range, setRange] = useState({ from: new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) });
  const [s, setS] = useState<FinanceSummary | null>(null);
  useEffect(() => { financeSummary(range.from, range.to).then(setS).catch((e) => toast(`⚠ ${e.message}`)); }, [range, toast]);
  const w = (k: string) => s?.withdrawals?.[k] ?? { count: 0, amount_paise: 0 };
  if (!s) return <div className="card empty">Loading…</div>;
  return (
    <>
      <div className="filters"><span className="faint">Accrued in period</span>
        <input type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />–
        <input type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
      <div className="kpis">
        <Kpi label="Earnings accrued (period)" value={paise(s.accrued_paise)} sub={`${paise(s.lifetime_accrued_paise)} lifetime`} />
        <Kpi label="Liability · available balances" value={paise(s.liability_available_paise)} sub="owed, not yet requested" />
        <Kpi label="Liability · reserved" value={paise(s.liability_reserved_paise)} sub="requested / in payout" />
        <Kpi label="Paid out (lifetime)" value={paise(s.paid_paise)} tone="green" />
        <Kpi label="Awaiting approval" value={w('requested').count + w('under_review').count} sub={paise(w('requested').amount_paise + w('under_review').amount_paise)} />
        <Kpi label="Approved, not yet sent" value={w('approved').count} sub={paise(w('approved').amount_paise)} />
        <Kpi label="Processing" value={w('processing').count} sub={paise(w('processing').amount_paise)} />
        <Kpi label="Failed / reversed" value={w('failed').count + w('reversed').count} tone={w('failed').count + w('reversed').count ? 'red' : undefined} sub={paise(w('failed').amount_paise + w('reversed').amount_paise)} />
        <Kpi label="Needs reconciliation" value={s.needs_reconciliation} tone={s.needs_reconciliation ? 'red' : undefined} />
        <Kpi label="Methods to verify" value={s.unverified_methods} tone={s.unverified_methods ? 'red' : undefined} />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Monthly payouts</h2><div className="muted" style={{ marginBottom: 12 }}>Confirmed paid, last 12 months</div>
        {s.monthly_paid.length ? <BarList rows={s.monthly_paid.map((m) => ({ label: new Date(`${m.month}-01`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }), value: m.paid_paise }))} format={paise} />
          : <div className="empty">No payouts yet</div>}
      </div>
    </>
  );
}

// ── Withdrawals ──────────────────────────────────────────────────────────────
const W_TABS = ['requested', 'under_review', 'approved', 'processing', 'reconcile', 'paid', 'failed', 'reversed', 'rejected', 'cancelled', 'all'];

function Withdrawals({ names, provider }: { names: Record<string, ReporterRow>; provider: ProviderStatus | null }) {
  const { toast } = useStore();
  const [f, setF] = useState({ status: 'requested', from: '', to: '', reporter: '', district: '' });
  const [rows, setRows] = useState<WithdrawalRow[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const load = useCallback(async () => {
    try {
      const ids = f.reporter || f.district ? await searchReporterIds(f.reporter, f.district || undefined) : undefined;
      setRows(await loadWithdrawals({ status: f.status, from: f.from || undefined, to: f.to || undefined, reporterIds: ids }));
    } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  }, [f, toast]);
  useEffect(() => { load(); }, [load]);
  const current = rows?.find((r) => r.id === sel);
  const total = (rows ?? []).reduce((a, r) => a + r.amount_paise, 0);

  const exportBeneficiaries = async () => {
    const ids = picked.size ? [...picked] : (rows ?? []).filter((r) => r.status === 'approved').map((r) => r.id);
    if (!ids.length) return toast('Select approved withdrawals to export');
    if (!confirm(`Export full beneficiary details for ${ids.length} approved withdrawal(s)? This is logged in the audit trail. Store the file securely and delete it after upload to the bank.`)) return;
    try { await exportCsv(ids); toast('Payout CSV downloaded (audited)'); } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };

  return (
    <>
      <div className="filters">
        <select className="input" value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setSel(null); setPicked(new Set()); }}>
          {W_TABS.map((s) => <option key={s} value={s}>{s === 'reconcile' ? 'Needs reconciliation' : s === 'all' ? 'All statuses' : label(s)}</option>)}</select>
        <input className="input" placeholder="Reporter name" value={f.reporter} onChange={(e) => setF({ ...f, reporter: e.target.value })} />
        <select className="input" value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })}><option value="">All districts</option>{DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <input type="date" className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="From date" />
        <input type="date" className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="To date" />
        <span className="spacer" />
        <button className="btn ghost" onClick={() => downloadCsv('chatimpu-withdrawals.csv', (rows ?? []).map((r) => ({ code: r.code, reporter: names[r.reporter_id]?.full_name ?? r.reporter_id, district: district(names[r.reporter_id]?.district_id ?? ''), amount_inr: (r.amount_paise / 100).toFixed(2), status: r.status, method: `${r.method_snapshot.kind ?? ''} ${r.method_snapshot.masked ?? ''}`, requested: r.created_at, paid: r.paid_at ?? '' })))}>Report CSV</button>
        <button className="btn dark" onClick={exportBeneficiaries}>Payout file (bank)</button>
      </div>
      <div className="desk">
        <div className="card" style={{ padding: 8 }}>
          <div className="faint" style={{ padding: '4px 10px', fontSize: 12.5 }}>{rows?.length ?? 0} withdrawals · {paise(total)}</div>
          {rows === null ? <div className="empty">Loading…</div> : rows.length === 0 ? <div className="empty">Nothing here ✓</div> : rows.map((r) => (
            <div key={r.id} className="row" style={{ gap: 0, alignItems: 'stretch' }}>
              {r.status === 'approved' && <input type="checkbox" style={{ margin: '0 4px 0 8px' }} aria-label={`Include ${r.code} in the bank payout file`} checked={picked.has(r.id)} onChange={(e) => { const p = new Set(picked); if (e.target.checked) p.add(r.id); else p.delete(r.id); setPicked(p); }} />}
            <div className={`queue-item ${sel === r.id ? 'on' : ''}`} style={{ flex: 1 }} role="button" tabIndex={0} aria-pressed={sel === r.id} onClick={() => setSel(r.id)} onKeyDown={(e) => e.key === 'Enter' && setSel(r.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row"><b>{names[r.reporter_id]?.full_name ?? 'Reporter'}</b><span className="spacer" /><span className="money">{paise(r.amount_paise)}</span></div>
                <div className="row faint" style={{ fontSize: 12.5 }}>{r.code} · {r.method_snapshot.kind === 'upi' ? 'UPI' : 'Bank'} {r.method_snapshot.masked} · {when(r.created_at)}<span className="spacer" /><Status s={r.status} /></div>
                {r.needs_reconciliation && <span className="pill red" style={{ marginTop: 4 }}>Needs reconciliation</span>}
              </div>
            </div>
            </div>
          ))}
        </div>
        {current ? <WithdrawalDetail key={current.id + current.status + current.needs_reconciliation} w={current} reporter={names[current.reporter_id]} provider={provider} onChange={load} /> : <div className="card empty">Select a withdrawal</div>}
      </div>
    </>
  );
}

function WithdrawalDetail({ w, reporter, provider, onChange }: { w: WithdrawalRow; reporter?: ReporterRow; provider: ProviderStatus | null; onChange: () => Promise<void> }) {
  const { toast } = useStore();
  const { ask, dialog } = useReasonDialog();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ total: number; paid: number } | null>(null);
  const reloadTxns = useCallback(() => loadTxns(w.id).then(setTxns), [w.id]);
  useEffect(() => {
    reloadTxns().catch((e) => toast(`⚠ ${e.message}`));
    loadWithdrawals({ reporterIds: [w.reporter_id], status: 'paid' }).then((p) => setHistory({ total: p.length, paid: p.reduce((a, x) => a + x.amount_paise, 0) })).catch(() => {});
  }, [w.id, w.reporter_id, reloadTxns, toast]);
  const latest = txns[0];
  const manual = latest?.provider === 'manual';

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try { const r = await fn(); toast(typeof r === 'object' && r && 'result' in r ? `${msg} · ${String((r as { result: unknown }).result)}` : msg); await onChange(); await reloadTxns(); }
    catch (e) { toast(`⚠ ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const reject = async () => { const why = await ask('Reject withdrawal', { hint: 'The reserved amount returns to the reporter’s available balance. They see this reason.' }); if (why) run(() => reviewWithdrawal(w.id, 'reject', why), 'Rejected — balance released'); };
  const approve = async () => { if (confirm(`Approve ${paise(w.amount_paise)} to ${w.method_snapshot.masked}?`)) run(() => reviewWithdrawal(w.id, 'approve'), 'Approved'); };
  const initiate = async () => { if (confirm(`Send ${paise(w.amount_paise)} via ${provider?.provider ?? 'provider'} (${provider?.mode})?`)) run(() => payouts({ action: 'initiate', withdrawalId: w.id }), 'Payout sent to provider — waiting for confirmation'); };
  const markPaid = async () => {
    const utr = await ask('Record manual payout', { hint: 'Enter the bank UTR / reference exactly as on the bank statement. Only record this after the bank confirms the transfer.' });
    if (utr) run(() => manualPaid(w.id, utr), 'Marked paid with UTR');
  };
  const bounced = async () => {
    const why = await ask('Record bounced / reversed manual payout', { hint: 'Then reconcile to restore the reporter’s balance.' });
    if (why) run(() => manualFailed(w.id, 'reversed', why), 'Recorded as reversed — reconcile next');
  };
  const reconcile = async () => {
    const note = await ask('Reconcile', { required: manual, hint: manual ? 'Describe the bank evidence (statement line, return reference). The amount returns to the reporter’s available balance.' : 'The provider is asked for the final status first; the balance is only restored if it confirms failure or reversal.' });
    if (note === null) return;
    run(() => (manual ? rpc('reconcile_withdrawal', { p_id: w.id, p_confirmed_status: 'reversed', p_note: note }) : payouts({ action: 'reconcile', withdrawalId: w.id, note: note || undefined })), 'Reconciled');
  };

  return (
    <div className="card grid" style={{ gap: 14 }}>
      {dialog}
      <div className="row"><h2>{paise(w.amount_paise)}</h2><Status s={w.status} /><span className="spacer" /><span className="faint">{w.code}</span></div>
      {w.tds_paise > 0 && (
        <div className="warn-box" style={{ fontSize: 13 }}>
          Gross <b className="money">{paise(w.amount_paise)}</b> − TDS <b className="money">{paise(w.tds_paise)}</b> = bank receives <b className="money">{paise(w.net_paise ?? w.amount_paise - w.tds_paise)}</b>
          <span className="faint"> · deposit the TDS with the government and record the challan in Tax &amp; reports</span>
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
        <div><div className="faint">Reporter</div><b>{reporter?.full_name ?? '—'}</b>{reporter && <div className="faint">{district(reporter.district_id)} · {label(reporter.status)}</div>}</div>
        <div><div className="faint">Pay to</div><b>{w.method_snapshot.kind === 'upi' ? 'UPI' : 'Bank'} {w.method_snapshot.masked}</b><div className="faint">{w.method_snapshot.holder_name}{w.method_snapshot.ifsc ? ` · ${w.method_snapshot.ifsc}` : ''}</div></div>
        <div><div className="faint">Requested</div>{when(w.created_at)}</div>
        <div><div className="faint">Previous payouts</div>{history ? `${history.total} · ${paise(history.paid)}` : '…'}</div>
      </div>
      {w.reporter_id && reporter?.status === 'suspended' && <div className="warn-box">Reporter is suspended — review before paying.</div>}
      {w.reason && <div className="warn-box">{w.reason}</div>}
      {w.needs_reconciliation && <div className="warn-box"><b>Needs reconciliation.</b> The payout failed or was reversed. The amount stays reserved until finance confirms the outcome, so it cannot be paid twice.</div>}

      <div className="row" style={{ flexWrap: 'wrap' }}>
        {w.status === 'requested' && <button className="btn ghost" disabled={busy} onClick={() => run(() => reviewWithdrawal(w.id, 'under_review'), 'Under review')}>Start review</button>}
        {['requested', 'under_review'].includes(w.status) && <button className="btn primary" disabled={busy} onClick={approve}>Approve</button>}
        {['requested', 'under_review', 'approved'].includes(w.status) && !latest && <button className="btn danger" disabled={busy} onClick={reject}>Reject</button>}
        {w.status === 'approved' && provider && !manual && <button className="btn dark" disabled={busy} onClick={initiate}>Send payout ({provider.provider})</button>}
        {w.status === 'approved' && !latest && <button className="btn ghost" disabled={busy} onClick={markPaid}>Paid manually (UTR)…</button>}
        {['processing', 'paid'].includes(w.status) && latest && !manual && <button className="btn ghost" disabled={busy} onClick={() => run(() => payouts({ action: 'sync', withdrawalId: w.id }), 'Status synced')}>Sync status</button>}
        {w.status === 'paid' && manual && !w.needs_reconciliation && <button className="btn ghost" disabled={busy} onClick={bounced}>Bank returned it…</button>}
        {w.needs_reconciliation && <button className="btn primary" disabled={busy} onClick={reconcile}>Reconcile</button>}
      </div>
      {provider?.provider === 'mock' && latest?.provider === 'mock' && ['processing', 'paid'].includes(w.status) && (
        <div className="row" style={{ gap: 6 }}><span className="faint" style={{ fontSize: 12.5 }}>🧪 Simulate provider webhook:</span>
          {(w.status === 'processing' ? ['processed', 'failed'] : ['reversed']).map((o) => <button key={o} className="btn sm ghost" disabled={busy} onClick={() => run(() => payouts({ action: 'simulate', withdrawalId: w.id, outcome: o }), `Simulated ${o}`)}>{o}</button>)}
        </div>
      )}

      <div>
        <b>Transactions</b>
        {txns.length === 0 ? <p className="faint">No payout attempt yet.</p> : (
          <table style={{ marginTop: 6 }}><thead><tr><th>Provider</th><th>Reference</th><th>Status</th><th>UTR</th><th>Updated</th></tr></thead>
            <tbody>{txns.map((t) => (
              <tr key={t.id}><td>{t.provider} <span className="faint">{t.provider_mode}{t.payout_mode ? ` · ${t.payout_mode}` : ''}</span></td>
                <td className="faint" style={{ fontSize: 12 }}>{t.provider_payout_id ?? '—'}</td><td><Status s={t.status === 'processed' ? 'paid' : t.status} />{t.failure_reason && <div className="faint" style={{ fontSize: 12 }}>{t.failure_reason}</div>}</td>
                <td><b>{t.utr ?? '—'}</b></td><td className="faint">{when(t.updated_at)}</td></tr>
            ))}</tbody></table>
        )}
      </div>
    </div>
  );
}

// ── Payment methods ──────────────────────────────────────────────────────────
function Methods({ names }: { names: Record<string, ReporterRow> }) {
  const { toast, session } = useStore();
  const { ask, dialog } = useReasonDialog();
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<MethodRow[] | null>(null);
  const load = useCallback(() => loadMethods(status).then(setRows).catch((e) => toast(`⚠ ${e.message}`)), [status, toast]);
  useEffect(() => { load(); }, [load]);
  const decide = async (m: MethodRow, s: 'verified' | 'failed') => {
    const note = await ask(s === 'verified' ? 'Verify payment method' : 'Reject payment method', {
      required: s === 'failed', hint: s === 'verified' ? 'Confirm the beneficiary name matches the reporter (penny-drop / UPI name lookup / passbook). Optional note.' : 'Tell the reporter what is wrong.',
    });
    if (note === null) return;
    try { await verifyMethod(m.id, s, note || undefined); toast(`${m.masked}: ${s}`); load(); } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };
  return (
    <>
      {dialog}
      <div className="filters"><div className="tabs">{['pending', 'verified', 'failed', 'all'].map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{label(s)}</button>)}</div>
        <span className="faint" style={{ fontSize: 12.5 }}>Full account numbers are encrypted and never shown here. Only verified methods can receive withdrawals.</span></div>
      <div className="card table-wrap" style={{ padding: 8 }}>
        <table><thead><tr><th>Reporter</th><th>Method</th><th>Beneficiary name</th><th>Added</th><th>Status</th><th /></tr></thead>
          <tbody>{rows === null ? <tr><td colSpan={6} className="empty">Loading…</td></tr> : rows.length === 0 ? <tr><td colSpan={6} className="empty">Nothing here ✓</td></tr> : rows.map((m) => {
            const rep = names[m.reporter_id];
            const nameMismatch = rep && rep.full_name.toLowerCase().split(/\s+/)[0] !== m.holder_name.toLowerCase().split(/\s+/)[0];
            return (
              <tr key={m.id}>
                <td><b>{rep?.full_name ?? '—'}</b><div className="faint" style={{ fontSize: 12 }}>{rep ? `${district(rep.district_id)} · ${label(rep.status)}` : ''}</div></td>
                <td>{m.kind === 'upi' ? 'UPI' : m.bank_name ?? 'Bank'} {m.masked}{m.ifsc ? <div className="faint" style={{ fontSize: 12 }}>{m.ifsc}</div> : null}</td>
                <td>{m.holder_name}{nameMismatch && <div className="pill amber" style={{ marginTop: 4 }}>Name differs from profile</div>}</td>
                <td className="faint">{when(m.created_at)}</td>
                <td><Status s={m.verification_status} />{m.verification_note && <div className="faint" style={{ fontSize: 12 }}>{m.verification_note}</div>}</td>
                <td className="row" style={{ gap: 6 }}>
                  {m.reporter_id === session.userId ? <span className="faint" style={{ fontSize: 12 }}>Your own — another finance admin must verify</span> : <>
                    {m.verification_status !== 'verified' && <button className="btn sm primary" onClick={() => decide(m, 'verified')}>Verify</button>}
                    {m.verification_status !== 'failed' && <button className="btn sm ghost" onClick={() => decide(m, 'failed')}>Reject</button>}
                  </>}
                </td>
              </tr>
            );
          })}</tbody></table>
      </div>
    </>
  );
}

// ── Rate card & rules ────────────────────────────────────────────────────────
function Rates() {
  const { toast, session } = useStore();
  const [rates, setRates] = useState<Rate[]>([]);
  const [edits, setEdits] = useState<Record<string, Rate>>({});
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [threshold, setThreshold] = useState('');
  const [maxOpen, setMaxOpen] = useState('');
  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([loadRates(), loadSettings(['withdrawal_threshold_paise', 'max_open_withdrawals', 'payouts_live_enabled', 'submissions_per_day_limit'])]);
      setRates(r); setEdits({}); setSettings(s); setThreshold(String(Number(s.withdrawal_threshold_paise ?? 30000) / 100)); setMaxOpen(String(s.max_open_withdrawals ?? 2));
    } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  const save = async (code: string) => {
    const r = edits[code];
    try { await updateRate(r); toast(`${r.label_en} updated (applies to future approvals only)`); load(); } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };
  const saveSetting = async (key: string, value: unknown, msg: string) => {
    try { await setSetting(key, value); toast(msg); load(); } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };
  const live = settings.payouts_live_enabled === true || settings.payouts_live_enabled === 'true';
  return (
    <>
      <div className="card table-wrap" style={{ padding: 8 }}>
        <h2 style={{ padding: '8px 10px' }}>Contribution rate card</h2>
        <p className="faint" style={{ padding: '0 10px', margin: 0 }}>Editors pick a contribution type when approving; the amount must fall in this range. Changes never alter earnings already credited.</p>
        <table><thead><tr><th>Contribution</th><th>Telugu label</th><th>Min ₹</th><th>Max ₹</th><th>Active</th><th /></tr></thead>
          <tbody>{rates.map((r) => {
            const e = edits[r.code] ?? r; const changed = !!edits[r.code];
            const set = (patch: Partial<Rate>) => setEdits({ ...edits, [r.code]: { ...e, ...patch } });
            return (
              <tr key={r.code}>
                <td><input className="input" value={e.label_en} onChange={(x) => set({ label_en: x.target.value })} /><div className="faint" style={{ fontSize: 12 }}>{r.code}</div></td>
                <td><input className="input te-body" value={e.label_te} onChange={(x) => set({ label_te: x.target.value })} /></td>
                <td>{r.admin_defined ? <span className="faint">per assignment / award</span> : <input className="input" style={{ width: 90 }} type="number" min={0} step={1} value={e.min_paise / 100} onChange={(x) => set({ min_paise: Math.round(Number(x.target.value) * 100) })} />}</td>
                <td>{r.admin_defined ? '' : <input className="input" style={{ width: 90 }} type="number" min={0} step={1} value={e.max_paise / 100} onChange={(x) => set({ max_paise: Math.round(Number(x.target.value) * 100) })} />}</td>
                <td><label className="switch"><input type="checkbox" checked={e.active} onChange={(x) => set({ active: x.target.checked })} /></label></td>
                <td>{changed && <button className="btn sm dark" onClick={() => save(r.code)}>Save</button>}</td>
              </tr>
            );
          })}</tbody></table>
      </div>
      <div className="grid cols-4" style={{ marginTop: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <div className="card grid" style={{ gap: 8 }}>
          <h2>Withdrawal threshold</h2>
          <p className="faint" style={{ margin: 0 }}>Minimum available balance a reporter needs before requesting a withdrawal. Pending earnings never count.</p>
          <div className="row"><span>₹</span><input className="input" type="number" min={1} max={100000} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            <button className="btn dark" disabled={Math.round(Number(threshold) * 100) === Number(settings.withdrawal_threshold_paise)} onClick={() => saveSetting('withdrawal_threshold_paise', Math.round(Number(threshold) * 100), `Threshold set to ₹${threshold}`)}>Save</button></div>
        </div>
        <div className="card grid" style={{ gap: 8 }}>
          <h2>Open requests per reporter</h2>
          <p className="faint" style={{ margin: 0 }}>Limits how many withdrawals one reporter can have in progress.</p>
          <div className="row"><input className="input" type="number" min={1} max={10} value={maxOpen} onChange={(e) => setMaxOpen(e.target.value)} />
            <button className="btn dark" disabled={Number(maxOpen) === Number(settings.max_open_withdrawals)} onClick={() => saveSetting('max_open_withdrawals', Number(maxOpen), 'Limit saved')}>Save</button></div>
        </div>
        <div className="card grid" style={{ gap: 8 }}>
          <h2>Live payouts</h2>
          <p className="faint" style={{ margin: 0 }}>Master switch for sending real money through RazorpayX live mode. Keep off until credentials, IP allowlisting and a test-mode rehearsal are complete.</p>
          <div className="row"><Status s={live ? 'active' : 'suspended'} /><span>{live ? 'Enabled' : 'Disabled'}</span><span className="spacer" />
            {session.role === 'super_admin' || session.permissions?.includes('finance')
              ? <button className={`btn ${live ? 'ghost' : 'danger'}`} onClick={() => { if (confirm(live ? 'Disable live payouts?' : 'Enable LIVE payouts? Real money will move.')) saveSetting('payouts_live_enabled', !live, live ? 'Live payouts disabled' : 'Live payouts enabled'); }}>{live ? 'Disable' : 'Enable live payouts'}</button> : null}</div>
        </div>
      </div>
    </>
  );
}

// ── Tax & reports ────────────────────────────────────────────────────────────
function Tax({ names }: { names: Record<string, ReporterRow> }) {
  const { toast, session } = useStore();
  const { ask, dialog } = useReasonDialog();
  const [fy, setFy] = useState(fyOf());
  const [rows, setRows] = useState<TaxRow[] | null>(null);
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [pans, setPans] = useState<TaxProfile[]>([]);
  const [cfg, setCfg] = useState({ enabled: false, section: '194J', rate: '10', noPan: '20', threshold: '50000' });
  const [quarter, setQuarter] = useState('');
  const load = useCallback(async () => {
    try {
      const [r, m, p, s] = await Promise.all([taxReport(fy), monthlyPayouts(fy), loadTaxProfiles('pending'),
        loadSettings(['tds_enabled', 'tds_section', 'tds_rate_bps', 'tds_rate_no_pan_bps', 'tds_threshold_paise'])]);
      setRows(r); setMonths(m); setPans(p);
      setCfg({ enabled: s.tds_enabled === true || s.tds_enabled === 'true', section: String(s.tds_section ?? '194J'), rate: String(Number(s.tds_rate_bps ?? 1000) / 100),
        noPan: String(Number(s.tds_rate_no_pan_bps ?? 2000) / 100), threshold: String(Number(s.tds_threshold_paise ?? 5000000) / 100) });
    } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  }, [fy, toast]);
  useEffect(() => { load(); }, [load]);
  const fys = Array.from({ length: 4 }, (_, i) => { const y = Number(fyOf().slice(0, 4)) - i; return `${y}-${String((y + 1) % 100).padStart(2, '0')}`; });
  const saveCfg = async () => {
    try {
      await setSetting('tds_section', cfg.section.trim());
      await setSetting('tds_rate_bps', Math.round(Number(cfg.rate) * 100));
      await setSetting('tds_rate_no_pan_bps', Math.round(Number(cfg.noPan) * 100));
      await setSetting('tds_threshold_paise', Math.round(Number(cfg.threshold) * 100));
      toast('TDS settings saved (apply to withdrawals approved from now on)'); load();
    } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };
  const toggle = async () => {
    if (!confirm(cfg.enabled ? 'Turn TDS off? Withdrawals approved from now on are paid gross.' : `Turn TDS on? From now on, approvals deduct ${cfg.rate}% (${cfg.noPan}% without a verified PAN) once a reporter's payouts this financial year exceed ₹${cfg.threshold}. Confirm these values with your CA first.`)) return;
    try { await setSetting('tds_enabled', !cfg.enabled); toast(cfg.enabled ? 'TDS turned off' : 'TDS turned on'); load(); } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };
  const decidePan = async (p: TaxProfile, status: 'verified' | 'failed') => {
    const note = await ask(status === 'verified' ? `Verify PAN ${p.pan_masked}` : `Reject PAN ${p.pan_masked}`, { required: status === 'failed', hint: status === 'verified' ? 'Confirm the name matches the PAN card / Income-tax portal. Optional note.' : 'Tell the reporter what is wrong.' });
    if (note === null) return;
    try { await verifyTaxProfile(p.user_id, status, note || undefined); toast(`PAN ${status}`); load(); } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };
  const challan = async () => {
    if (!quarter) return toast('Choose a quarter first');
    const ref = await ask(`Record challan for ${fy} ${quarter}`, { hint: 'CIN / BSR code + challan serial from the bank receipt. Applied to every deducted, unrecorded TDS row of that quarter.' });
    if (!ref) return;
    try { const n = await recordChallan(fy, quarter, ref); toast(`Challan recorded on ${n} deduction(s)`); load(); } catch (e) { toast(`⚠ ${(e as Error).message}`); }
  };
  const tot = (rows ?? []).reduce((a, r) => ({ gross: a.gross + r.paid_gross_paise, tds: a.tds + r.tds_paise, net: a.net + r.net_paid_paise, prov: a.prov + r.provisional_tds_paise }), { gross: 0, tds: 0, net: 0, prov: 0 });
  return (
    <>
      {dialog}
      <div className="filters">
        <select className="input" value={fy} onChange={(e) => setFy(e.target.value)} aria-label="Financial year">{fys.map((f) => <option key={f} value={f}>FY {f}</option>)}</select>
        <select className="input" value={quarter} onChange={(e) => setQuarter(e.target.value)} aria-label="Quarter"><option value="">All quarters</option>{['Q1', 'Q2', 'Q3', 'Q4'].map((q) => <option key={q}>{q}</option>)}</select>
        <span className="spacer" />
        <button className="btn ghost" onClick={challan}>Record challan…</button>
        <button className="btn dark" onClick={async () => { if (!confirm('Download the TDS-return worksheet with FULL PANs? This is logged. Store it securely.')) return; try { await exportTdsWorksheet(fy, quarter); toast('Worksheet downloaded (audited)'); } catch (e) { toast(`⚠ ${(e as Error).message}`); } }}>TDS worksheet (26Q)</button>
      </div>
      <div className="kpis">
        <Kpi label={`Paid to reporters · FY ${fy}`} value={paise(tot.gross)} sub="gross, confirmed payouts" />
        <Kpi label="TDS deducted" value={paise(tot.tds)} sub={tot.prov ? `+ ${paise(tot.prov)} on payouts not yet confirmed` : 'to deposit with the government'} />
        <Kpi label="Sent to bank accounts" value={paise(tot.net)} tone="green" />
        <Kpi label="PANs waiting for verification" value={pans.length} tone={pans.length ? 'red' : undefined} />
      </div>
      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div className="card grid" style={{ gap: 10 }}>
          <div className="row"><h2>TDS</h2><Status s={cfg.enabled ? 'active' : 'suspended'} /><span className="faint">{cfg.enabled ? 'On' : 'Off — payouts are made gross'}</span><span className="spacer" />
            {(session.role === 'super_admin' || session.permissions?.includes('finance')) && <button className={`btn sm ${cfg.enabled ? 'ghost' : 'primary'}`} onClick={toggle}>{cfg.enabled ? 'Turn off' : 'Turn on'}</button>}</div>
          <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>Deducted when a withdrawal is approved. Once a reporter's payouts in the financial year cross the threshold, TDS applies to the whole year's amount not yet taxed. <b>These values are placeholders — confirm section, rates and threshold with your Chartered Accountant.</b></p>
          <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ margin: 0 }}><label htmlFor="tx-s">Section</label><input id="tx-s" className="input" style={{ width: 90 }} value={cfg.section} onChange={(e) => setCfg({ ...cfg, section: e.target.value })} /></div>
            <div className="field" style={{ margin: 0 }}><label htmlFor="tx-r">Rate % (PAN)</label><input id="tx-r" className="input" style={{ width: 90 }} type="number" min={0} max={30} step={0.01} value={cfg.rate} onChange={(e) => setCfg({ ...cfg, rate: e.target.value })} /></div>
            <div className="field" style={{ margin: 0 }}><label htmlFor="tx-n">Rate % (no PAN)</label><input id="tx-n" className="input" style={{ width: 90 }} type="number" min={0} max={30} step={0.01} value={cfg.noPan} onChange={(e) => setCfg({ ...cfg, noPan: e.target.value })} /></div>
            <div className="field" style={{ margin: 0 }}><label htmlFor="tx-t">Yearly threshold ₹</label><input id="tx-t" className="input" style={{ width: 120 }} type="number" min={0} value={cfg.threshold} onChange={(e) => setCfg({ ...cfg, threshold: e.target.value })} /></div>
            <button className="btn dark" onClick={saveCfg}>Save</button>
          </div>
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 8 }}>PAN verification</h2>
          {pans.length === 0 ? <p className="faint">No PANs waiting.</p> : pans.map((p) => (
            <div key={p.user_id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}><b>{names[p.user_id]?.full_name ?? 'Reporter'}</b><div className="faint" style={{ fontSize: 12.5 }}>PAN {p.pan_masked} · name on card: {p.name_on_pan} · {when(p.created_at)}</div></div>
              {p.user_id === session.userId ? <span className="faint" style={{ fontSize: 12 }}>Your own</span> : <>
                <button className="btn sm primary" onClick={() => decidePan(p, 'verified')}>Verify</button>
                <button className="btn sm ghost" onClick={() => decidePan(p, 'failed')}>Reject</button></>}
            </div>
          ))}
        </div>
      </div>
      <div className="card table-wrap" style={{ marginTop: 16, padding: 8 }}>
        <div className="filters" style={{ padding: '8px 10px', margin: 0 }}><h2>Per reporter · FY {fy}</h2><span className="spacer" />
          <button className="btn ghost sm" onClick={() => downloadCsv(`chatimpu-tax-${fy}.csv`, (rows ?? []).map((r) => ({ reporter: r.name, district: district(r.district_id), pan: r.pan_masked ?? '', pan_status: r.pan_status, payouts: r.payouts, gross_inr: (r.paid_gross_paise / 100).toFixed(2), taxable_inr: (r.taxable_paise / 100).toFixed(2), tds_inr: (r.tds_paise / 100).toFixed(2), net_inr: (r.net_paid_paise / 100).toFixed(2), challans: r.challans ?? '' })))}>CSV</button></div>
        <table><thead><tr><th>Reporter</th><th>PAN</th><th>Payouts</th><th>Gross paid</th><th>TDS</th><th>To bank</th><th>Challan</th></tr></thead>
          <tbody>{rows === null ? <tr><td colSpan={7} className="empty">Loading…</td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="empty">No payouts in FY {fy}</td></tr> : rows.map((r) => (
            <tr key={r.reporter_id}><td><b>{r.name}</b><div className="faint" style={{ fontSize: 12 }}>{district(r.district_id)}</div></td>
              <td>{r.pan_masked ?? '—'} <Status s={r.pan_status === 'missing' ? 'pending' : r.pan_status} /></td><td>{r.payouts}</td>
              <td className="money">{paise(r.paid_gross_paise)}</td><td className="money">{paise(r.tds_paise)}{r.provisional_tds_paise ? <div className="faint" style={{ fontSize: 12 }}>+{paise(r.provisional_tds_paise)} pending</div> : null}</td>
              <td className="money">{paise(r.net_paid_paise)}</td><td className="faint" style={{ fontSize: 12 }}>{r.challans ?? '—'}</td></tr>
          ))}</tbody></table>
      </div>
      <div className="card table-wrap" style={{ marginTop: 16, padding: 8 }}>
        <div className="filters" style={{ padding: '8px 10px', margin: 0 }}><h2>Monthly payouts · FY {fy}</h2><span className="spacer" />
          <button className="btn ghost sm" onClick={() => downloadCsv(`chatimpu-payouts-monthly-${fy}.csv`, months.map((m) => ({ month: m.month, payouts: m.payouts, reporters: m.reporters, gross_inr: (m.gross_paise / 100).toFixed(2), tds_inr: (m.tds_paise / 100).toFixed(2), net_inr: (m.net_paise / 100).toFixed(2) })))}>CSV</button></div>
        <table><thead><tr><th>Month</th><th>Payouts</th><th>Reporters</th><th>Gross</th><th>TDS</th><th>To bank</th></tr></thead>
          <tbody>{months.length === 0 ? <tr><td colSpan={6} className="empty">No payouts yet</td></tr> : months.map((m) => (
            <tr key={m.month}><td><b>{new Date(`${m.month}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b></td><td>{m.payouts}</td><td>{m.reporters}</td>
              <td className="money">{paise(m.gross_paise)}</td><td className="money">{paise(m.tds_paise)}</td><td className="money">{paise(m.net_paise)}</td></tr>
          ))}</tbody></table>
      </div>
    </>
  );
}

// ── Ledger & audit ───────────────────────────────────────────────────────────
function Audit({ names }: { names: Record<string, ReporterRow> }) {
  const { toast } = useStore();
  const [check, setCheck] = useState<{ reporter_id: string; field: string; wallet: number; ledger: number }[] | null>(null);
  const [log, setLog] = useState<AuditRow[]>([]);
  const [filter, setFilter] = useState('');
  useEffect(() => {
    ledgerCheck().then(setCheck).catch((e) => toast(`⚠ ${e.message}`));
    loadAudit().then(setLog).catch((e) => toast(`⚠ ${e.message}`));
  }, [toast]);
  const shown = useMemo(() => log.filter((a) => !filter || `${a.action} ${a.entity} ${a.entity_id}`.toLowerCase().includes(filter.toLowerCase())), [log, filter]);
  return (
    <>
      <div className={check && check.length === 0 ? 'ok-box' : 'warn-box'} style={{ marginBottom: 16 }}>
        {check === null ? 'Checking ledger…' : check.length === 0 ? <><b>✓ Ledger reconciled.</b> Every wallet balance equals the sum of its ledger entries.</> : (
          <><b>⚠ {check.length} wallet mismatch(es).</b> Freeze payouts for these reporters and investigate.
            {check.map((c) => <div key={c.reporter_id + c.field}>{names[c.reporter_id]?.full_name ?? c.reporter_id} · {c.field}: wallet {paise(c.wallet)} vs ledger {paise(c.ledger)}</div>)}</>
        )}
      </div>
      <div className="card table-wrap" style={{ padding: 8 }}>
        <div className="filters" style={{ padding: '8px 10px', margin: 0 }}><h2>Audit trail</h2><span className="spacer" />
          <input className="input" placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button className="btn ghost" onClick={() => downloadCsv('chatimpu-audit.csv', shown.map((a) => ({ at: a.created_at, action: a.action, entity: a.entity, id: a.entity_id, actor: a.actor_id, details: a.details })))}>CSV</button></div>
        <table><thead><tr><th>When</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>{shown.map((a) => (
            <tr key={a.id}><td className="faint">{when(a.created_at)}</td><td><b>{label(a.action)}</b></td><td className="faint">{a.entity}</td>
              <td style={{ fontSize: 12 }}>{Object.entries(a.details ?? {}).filter(([, v]) => v !== null && v !== '').map(([k, v]) => `${k}: ${k.endsWith('paise') ? paise(Number(v)) : typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ')}</td></tr>
          ))}</tbody></table>
      </div>
    </>
  );
}
