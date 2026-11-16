import type { Ad, Story } from '@/data/types';

export type FeedItem =
  | { type: 'story'; key: string; story: Story }
  | { type: 'ad'; key: string; ad: Ad }
  | { type: 'end'; key: string };

/** Interleave a native full-screen ad every `every`…`every+2` stories (8–10 by default). */
export function withAds(stories: Story[], ads: Ad[], premium: boolean, every = 8): FeedItem[] {
  const out: FeedItem[] = [];
  let sinceAd = 0;
  let adIdx = 0;
  let gap = every;
  for (const s of stories) {
    out.push({ type: 'story', key: s.id, story: s });
    sinceAd++;
    if (!premium && ads.length && sinceAd >= gap) {
      const ad = ads[adIdx % ads.length];
      out.push({ type: 'ad', key: `ad-${ad.id}-${adIdx}`, ad });
      adIdx++;
      sinceAd = 0;
      gap = every + (adIdx % 3); // e.g. 8, 9, 10, 8 …
    }
  }
  out.push({ type: 'end', key: 'end' });
  return out;
}
