/**
 * Daily data-retention sweep (scheduled by setup_scheduled_jobs() in migrations/0006_jobs.sql):
 * removes decided ID-document images, stale drafts (after a warning), old notifications and raw
 * webhook payloads. Ledger, payments, tax and audit records are never deleted here.
 * Deploy: supabase functions deploy maintenance --no-verify-jwt   (protected by CRON_SECRET)
 */
import { createClient } from '@supabase/supabase-js';
import { runMaintenance } from '../_shared/jobs/index.ts';

const env = (k: string) => Deno.env.get(k);

Deno.serve(async (req) => {
  const secret = env('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('forbidden', { status: 403 });
  try {
    const db = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!);
    const result = await runMaintenance(db);
    return Response.json(result, { status: result.errors.length ? 207 : 200 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
