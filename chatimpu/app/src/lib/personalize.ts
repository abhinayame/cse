/**
 * On-device ranking. The same formula runs server-side in the `get_feed` SQL function so
 * guests and signed-in users get consistent ordering; on-device signals refine it further.
 *
 * score = 3.0·breaking + locality + 1.6·interest + 0.45·affinity + log(engagement) − age decay
 */
import type { CategoryId, Story } from '@/data/types';

export interface RankContext {
  districtId: string;
  mandalId: string;
  villageId?: string;
  stateId: string;
  interests: CategoryId[];
  affinity: Partial<Record<CategoryId, number>>;
  seen?: Set<string>;
}

export type FeedMode = 'forYou' | 'local' | 'trending' | 'breaking';

export function scoreStory(s: Story, c: RankContext, now = Date.now()) {
  const ageH = (now - new Date(s.publishedAt).getTime()) / 3_600_000;
  const locality =
    s.villageId && s.villageId === c.villageId ? 3 :
    s.mandalId === c.mandalId ? 2.4 :
    s.districtId === c.districtId ? 1.8 :
    s.stateId === c.stateId ? 0.6 : 0;
  const interest = c.interests.includes(s.category) ? 1.6 : 0;
  const affinity = 0.45 * (c.affinity[s.category] ?? 0);
  const engagement = Math.log10(1 + s.shares * 3 + s.comments * 2 + s.reactions.like) * 0.5;
  const decay = Math.log2(1 + ageH) * 0.55;
  const seenPenalty = c.seen?.has(s.id) ? 2.5 : 0;
  return (s.isBreaking ? 3 : 0) + locality + interest + affinity + engagement - decay - seenPenalty;
}

export function rankFeed(stories: Story[], mode: FeedMode, c: RankContext): Story[] {
  let pool = stories;
  if (mode === 'local') pool = stories.filter((s) => s.districtId === c.districtId);
  if (mode === 'breaking') pool = stories.filter((s) => s.isBreaking);
  if (mode === 'trending') {
    return [...stories]
      .filter((s) => s.isTrending || s.shares > 900)
      .sort((a, b) => b.shares + b.views / 20 - (a.shares + a.views / 20));
  }
  const ranked = [...pool].sort((a, b) => scoreStory(b, c) - scoreStory(a, c));
  return diversify(ranked);
}

/** Avoid more than 2 consecutive stories from the same category. */
function diversify(list: Story[]): Story[] {
  const out: Story[] = [];
  const rest = [...list];
  while (rest.length) {
    const last2 = out.slice(-2).map((s) => s.category);
    const idx = rest.findIndex((s) => !(last2.length === 2 && last2.every((c) => c === s.category)));
    out.push(rest.splice(idx === -1 ? 0 : idx, 1)[0]);
  }
  return out;
}
