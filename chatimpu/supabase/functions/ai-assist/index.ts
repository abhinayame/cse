/**
 * POST /functions/v1/ai-assist
 * body: { task: 'summarize' | 'translate' | 'headlines' | 'moderate', ... }
 * Requires a signed-in staff user (super_admin / editor / district_moderator / reporter).
 * Secrets: ANTHROPIC_API_KEY (supabase secrets set ANTHROPIC_API_KEY=...)
 */
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { AiRefusalError, headlines, moderate, summarize, translate } from '../_shared/ai.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const anthropic = new Anthropic();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return json({ error: 'Sign in required' }, 401);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.user.id).single();
  if (!profile || profile.role === 'reader') return json({ error: 'Staff only' }, 403);

  try {
    const body = await req.json();
    switch (body.task) {
      case 'summarize': return json(await summarize(anthropic, String(body.article ?? ''), body.lang ?? 'en'));
      case 'translate': return json(await translate(anthropic, body.card, body.from ?? 'en', body.to ?? ['te']));
      case 'headlines': return json({ options: await headlines(anthropic, body.card, body.lang ?? 'en') });
      case 'moderate': return json(await moderate(anthropic, body.report));
      default: return json({ error: 'unknown task' }, 400);
    }
  } catch (e) {
    if (e instanceof AiRefusalError) return json({ error: e.message, refusal: true }, 422);
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'AI is busy, try again in a moment' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `AI service error (${e.status})` }, 502);
    return json({ error: (e as Error).message }, 500);
  }
});
