import { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Tap, Txt } from '@/components/ui';
import { StoryPager } from '@/components/feed/StoryPager';
import type { FeedItem } from '@/components/feed/types';
import { palette } from '@/theme';
import type { Story } from '@/data/types';

/** Flip-reader for a fixed list of stories (category, magazine, search results). */
export function CollectionReader({ title, stories }: { title: string; stories: Story[] }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const items = useMemo<FeedItem[]>(() => [...stories.map((s) => ({ type: 'story' as const, key: s.id, story: s })), { type: 'end', key: 'end' }], [stories]);
  return (
    <View style={{ flex: 1 }}>
      <StoryPager items={items} width={width} height={height} topInset={insets.top + 8} bottomInset={insets.bottom + 12}
        overlay={
          <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Tap onPress={() => router.back()} accessibilityLabel="Back" style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <Icon name="chevron-back" size={20} color={palette.white} />
            </Tap>
            <View style={{ paddingHorizontal: 14, height: 38, borderRadius: 19, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <Txt v="label" color={palette.white}>{title}</Txt>
            </View>
          </View>
        } />
    </View>
  );
}
