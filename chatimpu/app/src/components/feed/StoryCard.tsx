import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Icon, Tap, Txt } from '@/components/ui';
import { ReactionButton } from './Reactions';
import { categoryColors, palette, radius, useTheme } from '@/theme';
import { useT } from '@/i18n';
import { usePrefs } from '@/store/prefs';
import { useLibrary } from '@/store/library';
import { storyText } from '@/lib/text';
import { compact, timeAgo } from '@/lib/time';
import { districtById, mandalById, placeName, villageById } from '@/data/locations';
import type { Story } from '@/data/types';

interface Props {
  story: Story;
  width: number;
  height: number;
  topInset: number;
  bottomInset: number;
  speaking: boolean;
  onListen: (s: Story) => void;
  onShare: (s: Story) => void;
}

export function StoryCard({ story, width, height, topInset, bottomInset, speaking, onListen, onShare }: Props) {
  const t = useTheme();
  const tr = useT();
  const lang = usePrefs((s) => s.language);
  const saved = useLibrary((s) => s.bookmarks.includes(story.id));
  const toggle = useLibrary((s) => s.toggleBookmark);
  const txt = storyText(story, lang);
  const imgH = Math.round(height * 0.4);
  const [bodyH, setBodyH] = useState(0);
  const lineH = Math.round(25 * t.lh(txt.lang));
  const lines = bodyH ? Math.max(2, Math.floor(bodyH / lineH)) : 6;
  const place = placeName(lang, villageById(story.villageId ?? '') ?? mandalById(story.mandalId)) + ', ' + placeName(lang, districtById(story.districtId));
  const catColor = categoryColors[story.category];

  return (
    <View style={{ width, height, backgroundColor: t.colors.bg }}>
      <View style={{ height: imgH + 24 }}>
        <Image
          source={{ uri: story.image }}
          style={{ width, height: imgH + 24 }}
          contentFit="cover"
          transition={300}
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityLabel={txt.headline}
        />
        <LinearGradient colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: topInset + 90 }} />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 140 }} />
        <View style={{ position: 'absolute', left: 20, bottom: 40, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {story.isBreaking && (
            <View style={{ backgroundColor: palette.red, paddingHorizontal: 10, height: 26, borderRadius: radius.xs, justifyContent: 'center' }}>
              <Txt v="overline" color={palette.white}>{tr('breakingNews')}</Txt>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 26, borderRadius: radius.xs, backgroundColor: 'rgba(0,0,0,0.55)' }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: catColor }} />
            <Txt v="label" color={palette.white}>{tr(`cat_${story.category}`)}</Txt>
          </View>
          {story.sponsor && (
            <View style={{ paddingHorizontal: 10, height: 26, borderRadius: radius.xs, backgroundColor: palette.red, justifyContent: 'center' }}>
              <Txt v="overline" color={palette.white}>{tr('sponsored')}</Txt>
            </View>
          )}
        </View>
      </View>

      <View style={{ flex: 1, marginTop: -24, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: t.colors.bg, paddingHorizontal: 22, paddingTop: 20, paddingBottom: bottomInset + 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Txt v="overline" color={t.colors.accentText} numberOfLines={1} style={{ flexShrink: 2 }}>{story.sponsor ?? story.source}</Txt>
          <Icon name="location-sharp" size={12} color={t.colors.textMuted} />
          <Txt v="caption" muted numberOfLines={1} style={{ flexShrink: 1 }}>{place}</Txt>
          <Txt v="caption" muted numberOfLines={1} style={{ flexShrink: 0 }}>· {timeAgo(story.publishedAt, tr)}</Txt>
        </View>

        <Txt v="h2" lang={txt.lang} numberOfLines={3}>{txt.headline}</Txt>
        <View style={{ width: 36, height: 2, backgroundColor: t.colors.accent, marginVertical: 12, borderRadius: 1 }} />
        <View style={{ flex: 1, overflow: 'hidden' }} onLayout={(e) => setBodyH(e.nativeEvent.layout.height)}>
          <Txt v="body" lang={txt.lang} numberOfLines={lines} style={{ color: t.dark ? '#DADADA' : '#262626' }}>{txt.summary}</Txt>
        </View>

        {story.reporter?.citizen && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 8 }}>
            <Icon name="shield-checkmark" size={14} color={t.colors.success} />
            <Txt v="caption" muted>{tr('citizenReporter')} · {story.reporter.name}</Txt>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <Tap
            onPress={() => onListen(story)}
            accessibilityLabel={speaking ? tr('stop') : tr('listen')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: speaking ? t.colors.accent : 'transparent', borderWidth: 1, borderColor: t.colors.accent }}
          >
            <Icon name={speaking ? 'stop' : 'headset'} size={16} color={speaking ? palette.white : t.colors.accentText} />
            <Txt v="label" color={speaking ? palette.white : t.colors.accentText}>{speaking ? tr('stop') : tr('listen')}</Txt>
          </Tap>
          <ReactionButton story={story} />
          <Tap onPress={() => router.push(`/story/${story.id}`)} accessibilityLabel={tr('comments', { n: story.comments })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 40, paddingHorizontal: 10 }}>
            <Icon name="chatbubble-outline" size={18} color={t.colors.textMuted} />
            <Txt v="label" muted>{compact(story.comments)}</Txt>
          </Tap>
          <View style={{ flex: 1 }} />
          <Tap onPress={() => toggle(story.id)} accessibilityLabel={saved ? tr('bookmarked') : tr('bookmark')} style={{ padding: 8 }}>
            <Icon name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={saved ? t.colors.accentText : t.colors.text} />
          </Tap>
          <Tap onPress={() => onShare(story)} accessibilityLabel={tr('share')} style={{ padding: 8 }}>
            <Icon name="logo-whatsapp" size={22} color={t.dark ? '#4CD964' : '#1F8A55'} />
          </Tap>
        </View>
      </View>
    </View>
  );
}
