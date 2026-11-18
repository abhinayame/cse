/** TDS on contributor payouts, PAN capture and finance tax reports (migrations/0007_tax.sql). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { activeReporter, actor, fails, must, service, verifiedMethod, wallet, type Actor } from './helpers.ts';
import { initiatePayout, makeProvider, simulateMockOutcome } from '../functions/_shared/payouts/service.ts';
import { addTaxProfile, exportTdsCsv } from '../functions/_shared/payouts/tax.ts';

const KEY = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 7)).toString('base64');
const envMap: Record<string, string> = { PAYOUT_PROVIDER: 'mock', PAYOUT_ENCRYPTION_KEY: KEY, RAZORPAYX_WEBHOOK_SECRET: 'whsec_tax', APP_ENV: 'development' };
const env = (k: string) => envMap[k];
const SETTINGS = { tds_enabled: true, tds_rate_bps: 1000, tds_rate_no_pan_bps: 2000, tds_threshold_paise: 50000, tds_section: '194J' };

let editor: Actor, finance: Actor;
before(async () => {
  editor = await actor('te', { role: 'editor' });
  finance = await actor('tf', { permissions: ['finance'] });
  must(await service.from('app_settings').upsert({ key: 'withdrawal_threshold_paise', value: 10000 }));
  must(await service.from('app_settings').upsert({ key: 'max_open_withdrawals', value: 5 }));
  for (const [k, v] of Object.entries(SETTINGS)) must(await finance.db.rpc('set_setting', { p_key: k, p_value: v }));
});
after(async () => {
  for (const [k, v] of Object.entries({ tds_enabled: false, withdrawal_threshold_paise: 30000, max_open_withdrawals: 2 })) must(await service.from('app_settings').upsert({ key: k, value: v }));
});

const fy = () => {
  const d = new Date(Date.now() + 5.5 * 3600e3);
  const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
};

/** Reporter with ₹1,000 earned and a verified UPI method. */
async function funded(name: string) {
  const r = await activeReporter(name, editor);
  must(await service.rpc('credit_earning', { p_reporter: r.id, p_code: 'bonus', p_amount: 100000, p_submission: null, p_assignment: null, p_award: null, p_note: 'test balance' }));
  const method = await verifiedMethod(r, finance);
  return { r, method };
}
async function withdraw(r: Actor, method: string, rupees: number) {
  const w = must(await r.db.rpc('request_withdrawal', { p_amount_paise: rupees * 100, p_method: method })) as { id: string };
  must(await finance.db.rpc('finance_review_withdrawal', { p_id: w.id, p_decision: 'approve' }));
  return must(await service.from('withdrawal_requests').select('id, amount_paise, tds_paise, net_paise, status').eq('id', w.id).single()) as { id: string; amount_paise: number; tds_paise: number; net_paise: number; status: string };
}
async function pay(id: string, outcome: 'processed' | 'failed' = 'processed') {
  await initiatePayout(service, env, makeProvider(env, service), id, finance.id);
  await simulateMockOutcome(service, env, id, outcome);
}

test('settings: only finance can change TDS settings, with sane bounds', async () => {
  await fails(editor.db.rpc('set_setting', { p_key: 'tds_enabled', p_value: false }), /permission/);
  await fails(finance.db.rpc('set_setting', { p_key: 'tds_rate_bps', p_value: 5000 }), /between 0% and 30%/);
});

test('below the yearly threshold: no TDS; crossing it: TDS on the whole FY amount at the no-PAN rate; bank gets the net', async () => {
  const { r, method } = await funded('tds1');
  const w1 = await withdraw(r, method, 300);
  assert.deepEqual([w1.tds_paise, w1.net_paise], [0, 30000], 'under ₹500 threshold');
  await pay(w1.id);

  const w2 = await withdraw(r, method, 400); // FY total ₹700 > ₹500 → taxable ₹700 (catch-up), no PAN → 20% = ₹140
  assert.deepEqual([w2.tds_paise, w2.net_paise], [14000, 26000]);
  await pay(w2.id);
  const txn = must(await service.from('payment_transactions').select('amount_paise').eq('withdrawal_id', w2.id).single()) as { amount_paise: number };
  assert.equal(txn.amount_paise, 26000, 'provider is asked to send the NET amount');
  const d = must(await service.from('tds_deductions').select('status, taxable_paise, rate_bps, tds_paise, pan_verified, fy').eq('withdrawal_id', w2.id).single()) as Record<string, unknown>;
  assert.deepEqual(d, { status: 'deducted', taxable_paise: 70000, rate_bps: 2000, tds_paise: 14000, pan_verified: false, fy: fy() });
  // ledger still settles the gross: ₹700 left the wallet (₹560 to the bank + ₹140 TDS)
  assert.deepEqual(await wallet(r), { available_paise: 30000, reserved_paise: 0, paid_paise: 70000, lifetime_earned_paise: 100000 });
  const note = must(await r.db.from('notifications').select('title_en, body_en').eq('kind', 'payment').order('created_at', { ascending: false }).limit(1).single()) as { title_en: string; body_en: string };
  assert.match(note.title_en, /₹260\.00/); assert.match(note.body_en, /TDS ₹140\.00/);
});

test('PAN: validated, encrypted, masked, unique per account; verified PAN gets the lower rate on later payouts', async () => {
  const { r, method } = await funded('tds2');
  await assert.rejects(addTaxProfile(service, env, r.id, { pan: 'ABCD1234F', name: 'Test Reporter' }), /valid 10-character PAN/);
  const pan = `ABCPT${String(Math.floor(Math.random() * 9000) + 1000)}K`;
  const tp = await addTaxProfile(service, env, r.id, { pan: pan.toLowerCase(), name: 'Test Reporter' });
  assert.equal(tp.pan_masked, `••••••${pan.slice(-4)}`);
  const other = await activeReporter('tds2b', editor);
  await assert.rejects(addTaxProfile(service, env, other.id, { pan, name: 'Someone Else' }), /another reporter account/);
  const secret = must(await service.from('reporter_tax_secrets').select('ciphertext').eq('user_id', r.id).single()) as { ciphertext: string };
  assert.ok(!secret.ciphertext.includes(pan), 'PAN encrypted at rest');
  assert.equal((must(await r.db.from('reporter_tax_secrets').select('user_id')) as unknown[]).length, 0, 'secrets unreadable via API');
  await fails(r.db.rpc('verify_tax_profile', { p_user: r.id, p_status: 'verified' }), /Finance permission/);
  must(await finance.db.rpc('verify_tax_profile', { p_user: r.id, p_status: 'verified', p_note: 'Matches PAN card' }));
  await assert.rejects(addTaxProfile(service, env, r.id, { pan, name: 'Test Reporter' }), /already verified/);

  const w = await withdraw(r, method, 600); // over threshold in one go, verified PAN → 10% of ₹600
  assert.deepEqual([w.tds_paise, w.net_paise], [6000, 54000]);
  const summary = must(await r.db.rpc('my_tax_summary')) as { pan: { status: string; masked: string }; tds_enabled: boolean };
  assert.equal(summary.pan.status, 'verified'); assert.equal(summary.tds_enabled, true);
});

test('a failed payout voids its TDS; the retry is taxed afresh without double-counting', async () => {
  const { r, method } = await funded('tds3');
  const w = await withdraw(r, method, 600); // no PAN → 20% of ₹600 = ₹120
  assert.equal(w.tds_paise, 12000);
  await pay(w.id, 'failed');
  const d = must(await service.from('tds_deductions').select('status').eq('withdrawal_id', w.id).single()) as { status: string };
  assert.equal(d.status, 'voided');
  must(await finance.db.rpc('reconcile_withdrawal', { p_id: w.id, p_confirmed_status: 'failed', p_note: 'bank down' }));
  const retry = await withdraw(r, method, 600);
  assert.equal(retry.tds_paise, 12000, 'voided deduction does not count as already taxed');
  await pay(retry.id);
  const live = must(await service.from('tds_deductions').select('status').eq('reporter_id', r.id).neq('status', 'voided')) as unknown[];
  assert.equal(live.length, 1);
});

test('reports: per-reporter FY tax report, monthly payouts, audited TDS worksheet with full PAN; reporters see only their own', async () => {
  const { r, method } = await funded('tds4');
  const pan = `QWEPR${String(Math.floor(Math.random() * 9000) + 1000)}Z`;
  await addTaxProfile(service, env, r.id, { pan, name: 'Report Person' });
  must(await finance.db.rpc('verify_tax_profile', { p_user: r.id, p_status: 'verified' }));
  const w = await withdraw(r, method, 700);
  await pay(w.id);

  const rows = must(await finance.db.rpc('tax_report', { p_fy: fy() })) as { reporter_id: string; paid_gross_paise: number; tds_paise: number; net_paid_paise: number; pan_status: string; pan_masked: string }[];
  const mine = rows.find((x) => x.reporter_id === r.id)!;
  assert.deepEqual([mine.paid_gross_paise, mine.tds_paise, mine.net_paid_paise, mine.pan_status], [70000, 7000, 63000, 'verified']);
  assert.ok(!JSON.stringify(rows).includes(pan), 'report shows masked PANs only');
  const monthly = must(await finance.db.rpc('payout_report_monthly', { p_fy: fy() })) as { tds_paise: number; net_paise: number; gross_paise: number }[];
  assert.ok(monthly.length >= 1 && monthly.every((m) => m.gross_paise === m.net_paise + m.tds_paise));

  const csv = await exportTdsCsv(service, env, finance.id, fy());
  assert.ok(csv.includes(pan), 'worksheet carries the full PAN for the return');
  const audited = must(await service.from('audit_logs').select('id').eq('action', 'tds_worksheet_exported').eq('actor_id', finance.id)) as unknown[];
  assert.ok(audited.length >= 1);

  await fails(r.db.rpc('tax_report', { p_fy: fy() }), /Finance permission/);
  await fails(editor.db.rpc('payout_report_monthly', { p_fy: fy() }), /Finance permission/);
  const own = must(await r.db.from('tds_deductions').select('reporter_id')) as { reporter_id: string }[];
  assert.ok(own.length >= 1 && own.every((x) => x.reporter_id === r.id));
  must(await finance.db.rpc('record_tds_challan', { p_fy: fy(), p_quarter: (must(await service.from('tds_deductions').select('quarter').eq('withdrawal_id', w.id).single()) as { quarter: string }).quarter, p_challan: 'CIN-TEST-1' }));
  assert.equal((must(await service.from('tds_deductions').select('challan_ref').eq('withdrawal_id', w.id).single()) as { challan_ref: string }).challan_ref, 'CIN-TEST-1');
});
