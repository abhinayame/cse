/**
 * Delivers unsent in-app notifications as push messages (Expo → FCM/APNs), reusing the
 * push_tokens registered by the reader app. Run every minute with pg_cron + pg_net or a
 * scheduled trigger. Protected by the CRON_SECRET header.
 */
import { createClient } from '@supabase/supabase-js';

const env = (k: string) => Deno.env.get(k);

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== env('CRON_SECRET') || !env('CRON_SECRET')) return new Response('forbidden', { status: 403 });
  const db = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: items } = await db.from('notifications').select('id, user_id, title_en, title_te, body_en, body_te, link').is('push_sent_at', null).order('created_at').limit(200);
  if (!items?.length) return Response.json({ sent: 0 });
  const userIds = [...new Set(items.map((n) => n.user_id))];
  const { data: tokens } = await db.from('push_tokens').select('token, user_id, language').in('user_id', userIds);
  const messages = items.flatMap((n) => (tokens ?? []).filter((t) => t.user_id === n.user_id).map((t) => ({
    to: t.token,
    title: t.language === 'te' && n.title_te ? n.title_te : n.title_en,
    body: (t.language === 'te' && n.body_te ? n.body_te : n.body_en) ?? undefined,
    data: { url: n.link ? `chatimpu:/${n.link}` : undefined },
    channelId: 'local',
  })));
  for (let i = 0; i < messages.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(messages.slice(i, i + 100)) });
  }
  await db.from('notifications').update({ push_sent_at: new Date().toISOString() }).in('id', items.map((n) => n.id));
  return Response.json({ notifications: items.length, pushes: messages.length });
});
