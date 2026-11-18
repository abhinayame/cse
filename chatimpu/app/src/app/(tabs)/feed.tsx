import { useMemo, useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { Chip, Icon, Tap, Txt } from '@/components/ui';
import { StoryPager } from '@/components/feed/StoryPager';
import { FeedSkeleton } from '@/components/feed/FeedSkeleton';
import { BreakingTicker } from '@/components/feed/BreakingTicker';
import { withAds } from '@/components/feed/types';
import type { FlipFeedHandle } from '@/components/feed/FlipFeed';
import { useTabBarSpace } from '@/components/GlassTabBar';
import { useStories } from '@/hooks/useStories';
import { rankFeed, type FeedMode } from '@/lib/personalize';
import { adsFor, fetchAdFrequency } from '@/lib/api';
import { storyText } from '@/lib/text';
import { usePrefs } from '@/store/prefs';
import { useLibrary } from '@/store/library';
import { useT } from '@/i18n';
import { palette, radius } from '@/theme';

const MODES: { id: FeedMode; key: 'forYou' | 'local' | 'trending' | 'breaking' }[] = [
  { id: 'forYou', key: 'forYou' }, { id: 'local', key: 'local' }, { id: 'trending', key: 'trending' }, { id: 'breaking', key: 'breaking' },
];

export default function FeedScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const tr = useT();
  const prefs = usePrefs();
  const affinity = useLibrary((s) => s.affinity);
  const { stories, offline, loading } = useStories();
  const [mode, setMode] = useState<FeedMode>('forYou');
  const [index, setIndex] = useState(0);
  const pager = useRef<FlipFeedHandle>(null);
  const [adEvery, setAdEvery] = useState(8);
  useEffect(() => { fetchAdFrequency().then(setAdEvery).catch(() => {}); }, []);

  // Rank once per mode/load; affinity updates apply on next refresh so the deck doesn't reshuffle mid-read.
  const affinityRef = useRef(affinity);
  const items = useMemo(() => {
    if (!stories) return [];
    const ranked = rankFeed(stories, mode, {
      districtId: prefs.districtId, mandalId: prefs.mandalId, villageId: prefs.villageId, stateId: prefs.stateId,
      interests: prefs.interests, affinity: affinityRef.current,
    });
    return withAds(ranked, adsFor(prefs.districtId), prefs.premium, adEvery);
  }, [adEvery, stories, mode, prefs.districtId, prefs.mandalId, prefs.villageId, prefs.stateId, prefs.interests, prefs.premium]);

  const breaking = useMemo(() => (stories ?? []).filter((s) => s.isBreaking).map((s) => storyText(s, prefs.language).headline), [stories, prefs.language]);
  const topInset = insets.top + 8;
  const current = items[index];
  const overImage = current?.type !== 'end';

  const overlay = (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: topInset, left: 0, right: 0, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }} style={{ flex: 1 }}>
          {MODES.map((m) => (
            <Chip key={m.id} glass={overImage} small label={tr(m.key)} selected={mode === m.id}
              dot={m.id === 'breaking' ? palette.red : undefined}
              onPress={() => { setMode(m.id); setIndex(0); }} />
          ))}
        </ScrollView>
        <Tap onPress={() => router.push('/digest')} accessibilityLabel={tr('today60')} style={roundBtn}>
          <Icon name="sunny" size={18} color={palette.redBright} />
        </Tap>
        <Tap onPress={() => router.push('/search')} accessibilityLabel="Search" style={[roundBtn, { marginLeft: 8 }]}>
          <Icon name="search" size={18} color={palette.white} />
        </Tap>
      </View>
      {mode !== 'breaking' && breaking.length > 0 && index === 0 && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={{ paddingHorizontal: 14 }}>
          <BreakingTicker headlines={breaking} lang={prefs.language} onPress={() => { setMode('breaking'); setIndex(0); }} />
        </Animated.View>
      )}
      {offline && (
        <View style={{ marginHorizontal: 14, padding: 8, borderRadius: radius.md, backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <Txt v="caption" color={palette.white}>{tr('offline')}</Txt>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <FeedSkeleton width={width} height={height} bottomInset={tabSpace} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StoryPager
        key={mode}
        ref={pager}
        items={items}
        width={width}
        height={height}
        topInset={topInset}
        bottomInset={tabSpace}
        onIndexChange={setIndex}
        overlay={<>{overlay}{index === 0 && items[0]?.type === 'story' && <SwipeHint top={Math.round(height * 0.34) - 120} label={tr('swipeUp')} />}</>}
      />
    </View>
  );
}

function SwipeHint({ top, label }: { top: number; label: string }) {
  const y = useSharedValue(0);
  useEffect(() => { y.value = withRepeat(withSequence(withTiming(-6, { duration: 600 }), withTiming(0, { duration: 600 })), -1); }, [y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View pointerEvents="none" entering={FadeIn.delay(1200)} exiting={FadeOut} style={[{ position: 'absolute', top, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.55)' }, a]}>
      <Icon name="chevron-up" size={14} color={palette.redBright} />
      <Txt v="caption" color={palette.white} style={{ fontSize: 11 }}>{label}</Txt>
    </Animated.View>
  );
}

const roundBtn = { width: 38, height: 38, borderRadius: 19, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'rgba(0,0,0,0.45)' };
