/**
 * POST /functions/v1/send-push   (editors / super admins, or a DB webhook on stories.publish)
 * body: { storyId, kind: 'breaking' | 'local' | 'digest' | 'interests', districtIds?: string[] }
 *
 * Targets push_tokens by district + interest + per-user preferences, and sends rich notifications
 * (image + "Listen" action) through the Expo Push API, which relays to FCM / APNs.
 */
import { createClient } from '@supabase/supabase-js';

const EXPO = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: u } = await caller.auth.getUser();
  const { data: me } = u.user ? await admin.from('profiles').select('role').eq('id', u.user.id).single() : { data: null };
  if (!me || !['super_admin', 'editor', 'district_moderator'].includes(me.role)) return new Response('forbidden', { status: 403 });

  const { storyId, kind = 'local', districtIds } = await req.json();
  const { data: story } = await admin.from('stories').select('id, district_id, category_id, image_path, story_translations(lang, headline, summary)').eq('id', storyId).single();
  if (!story) return new Response('not found', { status: 404 });

  let q = admin.from('push_tokens').select('token, language, interests, prefs');
  if (kind !== 'breaking') q = q.in('district_id', districtIds ?? [story.district_id]);
  const { data: tokens } = await q;

  const texts = Object.fromEntries((story.story_translations as { lang: string; headline: string; summary: string }[]).map((t) => [t.lang, t]));
  const messages = (tokens ?? [])
    .filter((t) => t.prefs?.[kind] !== false)
    .filter((t) => kind !== 'interests' || (t.interests ?? []).includes(story.category_id))
    .map((t) => {
      const tx = texts[t.language] ?? texts.en ?? Object.values(texts)[0];
      return {
        to: t.token,
        title: kind === 'breaking' ? `🔴 ${tx.headline}` : tx.headline,
        body: tx.summary.split(/\s+/).slice(0, 22).join(' ') + '…',
        channelId: kind === 'breaking' ? 'breaking' : kind === 'digest' ? 'digest' : 'local',
        priority: kind === 'breaking' ? 'high' : 'normal',
        categoryId: 'story', // iOS category with "Listen" + "Save" actions
        richContent: { image: `${Deno.env.get('IMAGE_CDN') ?? ''}/${story.image_path}?width=600&format=webp` },
        data: { url: `chatimpu://story/${story.id}` },
      };
    });

  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const r = await fetch(EXPO, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(messages.slice(i, i + 100)) });
    if (r.ok) sent += Math.min(100, messages.length - i);
  }
  return Response.json({ targeted: messages.length, sent });
});
