/**
 * Full-screen flip reader used by Feed, Category, Magazine and Search results.
 * Handles listen (TTS), share-as-image, dwell-time learning and ad interleaving.
 */
import { forwardRef, useCallback, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { View } from 'react-native';
import { FlipFeed, type FlipFeedHandle } from './FlipFeed';
import { StoryCard } from './StoryCard';
import { AdCard } from './AdCard';
import { EndCard } from './EndCard';
import { ShareCard } from './ShareCard';
import type { FeedItem } from './types';
import { useLibrary } from '@/store/library';
import { usePrefs } from '@/store/prefs';
import { speech } from '@/lib/speech';
import { storyText } from '@/lib/text';
import { shareStoryImage } from '@/lib/share';
import { useSpeaking } from '@/hooks/useSpeaking';
import type { Story } from '@/data/types';

interface Props {
  items: FeedItem[];
  width: number;
  height: number;
  topInset: number;
  bottomInset: number;
  onIndexChange?: (i: number) => void;
  overlay?: ReactNode;
}

export const StoryPager = forwardRef<FlipFeedHandle, Props>(function StoryPager({ items, width, height, topInset, bottomInset, onIndexChange, overlay }, ref) {
  const lang = usePrefs((s) => s.language);
  const recordRead = useLibrary((s) => s.recordRead);
  const recordShare = useLibrary((s) => s.recordShare);
  const speaking = useSpeaking();
  const enteredAt = useRef(Date.now());
  const [shareStory, setShareStory] = useState<Story | null>(null);
  const shareRef = useRef<ComponentRef<typeof View>>(null);

  const onIndex = useCallback((i: number, prev: number) => {
    const p = items[prev];
    if (p?.type === 'story') recordRead(p.story, Date.now() - enteredAt.current);
    enteredAt.current = Date.now();
    if (speech.current && p?.type === 'story' && speech.current === p.story.id) speech.stop();
    onIndexChange?.(i);
  }, [items, onIndexChange, recordRead]);

  const onListen = useCallback((s: Story) => {
    if (speech.current === s.id) return speech.stop();
    const t = storyText(s, lang);
    speech.play([{ id: s.id, text: `${t.headline}. ${t.summary}`, lang: t.lang }]);
  }, [lang]);

  const onShare = useCallback((s: Story) => {
    setShareStory(s);
    recordShare(s);
    // wait for the off-screen template + its image to render before capturing
    setTimeout(async () => { await shareStoryImage(shareRef.current, s, lang); setShareStory(null); }, 450);
  }, [lang, recordShare]);

  const render = useCallback((it: FeedItem) => {
    if (it.type === 'story') {
      return <StoryCard story={it.story} width={width} height={height} topInset={topInset} bottomInset={bottomInset}
        speaking={speaking === it.story.id} onListen={onListen} onShare={onShare} />;
    }
    if (it.type === 'ad') return <AdCard ad={it.ad} width={width} height={height} bottomInset={bottomInset} />;
    return <EndCard width={width} height={height} />;
  }, [width, height, topInset, bottomInset, speaking, onListen, onShare]);

  return (
    <View style={{ width, height }}>
      <FlipFeed ref={ref} items={items} keyOf={(i) => i.key} render={render} width={width} height={height} onIndexChange={onIndex} />
      {overlay}
      {shareStory && (
        <View style={{ position: 'absolute', left: -2000, top: 0 }} pointerEvents="none">
          <ShareCard ref={shareRef} story={shareStory} lang={lang} />
        </View>
      )}
    </View>
  );
});
