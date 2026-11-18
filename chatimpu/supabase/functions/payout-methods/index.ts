/**
 * POST /functions/v1/payout-methods   { action: 'add', kind: 'upi'|'bank', holderName, upi | accountNumber+ifsc, bankName?, makeDefault? }
 *                                      { action: 'tax-profile', pan, name }   — PAN for TDS (encrypted, stored masked)
 * Reporter-only. Full details are AES-GCM encrypted server-side; the API only ever returns masked values.
 * Secrets: PAYOUT_ENCRYPTION_KEY
 */
import { createClient } from '@supabase/supabase-js';
import { addPayoutMethod, HttpError } from '../_shared/payouts/service.ts';
import { addTaxProfile } from '../_shared/payouts/tax.ts';
import { cors, errorResponse, json } from '../_shared/payouts/http.ts';

const env = (k: string) => Deno.env.get(k);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'POST only');
    const user = createClient(env('SUPABASE_URL')!, env('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data } = await user.auth.getUser();
    if (!data.user) throw new HttpError(401, 'Sign in required');
    const body = await req.json();
    const admin = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!);
    if (body.action === 'add') return json({ method: await addPayoutMethod(admin, env, data.user.id, body) });
    if (body.action === 'tax-profile') return json({ taxProfile: await addTaxProfile(admin, env, data.user.id, body) });
    throw new HttpError(400, 'Unknown action');
  } catch (e) {
    return errorResponse(e);
  }
});
