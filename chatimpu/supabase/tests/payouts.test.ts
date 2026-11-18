import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { activeReporter, actor, approve, fails, must, service, submitStory, wallet, type Actor } from './helpers.ts';
import { decryptJson, encryptJson, hmacHex, verifyWebhookSignature } from '../functions/_shared/payouts/crypto.ts';
import { RazorpayX } from '../functions/_shared/payouts/razorpayx.ts';
import { mockWebhookPayload } from '../functions/_shared/payouts/mock.ts';
import { addPayoutMethod, handleWebhook, initiatePayout, makeProvider, reconcileWithdrawal, simulateMockOutcome, syncPayout, exportPayoutCsv } from '../functions/_shared/payouts/service.ts';

const KEY = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 7)).toString('base64');
const SECRET = 'whsec_test_123';
const envMap: Record<string, string> = { PAYOUT_PROVIDER: 'mock', PAYOUT_ENCRYPTION_KEY: KEY, RAZORPAYX_WEBHOOK_SECRET: SECRET, APP_ENV: 'development' };
const env = (k: string) => envMap[k];

let editor: Actor, finance: Actor;
before(async () => {
  editor = await actor('pe', { role: 'editor' });
  finance = await actor('pf', { permissions: ['finance'] });
  must(await service.from('app_settings').upsert({ key: 'withdrawal_threshold_paise', value: 30000 }));
});

// ── Unit: crypto ────────────────────────────────────────────────────────────
test('AES-GCM round trip; tampering and wrong key are rejected', async () => {
  const c = await encryptJson({ accountNumber: '765432123456789', ifsc: 'HDFC0000053' }, KEY);
  assert.ok(!c.includes('765432123456789'));
  assert.deepEqual(await decryptJson(c, KEY), { accountNumber: '765432123456789', ifsc: 'HDFC0000053' });
  const [v, iv, ct] = c.split('.');
  const flipped = `${v}.${iv}.${ct.slice(0, -4)}${ct.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA'}`;
  await assert.rejects(decryptJson(flipped, KEY));
  await assert.rejects(decryptJson(c, Buffer.alloc(32, 1).toString('base64')));
});

test('webhook signature: HMAC-SHA256 of the raw body', async () => {
  const body = '{"event":"payout.processed"}';
  const sig = await hmacHex(SECRET, body);
  assert.equal(await verifyWebhookSignature(body, sig, SECRET), true);
  assert.equal(await verifyWebhookSignature(body + ' ', sig, SECRET), false, 'any change to the raw body invalidates it');
  assert.equal(await verifyWebhookSignature(body, sig, 'other'), false);
  assert.equal(await verifyWebhookSignature(body, null, SECRET), false);
});

// ── Unit: RazorpayX request shapes (per razorpay.com/docs/api/x) ───────────
test('RazorpayX client sends documented requests with Basic auth and X-Payout-Idempotency', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const body = JSON.parse(String(init.body ?? '{}'));
    const id = url.endsWith('/contacts') ? 'cont_1' : url.endsWith('/fund_accounts') ? 'fa_1' : 'pout_1';
    return new Response(JSON.stringify({ id, entity: 'payout', status: 'processing', amount: body.amount ?? 0, fund_account: { bank_account: { account_number: 'SECRET' } } }), { status: 200 });
  }) as unknown as typeof fetch;
  const rzp = new RazorpayX({ keyId: 'rzp_test_abc', keySecret: 's3cret', accountNumber: '7878780080316316', fetchImpl: fakeFetch });
  assert.equal(rzp.mode, 'test');
  await rzp.createContact({ name: 'Reporter One', referenceId: '1b4e28ba-2fa1-11d2-883f-0016d3cca427' });
  await rzp.createFundAccount('cont_1', { kind: 'upi', vpa: 'reporter@okaxis', name: 'Reporter One' });
  await rzp.createFundAccount('cont_1', { kind: 'bank', accountNumber: '765432123456789', ifsc: 'HDFC0000053', name: 'Reporter One' });
  const p = await rzp.createPayout({ idempotencyKey: 'idem-1', fundAccountId: 'fa_1', amountPaise: 30000, mode: 'UPI', referenceId: 'WDR-2611-000001', narration: 'Chatimpu Reporter Earnings!!' });

  const [contact, faUpi, faBank, payout] = calls;
  assert.equal(contact.url, 'https://api.razorpay.com/v1/contacts');
  assert.equal((contact.init.headers as Record<string, string>).Authorization, `Basic ${Buffer.from('rzp_test_abc:s3cret').toString('base64')}`);
  assert.deepEqual(JSON.parse(String(faUpi.init.body)), { contact_id: 'cont_1', account_type: 'vpa', vpa: { address: 'reporter@okaxis' } });
  assert.deepEqual(JSON.parse(String(faBank.init.body)), { contact_id: 'cont_1', account_type: 'bank_account', bank_account: { name: 'Reporter One', ifsc: 'HDFC0000053', account_number: '765432123456789' } });
  assert.equal(payout.url, 'https://api.razorpay.com/v1/payouts');
  assert.equal((payout.init.headers as Record<string, string>)['X-Payout-Idempotency'], 'idem-1');
  const pb = JSON.parse(String(payout.init.body));
  assert.deepEqual({ ...pb, notes: undefined }, { account_number: '7878780080316316', fund_account_id: 'fa_1', amount: 30000, currency: 'INR', mode: 'UPI', purpose: 'payout', queue_if_low_balance: true, reference_id: 'WDR-2611-000001', narration: 'Chatimpu Reporter Earnings', notes: undefined });
  assert.ok(pb.narration.length <= 30 && /^[A-Za-z0-9 ]+$/.test(pb.narration));
  assert.equal(JSON.stringify(p.raw).includes('SECRET'), false, 'fund account details are stripped from stored responses');
  await assert.rejects(rzp.createPayout({ idempotencyKey: '', fundAccountId: 'fa_1', amountPaise: 30000, mode: 'UPI', referenceId: 'x', narration: 'x' }), /Idempotency key is mandatory/);
  assert.equal(new RazorpayX({ keyId: 'rzp_live_x', keySecret: 'y', accountNumber: 'z', fetchImpl: fakeFetch }).mode, 'live');
});

// ── Integration ─────────────────────────────────────────────────────────────
async function readyToWithdraw(name: string) {
  const r = await activeReporter(name, editor);
  for (let i = 0; i < 3; i++) { const s = await submitStory(r); await approve(editor, s.id, 'detailed_report', 10000); }
  const s = await submitStory(r); await approve(editor, s.id, 'original_photo', 1000); // ₹310
  const m = await addPayoutMethod(service, env, r.id, { kind: 'upi', holderName: 'Reporter Test', upi: `${name}.reporter@okaxis` }) as { id: string; masked: string };
  must(await finance.db.rpc('verify_payout_method', { p_id: m.id, p_status: 'verified', p_note: 'Name matched via ₹1 test' }));
  const w = must(await r.db.rpc('request_withdrawal', { p_amount_paise: 30000, p_method: m.id })) as { id: string; code: string };
  must(await finance.db.rpc('finance_review_withdrawal', { p_id: w.id, p_decision: 'approve' }));
  return { r, m, w };
}

test('payout methods: validated, encrypted, masked, de-duplicated', async () => {
  const r = await activeReporter('pm', editor);
  await assert.rejects(addPayoutMethod(service, env, r.id, { kind: 'upi', holderName: 'Ravi', upi: 'not-a-upi' }), /valid UPI/);
  await assert.rejects(addPayoutMethod(service, env, r.id, { kind: 'bank', holderName: 'Ravi Kumar', accountNumber: '123', ifsc: 'HDFC0000053' }), /9–18 digits/);
  await assert.rejects(addPayoutMethod(service, env, r.id, { kind: 'bank', holderName: 'Ravi Kumar', accountNumber: '765432123456789', ifsc: 'HDFC000005' }), /IFSC/);
  const m = await addPayoutMethod(service, env, r.id, { kind: 'bank', holderName: 'Ravi Kumar', accountNumber: '765432123456789', ifsc: 'hdfc0000053', bankName: 'HDFC Bank' }) as Record<string, string>;
  assert.equal(m.masked, '••••••6789');
  assert.equal(m.ifsc, 'HDFC0000053');
  await assert.rejects(addPayoutMethod(service, env, r.id, { kind: 'bank', holderName: 'Ravi Kumar', accountNumber: '765 432 123 456 789', ifsc: 'HDFC0000053' }), /already added/);
  const mine = must(await r.db.from('payout_methods').select('*').eq('id', m.id).single()) as Record<string, unknown>;
  assert.equal(JSON.stringify(mine).includes('765432123456789'), false, 'reporter never receives the full account number back');
  const secret = must(await service.from('payout_method_secrets').select('ciphertext').eq('method_id', m.id).single()) as { ciphertext: string };
  assert.equal(secret.ciphertext.includes('765432123456789'), false);
});

test('mock payout: idempotent initiation, signed webhook settles, duplicates and stale events are ignored', async () => {
  const { r, w } = await readyToWithdraw('mockok');
  const provider = makeProvider(env, service);
  const first = await initiatePayout(service, env, provider, w.id, finance.id);
  const again = await initiatePayout(service, env, provider, w.id, finance.id);
  assert.equal(again.providerPayoutId, first.providerPayoutId);
  assert.equal(again.reused, true, 'second click does not create a second payout');
  const txns = must(await service.from('payment_transactions').select('id').eq('withdrawal_id', w.id)) as unknown[];
  assert.equal(txns.length, 1);
  assert.equal((must(await r.db.from('withdrawal_requests').select('status').eq('id', w.id).single()) as { status: string }).status, 'processing');
  assert.equal((await wallet(r)).reserved_paise, 30000);

  // forged webhook (bad signature) changes nothing
  const forged = JSON.stringify(mockWebhookPayload('payout.processed', { id: first.providerPayoutId, amount: 30000, status: 'processed', utr: 'FAKE' }));
  const bad = await handleWebhook(service, env, forged, new Headers({ 'x-razorpay-signature': 'deadbeef', 'x-razorpay-event-id': 'evt_forged' }));
  assert.equal(bad.status, 401);
  assert.equal((await wallet(r)).paid_paise, 0);
  // amount-mismatched (but signed) event is stored and not applied
  const wrongAmt = JSON.stringify(mockWebhookPayload('payout.processed', { id: first.providerPayoutId, amount: 3000000, status: 'processed', utr: 'X' }));
  const mm = await handleWebhook(service, env, wrongAmt, new Headers({ 'x-razorpay-signature': await hmacHex(SECRET, wrongAmt), 'x-razorpay-event-id': `evt_mm_${w.id}` }));
  assert.equal(mm.body.result, 'amount_mismatch_not_applied');

  const ok = await simulateMockOutcome(service, env, w.id, 'processed');
  assert.equal(ok.body.result, 'settled');
  // replay of a delivered event id
  const raw = JSON.stringify(mockWebhookPayload('payout.processed', { id: first.providerPayoutId, amount: 30000, status: 'processed', utr: 'U1' }));
  const sig = await hmacHex(SECRET, raw);
  const h = () => new Headers({ 'x-razorpay-signature': sig, 'x-razorpay-event-id': `evt_dup_${w.id}` });
  assert.equal((await handleWebhook(service, env, raw, h())).body.result, 'ignored');
  assert.equal((await handleWebhook(service, env, raw, h())).body.duplicate, true);
  // a late "initiated" (processing) event arriving after "processed"
  const late = JSON.stringify(mockWebhookPayload('payout.initiated', { id: first.providerPayoutId, amount: 30000, status: 'processing' }));
  assert.equal((await handleWebhook(service, env, late, new Headers({ 'x-razorpay-signature': await hmacHex(SECRET, late), 'x-razorpay-event-id': `evt_late_${w.id}` }))).body.result, 'stale_event_ignored');

  const bal = await wallet(r);
  assert.deepEqual([bal.available_paise, bal.reserved_paise, bal.paid_paise], [1000, 0, 30000]);
  const wd = must(await r.db.from('withdrawal_requests').select('status').eq('id', w.id).single()) as { status: string };
  assert.equal(wd.status, 'paid');
  assert.ok((must(await r.db.from('notifications').select('kind').eq('kind', 'payment')) as unknown[]).length >= 1, 'payment confirmation sent');
  assert.deepEqual(must(await finance.db.rpc('ledger_check')), []);
});

test('mock payout failure: reserved until reconciliation confirms it with the provider, then restored once', async () => {
  const { r, w } = await readyToWithdraw('mockfail');
  const provider = makeProvider(env, service);
  await initiatePayout(service, env, provider, w.id, finance.id);
  assert.deepEqual(await reconcileWithdrawal(service, provider, w.id, finance.id), { result: 'nothing_to_reconcile' }, 'nothing to reconcile while still processing');
  const res = await simulateMockOutcome(service, env, w.id, 'failed');
  assert.equal(res.body.result, 'failed_pending_reconciliation');
  let bal = await wallet(r);
  assert.deepEqual([bal.available_paise, bal.reserved_paise], [1000, 30000]);
  const rec = await reconcileWithdrawal(service, provider, w.id, finance.id, 'Provider shows failed');
  assert.deepEqual(rec, { providerStatus: 'failed', result: 'restored' });
  assert.deepEqual(await reconcileWithdrawal(service, provider, w.id, finance.id), { result: 'nothing_to_reconcile' });
  bal = await wallet(r);
  assert.deepEqual([bal.available_paise, bal.reserved_paise, bal.paid_paise], [31000, 0, 0]);
});

test('reversal after success: sync shows processed, webhook reverses, reconciliation restores', async () => {
  const { r, w } = await readyToWithdraw('mockrev');
  const provider = makeProvider(env, service);
  await initiatePayout(service, env, provider, w.id, finance.id);
  must(await service.from('payment_transactions').update({ response_payload: { mock_status: 'processed' } }).eq('withdrawal_id', w.id));
  assert.deepEqual(await syncPayout(service, provider, w.id), { providerStatus: 'processed', result: 'settled' });
  assert.equal((await wallet(r)).paid_paise, 30000);
  assert.equal((await simulateMockOutcome(service, env, w.id, 'reversed')).body.result, 'reversed_pending_reconciliation');
  assert.equal((await wallet(r)).paid_paise, 30000, 'paid until reconciled');
  assert.equal((await reconcileWithdrawal(service, provider, w.id, finance.id)).result, 'restored');
  const bal = await wallet(r);
  assert.deepEqual([bal.available_paise, bal.reserved_paise, bal.paid_paise], [31000, 0, 0]);
  assert.deepEqual(must(await finance.db.rpc('ledger_check')), []);
});

test('only approved withdrawals can be paid; live keys need production + kill-switch; CSV export is audited', async () => {
  const r = await activeReporter('guard', editor);
  for (let i = 0; i < 3; i++) { const s = await submitStory(r); await approve(editor, s.id, 'detailed_report', 10000); }
  const m = await addPayoutMethod(service, env, r.id, { kind: 'bank', holderName: 'Guard Test', accountNumber: '50100012345678', ifsc: 'HDFC0001234' }) as { id: string };
  must(await finance.db.rpc('verify_payout_method', { p_id: m.id, p_status: 'verified' }));
  const w = must(await r.db.rpc('request_withdrawal', { p_amount_paise: 30000, p_method: m.id })) as { id: string; code: string };
  await assert.rejects(initiatePayout(service, env, makeProvider(env, service), w.id, finance.id), /only approved/);
  must(await finance.db.rpc('finance_review_withdrawal', { p_id: w.id, p_decision: 'approve' }));

  const liveEnv = (k: string) => ({ ...envMap, PAYOUT_PROVIDER: 'razorpayx', RAZORPAYX_KEY_ID: 'rzp_live_x', RAZORPAYX_KEY_SECRET: 'y', RAZORPAYX_ACCOUNT_NUMBER: '1', APP_ENV: 'production' } as Record<string, string>)[k];
  const noNet = (async () => { throw new Error('network must not be called'); }) as unknown as typeof fetch;
  await assert.rejects(initiatePayout(service, liveEnv, makeProvider(liveEnv, service, noNet), w.id, finance.id), /Live payouts are switched off/);
  const prodMock = (k: string) => ({ ...envMap, APP_ENV: 'production' } as Record<string, string>)[k];
  assert.throws(() => makeProvider(prodMock, service), /disabled in production/);

  const { csv, count } = await exportPayoutCsv(service, env, finance.id, [w.id]);
  assert.equal(count, 1);
  assert.match(csv, new RegExp(`${w.code}.*"300.00","300.00","0.00","IMPS","Guard Test","","50100012345678","HDFC0001234"`)); // net, gross, TDS
  const audit = must(await service.from('audit_logs').select('action').eq('action', 'payout_details_exported').eq('actor_id', finance.id)) as unknown[];
  assert.equal(audit.length, 1);
});
