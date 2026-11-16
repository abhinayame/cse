import { View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Tap, Txt } from '@/components/ui';
import { storyText } from '@/lib/text';
import { timeAgo } from '@/lib/time';
import { districtById, placeName } from '@/data/locations';
import { useT } from '@/i18n';
import { categoryColors, radius } from '@/theme';
import type { Story } from '@/data/types';

export function StoryRow({ story, lang }: { story: Story; lang: string }) {
  const tr = useT();
  const txt = storyText(story, lang);
  return (
    <Tap onPress={() => router.push(`/story/${story.id}`)} scaleTo={0.98} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 }}>
      <Image source={{ uri: story.image }} style={{ width: 88, height: 88, borderRadius: radius.md }} contentFit="cover" />
      <View style={{ flex: 1, gap: 4 }}>
        <Txt v="overline" color={categoryColors[story.category]}>{tr(`cat_${story.category}`)} · {placeName(lang, districtById(story.districtId))}</Txt>
        <Txt v="title" lang={txt.lang} numberOfLines={3}>{txt.headline}</Txt>
        <Txt v="caption" muted>{story.source} · {timeAgo(story.publishedAt, tr)}</Txt>
      </View>
    </Tap>
  );
}
