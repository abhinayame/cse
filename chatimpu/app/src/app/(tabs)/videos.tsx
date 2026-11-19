import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, View, useWindowDimensions, type ListViewToken } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { VideoItem } from '@/components/VideoItem';
import { useTabBarSpace } from '@/components/GlassTabBar';
import { Shimmer, Txt } from '@/components/ui';
import { fetchVideos } from '@/lib/api';
import { usePrefs } from '@/store/prefs';
import { useT } from '@/i18n';
import { palette } from '@/theme';
import type { VideoStory } from '@/data/types';

export default function Videos() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const focused = useIsFocused();
  const tr = useT();
  const { language, autoplay, districtId } = usePrefs();
  const [videos, setVideos] = useState<VideoStory[] | null>(null);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    fetchVideos().then((v) => setVideos([...v].sort((a, b) => Number(b.districtId === districtId) - Number(a.districtId === districtId))));
  }, [districtId]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index != null) setActive(first.index);
  }).current;

  const render = useCallback(({ item, index }: { item: VideoStory; index: number }) => (
    <VideoItem video={item} active={focused && index === active} width={width} height={height} muted={muted} onToggleMute={() => setMuted((m) => !m)}
      lang={language} bottomInset={tabSpace} autoplay={autoplay} topInset={insets.top} />
  ), [active, focused, width, height, muted, language, tabSpace, autoplay, insets.top]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {focused && <StatusBar style="light" />}
      {!videos ? <Shimmer style={{ width, height, borderRadius: 0 }} /> : (
        <FlatList
          data={videos}
          keyExtractor={(v) => v.id}
          renderItem={render}
          pagingEnabled
          snapToInterval={height}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          removeClippedSubviews
        />
      )}
      <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 10, left: 20 }}>
        <Txt v="h2" color={palette.white}>{tr('newsReels')}</Txt>
      </View>
    </View>
  );
}
