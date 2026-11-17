/**
 * Delivers in-app notifications (reporter account, editorial and payment events) as push messages
 * through Expo → FCM / APNs, reusing the push_tokens registered by the app. Scheduled every minute by
 * setup_scheduled_jobs() (migrations/0006_jobs.sql). Protected by the CRON_SECRET header.
 * Deploy: supabase functions deploy notify-dispatch --no-verify-jwt
 */
import { createClient } from '@supabase/supabase-js';
import { dispatchPushes } from '../_shared/jobs/index.ts';

const env = (k: string) => Deno.env.get(k);

Deno.serve(async (req) => {
  const secret = env('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('forbidden', { status: 403 });
  try {
    const db = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!);
    return Response.json(await dispatchPushes(db));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
