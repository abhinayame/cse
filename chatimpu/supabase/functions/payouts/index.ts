/**
 * POST /functions/v1/payouts — finance actions (requires the 'finance' permission).
 *   { action: 'initiate', withdrawalId }   send an APPROVED withdrawal to the payout provider
 *   { action: 'sync', withdrawalId }       fetch the provider status and apply it
 *   { action: 'reconcile', withdrawalId, note? }  confirm failure/reversal with the provider, restore balance
 *   { action: 'export', withdrawalIds? }   CSV with beneficiary details for manual bank payouts (audited)
 *   { action: 'simulate', withdrawalId, outcome }  mock provider only, never in production
 *   { action: 'status' }                   which provider/mode is active
 *   { action: 'tax-export', fy, quarter? } TDS-return worksheet with full PAN (audited)
 * Secrets: PAYOUT_PROVIDER (mock|razorpayx), RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET, RAZORPAYX_ACCOUNT_NUMBER,
 *          RAZORPAYX_WEBHOOK_SECRET, PAYOUT_ENCRYPTION_KEY, APP_ENV
 */
import { createClient } from '@supabase/supabase-js';
import { exportPayoutCsv, HttpError, initiatePayout, makeProvider, payoutConfig, reconcileWithdrawal, simulateMockOutcome, syncPayout } from '../_shared/payouts/service.ts';
import { cors, errorResponse, json } from '../_shared/payouts/http.ts';
import { exportTdsCsv } from '../_shared/payouts/tax.ts';

const env = (k: string) => Deno.env.get(k);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'POST only');
    const user = createClient(env('SUPABASE_URL')!, env('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data } = await user.auth.getUser();
    if (!data.user) throw new HttpError(401, 'Sign in required');
    const { data: allowed } = await user.rpc('has_permission', { p: 'finance' });
    if (allowed !== true) throw new HttpError(403, 'Finance permission required');

    const body = await req.json();
    const db = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!);
    const actor = data.user.id;
    switch (body.action) {
      case 'status': {
        const cfg = payoutConfig(env);
        const p = makeProvider(env, db);
        return json({ provider: p.name, mode: p.mode, production: cfg.production, webhookConfigured: !!cfg.webhookSecret });
      }
      case 'initiate': return json(await initiatePayout(db, env, makeProvider(env, db), body.withdrawalId, actor));
      case 'sync': return json(await syncPayout(db, makeProvider(env, db), body.withdrawalId));
      case 'reconcile': return json(await reconcileWithdrawal(db, makeProvider(env, db), body.withdrawalId, actor, body.note));
      case 'simulate': return json(await simulateMockOutcome(db, env, body.withdrawalId, body.outcome));
      case 'export': {
        const { csv } = await exportPayoutCsv(db, env, actor, body.withdrawalIds);
        return new Response(csv, { headers: { ...cors, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="chatimpu-payouts.csv"', 'Cache-Control': 'no-store' } });
      }
      case 'tax-export': {
        const csv = await exportTdsCsv(db, env, actor, body.fy, body.quarter);
        return new Response(csv, { headers: { ...cors, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="chatimpu-tds-${body.fy}${body.quarter ? '-' + body.quarter : ''}.csv"`, 'Cache-Control': 'no-store' } });
      }
      default: throw new HttpError(400, 'Unknown action');
    }
  } catch (e) {
    return errorResponse(e);
  }
});
