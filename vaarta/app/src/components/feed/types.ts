import type { Ad, Story } from '@/data/types';

export type FeedItem =
  | { type: 'story'; key: string; story: Story }
  | { type: 'ad'; key: string; ad: Ad }
  | { type: 'end'; key: string };

/** Interleave a native full-screen ad every 8–10 stories (deterministic per position). */
export function withAds(stories: Story[], ads: Ad[], premium: boolean): FeedItem[] {
  const out: FeedItem[] = [];
  let sinceAd = 0;
  let adIdx = 0;
  let gap = 8;
  for (const s of stories) {
    out.push({ type: 'story', key: s.id, story: s });
    sinceAd++;
    if (!premium && ads.length && sinceAd >= gap) {
      const ad = ads[adIdx % ads.length];
      out.push({ type: 'ad', key: `ad-${ad.id}-${adIdx}`, ad });
      adIdx++;
      sinceAd = 0;
      gap = 8 + (adIdx % 3); // 8, 9, 10, 8 …
    }
  }
  out.push({ type: 'end', key: 'end' });
  return out;
}
