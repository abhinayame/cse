import { supabase, mediaUrl } from './supabase';
import { DEMO_STATUS, type StatusCard } from '@/data/status';

/** Today's and recent status cards (newest first), in the reader's language first. */
export async function loadStatusCards(lang: string): Promise<StatusCard[]> {
  let cards = DEMO_STATUS;
  if (supabase) {
    const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const { data, error } = await supabase.from('status_cards').select('id, kind, lang, text, attribution, background, image_path, publish_on, shares')
      .eq('status', 'published').gte('publish_on', since).order('publish_on', { ascending: false }).limit(300);
    if (!error && data) cards = data.map((r) => ({ id: r.id, kind: r.kind, lang: r.lang, text: r.text, attribution: r.attribution, background: r.background, image: r.image_path ? mediaUrl(r.image_path) : null, publishOn: r.publish_on, shares: r.shares }));
  }
  return [...cards].sort((a, b) => Number(b.lang === lang) - Number(a.lang === lang) || b.publishOn.localeCompare(a.publishOn));
}

export function bumpStatusShare(id: string) {
  supabase?.rpc('bump_status_share', { p_id: id }).then(() => {}, () => {});
}
