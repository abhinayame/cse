/**
 * Sync published stories into Meilisearch (one index, one document per story × language).
 * Run on a schedule (every minute) or from a DB webhook on story publish:
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… MEILI_URL=… MEILI_KEY=… npx tsx supabase/search/meili-sync.ts
 * The app's search screen filters on district, category, publishedAt and lang (see app/src/app/search.tsx).
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const MEILI = process.env.MEILI_URL!;
const headers = { Authorization: `Bearer ${process.env.MEILI_KEY}`, 'Content-Type': 'application/json' };

async function main() {
  await fetch(`${MEILI}/indexes/stories/settings`, {
    method: 'PATCH', headers,
    body: JSON.stringify({
      searchableAttributes: ['headline', 'summary', 'place'],
      filterableAttributes: ['districtId', 'category', 'lang', 'publishedAt'],
      sortableAttributes: ['publishedAt', 'shares'],
    }),
  });
  const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const { data, error } = await sb.from('stories')
    .select('id, category_id, district_id, published_at, shares, mandals(name), districts(name), story_translations(lang, headline, summary)')
    .eq('status', 'published').gte('updated_at', since);
  if (error) throw error;
  const docs = (data ?? []).flatMap((s: any) => s.story_translations.map((t: any) => ({
    id: `${s.id}__${t.lang}`, storyId: s.id, lang: t.lang, headline: t.headline, summary: t.summary,
    place: `${s.mandals?.name ?? ''} ${s.districts?.name ?? ''}`, districtId: s.district_id, category: s.category_id,
    publishedAt: Math.floor(new Date(s.published_at).getTime() / 1000), shares: s.shares,
  })));
  const r = await fetch(`${MEILI}/indexes/stories/documents?primaryKey=id`, { method: 'POST', headers, body: JSON.stringify(docs) });
  console.log(`queued ${docs.length} documents`, r.status);
}
main().catch((e) => { console.error(e); process.exit(1); });
