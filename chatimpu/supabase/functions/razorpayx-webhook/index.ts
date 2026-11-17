/**
 * POST /functions/v1/razorpayx-webhook — configure this URL in RazorpayX → Settings → Webhooks.
 * Subscribe to payout.processed, payout.reversed, payout.failed (mandatory), payout.rejected,
 * payout.initiated, payout.queued, payout.pending and payout.updated.
 * Deploy with `--no-verify-jwt` (Razorpay cannot send a Supabase JWT; the HMAC signature is the authentication).
 * Secrets: RAZORPAYX_WEBHOOK_SECRET
 */
import { createClient } from '@supabase/supabase-js';
import { handleWebhook } from '../_shared/payouts/service.ts';

const env = (k: string) => Deno.env.get(k);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const raw = await req.text(); // the signature is over the raw body: never parse before verifying
  const db = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const r = await handleWebhook(db, env, raw, req.headers);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response('{"error":"temporary failure"}', { status: 500 }); // Razorpay will retry
  }
});
