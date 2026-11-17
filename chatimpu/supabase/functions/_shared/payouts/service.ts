/**
 * Payout business logic shared by the Edge Functions (Deno) and the Node test suite.
 * All database writes use the service-role client; every money movement goes through the
 * ledger functions in migrations/0005_reporters.sql, which are the source of truth.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptJson, encryptJson, fingerprint, verifyWebhookSignature, hmacHex } from './crypto.ts';
import { MockProvider, mockWebhookPayload } from './mock.ts';
import { RazorpayX, sanitize } from './razorpayx.ts';
import { ProviderError, TERMINAL_FAILURES, type PayoutDestination, type PayoutProvider, type ProviderPayoutStatus } from './types.ts';

export type Env = (name: string) => string | undefined;

export class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function check<T>(r: { data: T | null; error: { message: string } | null }, what = 'Database error'): T {
  if (r.error) throw new HttpError(400, `${what}: ${r.error.message}`);
  return r.data as T;
}

// ── Configuration ───────────────────────────────────────────────────────────
export interface PayoutConfig {
  providerName: 'mock' | 'razorpayx';
  production: boolean;
  encryptionKey: string;
  webhookSecret: string;
}

export function payoutConfig(env: Env): PayoutConfig {
  const providerName = (env('PAYOUT_PROVIDER') ?? 'mock') as 'mock' | 'razorpayx';
  if (!['mock', 'razorpayx'].includes(providerName)) throw new Error('PAYOUT_PROVIDER must be mock or razorpayx');
  return {
    providerName,
    production: env('APP_ENV') === 'production',
    encryptionKey: env('PAYOUT_ENCRYPTION_KEY') ?? '',
    webhookSecret: env('RAZORPAYX_WEBHOOK_SECRET') ?? '',
  };
}

export function makeProvider(env: Env, db: SupabaseClient, fetchImpl?: typeof fetch): PayoutProvider {
  const cfg = payoutConfig(env);
  if (cfg.providerName === 'razorpayx') {
    return new RazorpayX({ keyId: env('RAZORPAYX_KEY_ID') ?? '', keySecret: env('RAZORPAYX_KEY_SECRET') ?? '', accountNumber: env('RAZORPAYX_ACCOUNT_NUMBER') ?? '', fetchImpl });
  }
  if (cfg.production) throw new HttpError(503, 'The mock payout provider is disabled in production');
  return new MockProvider({
    async get(id) {
      const t = check(await db.from('payment_transactions').select('amount_paise, status, response_payload, utr, failure_reason').eq('provider_payout_id', id).maybeSingle()) as
        { amount_paise: number; status: string; response_payload: Record<string, any>; utr: string | null; failure_reason: string | null } | null;
      if (!t) return null;
      // simulated state first; otherwise the last state the webhook handler recorded
      const status = (t.response_payload?.mock_status ?? (t.status === 'initiating' ? 'processing' : t.status)) as ProviderPayoutStatus;
      return { status, amount: t.amount_paise, utr: t.utr, reason: t.failure_reason };
    },
  });
}

/** Real money only moves with RazorpayX live keys, APP_ENV=production and the finance kill-switch on. */
async function assertPayoutsAllowed(db: SupabaseClient, env: Env, provider: PayoutProvider) {
  if (provider.name === 'mock') return;
  if (provider.mode === 'live') {
    if (env('APP_ENV') !== 'production') throw new HttpError(503, 'Live RazorpayX keys are only used when APP_ENV=production');
    const s = check(await db.from('app_settings').select('value').eq('key', 'payouts_live_enabled').maybeSingle()) as { value: unknown } | null;
    if (s?.value !== true && s?.value !== 'true') throw new HttpError(503, 'Live payouts are switched off (CMS → Finance → Rate card & rules → Live payouts)');
  }
}

// ── Payment methods ─────────────────────────────────────────────────────────
const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACC_RE = /^\d{9,18}$/;

export interface NewMethod { kind: 'upi' | 'bank'; holderName: string; upi?: string; accountNumber?: string; ifsc?: string; bankName?: string; makeDefault?: boolean }

export function maskUpi(vpa: string) {
  const [user, handle] = vpa.split('@');
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(3, Math.min(6, user.length - 2)))}@${handle}`;
}
export const maskAccount = (acc: string) => `${'•'.repeat(6)}${acc.slice(-4)}`;

export async function addPayoutMethod(db: SupabaseClient, env: Env, userId: string, input: NewMethod) {
  const cfg = payoutConfig(env);
  const holder = (input.holderName ?? '').trim().replace(/\s+/g, ' ');
  if (holder.length < 3 || holder.length > 80 || !/^[\p{L} .'-]+$/u.test(holder)) throw new HttpError(422, 'Enter the account holder name exactly as the bank shows it');

  const profile = check(await db.from('reporter_profiles').select('status').eq('user_id', userId).maybeSingle()) as { status: string } | null;
  if (!profile) throw new HttpError(403, 'Register as a reporter first');
  if (['suspended', 'rejected'].includes(profile.status)) throw new HttpError(403, `Your reporter account is ${profile.status}`);
  const active = check(await db.from('payout_methods').select('id', { count: 'exact', head: false }).eq('reporter_id', userId).eq('active', true)) as unknown[];
  if (active.length >= 5) throw new HttpError(429, 'You can keep at most 5 payment methods. Remove one first.');

  let secret: Record<string, string>, masked: string, fp: string, ifsc: string | null = null;
  if (input.kind === 'upi') {
    const vpa = (input.upi ?? '').trim().toLowerCase();
    if (!UPI_RE.test(vpa)) throw new HttpError(422, 'Enter a valid UPI ID, for example name@okaxis');
    secret = { vpa, name: holder };
    masked = maskUpi(vpa);
    fp = await fingerprint(['upi', vpa], cfg.encryptionKey);
  } else if (input.kind === 'bank') {
    const acc = (input.accountNumber ?? '').replace(/\s/g, '');
    ifsc = (input.ifsc ?? '').trim().toUpperCase();
    if (!ACC_RE.test(acc)) throw new HttpError(422, 'Account number must be 9–18 digits');
    if (!IFSC_RE.test(ifsc)) throw new HttpError(422, 'Enter a valid 11-character IFSC, for example HDFC0000053');
    secret = { accountNumber: acc, ifsc, name: holder };
    masked = maskAccount(acc);
    fp = await fingerprint(['bank', acc, ifsc], cfg.encryptionKey);
  } else {
    throw new HttpError(422, 'Choose UPI or bank account');
  }

  const ciphertext = await encryptJson(secret, cfg.encryptionKey);
  const ins = await db.from('payout_methods').insert({
    reporter_id: userId, kind: input.kind, holder_name: holder, masked, ifsc, bank_name: input.bankName?.trim() || null,
    fingerprint: fp, verification_status: 'pending', is_default: !!input.makeDefault,
  }).select('id, kind, holder_name, masked, ifsc, bank_name, verification_status, is_default, created_at').single();
  if (ins.error) {
    if (/payout_methods_fp_key|duplicate/i.test(ins.error.message)) throw new HttpError(409, 'You have already added this payment method');
    throw new HttpError(400, ins.error.message);
  }
  check(await db.from('payout_method_secrets').insert({ method_id: (ins.data as { id: string }).id, ciphertext }));
  if (input.makeDefault) check(await db.from('payout_methods').update({ is_default: false }).eq('reporter_id', userId).neq('id', (ins.data as { id: string }).id));
  return ins.data;
}

async function destinationFor(db: SupabaseClient, env: Env, methodId: string): Promise<PayoutDestination> {
  const s = check(await db.from('payout_method_secrets').select('ciphertext').eq('method_id', methodId).single()) as { ciphertext: string };
  const d = await decryptJson<{ vpa?: string; accountNumber?: string; ifsc?: string; name: string }>(s.ciphertext, payoutConfig(env).encryptionKey);
  return d.vpa ? { kind: 'upi', vpa: d.vpa, name: d.name } : { kind: 'bank', accountNumber: d.accountNumber!, ifsc: d.ifsc!, name: d.name };
}

// ── Payout initiation (finance-approved withdrawals only) ───────────────────
interface Withdrawal { id: string; code: string; reporter_id: string; amount_paise: number; status: string; payout_method_id: string; needs_reconciliation: boolean }
interface Txn { id: string; status: string; idempotency_key: string; provider: string; provider_payout_id: string | null; amount_paise: number; response_payload: Record<string, any> }

async function loadWithdrawal(db: SupabaseClient, id: string) {
  const w = check(await db.from('withdrawal_requests').select('id, code, reporter_id, amount_paise, status, payout_method_id, needs_reconciliation').eq('id', id).maybeSingle()) as Withdrawal | null;
  if (!w) throw new HttpError(404, 'Withdrawal not found');
  return w;
}
async function latestTxn(db: SupabaseClient, withdrawalId: string) {
  return check(await db.from('payment_transactions').select('id, status, idempotency_key, provider, provider_payout_id, amount_paise, response_payload')
    .eq('withdrawal_id', withdrawalId).order('created_at', { ascending: false }).limit(1).maybeSingle()) as Txn | null;
}

export async function initiatePayout(db: SupabaseClient, env: Env, provider: PayoutProvider, withdrawalId: string, actorId: string) {
  await assertPayoutsAllowed(db, env, provider);
  const w = await loadWithdrawal(db, withdrawalId);
  if (w.status !== 'approved' && w.status !== 'processing') throw new HttpError(409, `Withdrawal is ${w.status}; only approved withdrawals can be paid`);

  let txn = await latestTxn(db, w.id);
  // Already sent and known to the provider: never create a second payout — just report it.
  if (txn?.provider_payout_id) return { transactionId: txn.id, providerPayoutId: txn.provider_payout_id, status: txn.status, reused: true };
  if (txn && txn.provider !== provider.name) throw new HttpError(409, `This withdrawal already has a ${txn.provider} payout record`);

  const method = check(await db.from('payout_methods').select('id, kind, verification_status, provider_contact_id, provider_fund_account_id, reporter_id').eq('id', w.payout_method_id).single()) as
    { id: string; kind: 'upi' | 'bank'; verification_status: string; provider_contact_id: string | null; provider_fund_account_id: string | null; reporter_id: string };
  if (method.verification_status !== 'verified') throw new HttpError(409, 'Payment method is not verified');

  // Record the attempt BEFORE calling the provider. A retry after a crash/timeout reuses this
  // idempotency key, so RazorpayX maps both attempts to one payout.
  if (!txn) {
    txn = check(await db.from('payment_transactions').insert({
      withdrawal_id: w.id, provider: provider.name, provider_mode: provider.mode, idempotency_key: crypto.randomUUID(),
      payout_mode: method.kind === 'upi' ? 'UPI' : 'IMPS', amount_paise: w.amount_paise, status: 'initiating', created_by: actorId,
      request_payload: { withdrawal: w.code, mode: method.kind === 'upi' ? 'UPI' : 'IMPS', amount_paise: w.amount_paise },
    }).select('id, status, idempotency_key, provider, provider_payout_id, amount_paise, response_payload').single()) as Txn;
  }

  try {
    let contactId = method.provider_contact_id, fundAccountId = method.provider_fund_account_id;
    if (provider.name === 'razorpayx' && (!contactId || !fundAccountId)) {
      const rp = check(await db.from('reporter_profiles').select('full_name, email').eq('user_id', w.reporter_id).single()) as { full_name: string; email: string | null };
      const dest = await destinationFor(db, env, method.id);
      contactId = contactId ?? await provider.createContact({ name: rp.full_name, referenceId: w.reporter_id, email: rp.email });
      fundAccountId = await provider.createFundAccount(contactId, dest);
      check(await db.from('payout_methods').update({ provider_contact_id: contactId, provider_fund_account_id: fundAccountId }).eq('id', method.id));
    }
    const payout = await provider.createPayout({
      idempotencyKey: txn.idempotency_key, fundAccountId: fundAccountId ?? 'fa_mock', amountPaise: w.amount_paise,
      mode: method.kind === 'upi' ? 'UPI' : 'IMPS', referenceId: w.code, narration: 'Chatimpu Reporter Earnings',
      notes: { withdrawal: w.code },
    });
    if (payout.amount !== w.amount_paise) throw new HttpError(502, `Provider amount ${payout.amount} does not match withdrawal ${w.amount_paise}`);
    // A create response is only an acknowledgement: record it, never settle from it.
    const recorded = ['processed'].includes(payout.status) ? 'processing' : payout.status;
    check(await db.from('payment_transactions').update({ provider_payout_id: payout.id, status: recorded, response_payload: payout.raw, updated_at: new Date().toISOString() }).eq('id', txn.id));
    check(await db.rpc('mark_withdrawal_processing', { p_id: w.id, p_txn: txn.id, p_actor: actorId }));
    if (TERMINAL_FAILURES.includes(payout.status)) {
      await db.rpc('apply_payout_status', { p_txn: txn.id, p_status: payout.status, p_utr: null, p_failure: payout.failureReason, p_fees: null, p_tax: null, p_response: payout.raw, p_source: 'create_response' });
    }
    return { transactionId: txn.id, providerPayoutId: payout.id, status: recorded, reused: false };
  } catch (e) {
    const msg = (e as Error).message;
    // Outcome unknown (timeout / 5xx): keep 'initiating' so the next attempt reuses the same idempotency key.
    const definite = e instanceof ProviderError && !e.retryable;
    check(await db.from('payment_transactions').update({ status: definite ? 'error' : 'initiating', failure_reason: msg.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', txn.id));
    if (definite) {
      // The provider refused before creating any payout (e.g. validation error): keep the reason in
      // the audit log and drop the attempt so a corrected retry starts with a fresh key.
      await db.from('audit_logs').insert({ actor_id: actorId, action: 'payout_attempt_refused', entity: 'withdrawal_requests', entity_id: w.id, details: { error: msg.slice(0, 500) } });
      check(await db.from('payment_transactions').delete().eq('id', txn.id).is('provider_payout_id', null));
    }
    throw e instanceof HttpError ? e : new HttpError(502, msg);
  }
}

// ── Status sync & reconciliation (provider fetch = verified status) ─────────
export async function syncPayout(db: SupabaseClient, provider: PayoutProvider, withdrawalId: string) {
  const t = await latestTxn(db, withdrawalId);
  if (!t?.provider_payout_id) throw new HttpError(409, 'No provider payout for this withdrawal');
  if (t.provider !== provider.name) throw new HttpError(409, `Payout was made with ${t.provider}`);
  const p = await provider.fetchPayout(t.provider_payout_id);
  if (p.amount !== t.amount_paise) throw new HttpError(409, 'Provider amount does not match our record; not applied');
  const result = check(await db.rpc('apply_payout_status', {
    p_txn: t.id, p_status: p.status, p_utr: p.utr, p_failure: p.failureReason, p_fees: p.fees, p_tax: p.tax, p_response: p.raw, p_source: 'fetch',
  })) as string;
  return { providerStatus: p.status, result };
}

export async function reconcileWithdrawal(db: SupabaseClient, provider: PayoutProvider, withdrawalId: string, actorId: string, note?: string) {
  const w = await loadWithdrawal(db, withdrawalId);
  if (!w.needs_reconciliation) return { result: 'nothing_to_reconcile' };
  const t = await latestTxn(db, w.id);
  if (!t?.provider_payout_id || t.provider === 'manual') throw new HttpError(409, 'Manual payouts are reconciled from the finance screen with bank evidence');
  const p = await provider.fetchPayout(t.provider_payout_id);
  if (p.status === 'processed') {
    const r = check(await db.rpc('apply_payout_status', { p_txn: t.id, p_status: 'processed', p_utr: p.utr, p_failure: null, p_fees: p.fees, p_tax: p.tax, p_response: p.raw, p_source: 'reconcile' })) as string;
    return { providerStatus: p.status, result: r };
  }
  if (!TERMINAL_FAILURES.includes(p.status)) throw new HttpError(409, `Provider still reports "${p.status}". Wait for a final state (IMPS/UPI can take up to T+3 working days).`);
  await db.rpc('apply_payout_status', { p_txn: t.id, p_status: p.status, p_utr: p.utr, p_failure: p.failureReason, p_fees: null, p_tax: null, p_response: p.raw, p_source: 'reconcile' });
  const r = check(await db.rpc('reconcile_withdrawal', { p_id: w.id, p_confirmed_status: p.status, p_note: note ?? `Provider confirmed ${p.status}`, p_actor: actorId })) as string;
  return { providerStatus: p.status, result: r };
}

// ── Webhooks ────────────────────────────────────────────────────────────────
export interface WebhookResult { status: number; body: Record<string, unknown> }

/**
 * RazorpayX webhook: verifies X-Razorpay-Signature over the RAW body, de-duplicates by
 * x-razorpay-event-id, tolerates out-of-order delivery (apply_payout_status ignores stale
 * states) and refuses events whose amount does not match our transaction.
 */
export async function handleWebhook(db: SupabaseClient, env: Env, rawBody: string, headers: Headers): Promise<WebhookResult> {
  const cfg = payoutConfig(env);
  if (!cfg.webhookSecret) return { status: 503, body: { error: 'Webhook secret not configured' } };
  const valid = await verifyWebhookSignature(rawBody, headers.get('x-razorpay-signature'), cfg.webhookSecret);
  if (!valid) return { status: 401, body: { error: 'Invalid signature' } };

  let event: Record<string, any>;
  try { event = JSON.parse(rawBody); } catch { return { status: 400, body: { error: 'Invalid JSON' } }; }
  const eventId = headers.get('x-razorpay-event-id') ?? `nohdr:${await hmacHex('event', rawBody)}`;
  const entity = event?.payload?.payout?.entity as Record<string, any> | undefined;

  const ins = await db.from('payment_webhook_events').insert({
    provider: 'razorpayx', event_id: eventId, event_type: event?.event ?? null, provider_payout_id: entity?.id ?? null,
    signature_valid: true, payload: { ...event, payload: entity ? { payout: { entity: sanitize(entity) } } : {} },
  }).select('id').maybeSingle();
  if (ins.error) {
    if (/duplicate|unique/i.test(ins.error.message)) return { status: 200, body: { ok: true, duplicate: true } };
    return { status: 500, body: { error: 'Could not store event' } }; // Razorpay retries non-2xx
  }
  const rowId = (ins.data as { id: number }).id;
  const done = async (result: string) => {
    await db.from('payment_webhook_events').update({ processed_at: new Date().toISOString(), result }).eq('id', rowId);
    return { status: 200, body: { ok: true, result } };
  };

  if (!String(event?.event ?? '').startsWith('payout.') || !entity?.id) return done('ignored_event');
  if (/^payout\.downtime/.test(event.event)) return done('downtime_notice');

  let t = check(await db.from('payment_transactions').select('id, amount_paise').eq('provider_payout_id', entity.id).maybeSingle()) as { id: string; amount_paise: number } | null;
  if (!t && entity.reference_id) {
    // payout created but our process stopped before saving its id: match by withdrawal code
    const w = check(await db.from('withdrawal_requests').select('id').eq('code', entity.reference_id).maybeSingle()) as { id: string } | null;
    if (w) {
      t = check(await db.from('payment_transactions').select('id, amount_paise').eq('withdrawal_id', w.id).is('provider_payout_id', null).order('created_at', { ascending: false }).limit(1).maybeSingle()) as { id: string; amount_paise: number } | null;
      if (t) check(await db.from('payment_transactions').update({ provider_payout_id: entity.id }).eq('id', t.id));
    }
  }
  if (!t) return done('unknown_payout');
  if (Number(entity.amount) !== t.amount_paise) return done('amount_mismatch_not_applied');

  // The entity's own status is authoritative (payout.updated carries it too).
  const status = String(entity.status) as ProviderPayoutStatus;
  const result = check(await db.rpc('apply_payout_status', {
    p_txn: t.id, p_status: status, p_utr: entity.utr ?? null, p_failure: entity.status_details?.description ?? null,
    p_fees: typeof entity.fees === 'number' ? entity.fees : null, p_tax: typeof entity.tax === 'number' ? entity.tax : null,
    p_response: sanitize(entity), p_source: 'webhook',
  })) as string;
  return done(result);
}

/** Development only: change the mock payout's state and deliver a signed webhook through the real handler. */
export async function simulateMockOutcome(db: SupabaseClient, env: Env, withdrawalId: string, outcome: 'processed' | 'failed' | 'reversed') {
  const cfg = payoutConfig(env);
  if (cfg.providerName !== 'mock' || cfg.production) throw new HttpError(403, 'Simulation is only available with the mock provider outside production');
  const t = await latestTxn(db, withdrawalId);
  if (!t?.provider_payout_id || t.provider !== 'mock') throw new HttpError(409, 'No mock payout for this withdrawal');
  const utr = outcome === 'processed' ? `MOCKUTR${Date.now().toString().slice(-8)}` : null;
  const reason = outcome === 'processed' ? null : outcome === 'failed' ? 'Mock: beneficiary bank unavailable' : 'Mock: returned by beneficiary bank';
  check(await db.from('payment_transactions').update({ response_payload: { ...t.response_payload, mock_status: outcome } }).eq('id', t.id));
  const w = await loadWithdrawal(db, withdrawalId);
  const raw = JSON.stringify(mockWebhookPayload(`payout.${outcome}`, { id: t.provider_payout_id, amount: t.amount_paise, status: outcome, utr, reason, referenceId: w.code }));
  const sig = await hmacHex(cfg.webhookSecret, raw);
  return handleWebhook(db, env, raw, new Headers({ 'x-razorpay-signature': sig, 'x-razorpay-event-id': `evt_mock_${crypto.randomUUID()}` }));
}

// ── Finance export for manual (bank portal) payouts ─────────────────────────
export async function exportPayoutCsv(db: SupabaseClient, env: Env, actorId: string, withdrawalIds?: string[]) {
  let q = db.from('withdrawal_requests').select('id, code, reporter_id, amount_paise, payout_method_id, status, created_at').eq('status', 'approved');
  if (withdrawalIds?.length) q = q.in('id', withdrawalIds);
  const rows = check(await q.order('created_at')) as { id: string; code: string; reporter_id: string; amount_paise: number; payout_method_id: string; created_at: string }[];
  const names = new Map((check(await db.from('reporter_profiles').select('user_id, full_name').in('user_id', rows.map((r) => r.reporter_id).concat(['00000000-0000-0000-0000-000000000000']))) as { user_id: string; full_name: string }[]).map((r) => [r.user_id, r.full_name]));
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [['withdrawal_code', 'reporter', 'amount_inr', 'mode', 'beneficiary_name', 'upi_id', 'account_number', 'ifsc', 'requested_at'].join(',')];
  for (const r of rows) {
    const d = await destinationFor(db, env, r.payout_method_id);
    lines.push([r.code, names.get(r.reporter_id) ?? '', (r.amount_paise / 100).toFixed(2), d.kind === 'upi' ? 'UPI' : 'IMPS', d.name,
      d.kind === 'upi' ? d.vpa : '', d.kind === 'bank' ? d.accountNumber : '', d.kind === 'bank' ? d.ifsc : '', r.created_at].map(esc).join(','));
  }
  await db.from('audit_logs').insert({ actor_id: actorId, action: 'payout_details_exported', entity: 'withdrawal_requests', entity_id: null, details: { count: rows.length, codes: rows.map((r) => r.code) } });
  return { csv: lines.join('\n') + '\n', count: rows.length };
}
