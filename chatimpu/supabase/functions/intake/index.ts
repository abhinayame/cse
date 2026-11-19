/**
 * POST /functions/v1/intake — fetch approved news sources and queue summarised cards on the editorial desk.
 * Called by pg_cron at 05:00 and 17:00 IST (x-cron-secret) or by an editor ("Run now" in CMS → Intake).
 * Optional secret ANTHROPIC_API_KEY: AI summaries (otherwise the item's own opening sentences are used).
 * Deploy: supabase functions deploy intake --no-verify-jwt
 */
import { createClient } from '@supabase/supabase-js';
import { runIntake, type Summariser } from '../_shared/intake/index.ts';

const env = (k: string) => Deno.env.get(k);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

async function summariser(): Promise<Summariser | null> {
  if (!env('ANTHROPIC_API_KEY')) return null;
  const [{ default: Anthropic }, ai] = await Promise.all([import('@anthropic-ai/sdk'), import('../_shared/ai.ts')]);
  const client = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY') });
  return (article, lang) => ai.summarize(client, article, lang);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const db = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!);
    let startedBy: string | null = null; let edition: 'manual' | undefined;
    const secret = env('CRON_SECRET');
    if (!(secret && req.headers.get('x-cron-secret') === secret)) {
      const user = createClient(env('SUPABASE_URL')!, env('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
      const { data } = await user.auth.getUser();
      const role = data.user ? (await db.from('profiles').select('role').eq('id', data.user.id).single()).data?.role : null;
      if (!role || !['super_admin', 'editor'].includes(role)) return Response.json({ error: 'Editors only' }, { status: 403, headers: cors });
      startedBy = data.user!.id; edition = 'manual';
    }
    return Response.json(await runIntake(db, { summarise: await summariser(), startedBy, edition }), { headers: cors });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500, headers: cors });
  }
});
