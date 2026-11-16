import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Icon, Tap, Txt } from '@/components/ui';
import { ReactionButton } from '@/components/feed/Reactions';
import { storyById } from '@/data/stories';
import { districtById, mandalById, placeName } from '@/data/locations';
import { storyText } from '@/lib/text';
import { timeAgo } from '@/lib/time';
import { speech } from '@/lib/speech';
import { shareStoryImage } from '@/lib/share';
import { useSpeaking } from '@/hooks/useSpeaking';
import { usePrefs } from '@/store/prefs';
import { useLibrary } from '@/store/library';
import { useT } from '@/i18n';
import { categoryColors, palette, radius, useTheme } from '@/theme';

const SAMPLE_COMMENTS = [
  { name: 'Srinivas K.', place: 'Hanamkonda', text: 'Very useful update, thanks for posting in Telugu too.', mins: 14, likes: 32 },
  { name: 'Priya M.', place: 'Gajuwaka', text: 'Please share the helpline numbers in the next story as well.', mins: 41, likes: 18 },
  { name: 'Rahul', place: 'Ameerpet', text: 'Good to see local news like this. Keep it up 👏', mins: 95, likes: 9 },
];

export default function StoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const tr = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const lang = usePrefs((s) => s.language);
  const user = usePrefs((s) => s.user);
  const saved = useLibrary((s) => s.bookmarks.includes(id));
  const toggle = useLibrary((s) => s.toggleBookmark);
  const speaking = useSpeaking();
  const [comments, setComments] = useState(SAMPLE_COMMENTS);
  const [draft, setDraft] = useState('');
  const story = storyById(id);
  if (!story) return null;
  const txt = storyText(story, lang);
  const other = txt.lang === 'en' ? story.content.te : story.content.en;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View>
          <Image source={{ uri: story.image }} style={{ width, height: width * 0.95 }} contentFit="cover" />
          <LinearGradient colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']} style={{ position: 'absolute', top: 0, width, height: 120 }} />
          <View style={{ position: 'absolute', top: insets.top + 8, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Tap onPress={() => router.back()} accessibilityLabel="Back" style={circle}><Icon name="chevron-back" size={20} color={palette.white} /></Tap>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Tap onPress={() => toggle(story.id)} accessibilityLabel={tr('bookmark')} style={circle}><Icon name={saved ? 'bookmark' : 'bookmark-outline'} size={19} color={palette.white} /></Tap>
              <Tap onPress={() => shareStoryImage(null, story, lang)} accessibilityLabel={tr('share')} style={circle}><Icon name="share-social" size={19} color={palette.white} /></Tap>
            </View>
          </View>
        </View>
        <Animated.View entering={FadeInDown.springify().damping(18)} style={{ marginTop: -24, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: t.colors.bg, padding: 22, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: categoryColors[story.category] }} />
            <Txt v="overline" color={t.colors.accentText}>{tr(`cat_${story.category}`)} · {placeName(lang, mandalById(story.mandalId))}, {placeName(lang, districtById(story.districtId))}</Txt>
          </View>
          <Txt v="h1" lang={txt.lang}>{txt.headline}</Txt>
          <Txt v="caption" muted>{story.sponsor ? `${tr('sponsored')} · ${story.sponsor}` : story.source} · {timeAgo(story.publishedAt, tr)}{story.reporter ? ` · ${story.reporter.name}` : ''}</Txt>
          <View style={{ width: 40, height: 2, backgroundColor: t.colors.accent }} />
          <Txt v="body" lang={txt.lang} style={{ fontSize: txt.lang === 'en' ? 18 : 17, lineHeight: txt.lang === 'en' ? 29 : 36 }}>{txt.summary}</Txt>
          {other && (
            <View style={{ padding: 14, borderRadius: radius.md, backgroundColor: t.colors.surfaceAlt, gap: 6 }}>
              <Txt v="overline" muted>{txt.lang === 'en' ? 'తెలుగులో' : 'In English'}</Txt>
              <Txt v="title" lang={txt.lang === 'en' ? 'te' : 'en'}>{other.headline}</Txt>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <Tap onPress={() => (speaking === story.id ? speech.stop() : speech.play([{ id: story.id, text: `${txt.headline}. ${txt.summary}`, lang: txt.lang }]))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: t.colors.accent }}>
              <Icon name={speaking === story.id ? 'stop' : 'headset'} size={16} color={t.colors.accentText} />
              <Txt v="label" color={t.colors.accentText}>{speaking === story.id ? tr('stop') : tr('listen')}</Txt>
            </Tap>
            <ReactionButton story={story} />
          </View>

          <Txt v="h3" style={{ marginTop: 16 }}>{tr('comments', { n: story.comments + comments.length - SAMPLE_COMMENTS.length })}</Txt>
          {comments.map((c, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Txt v="label">{c.name[0]}</Txt>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt v="label">{c.name} <Txt v="caption" muted>· {c.place} · {c.mins}m</Txt></Txt>
                <Txt v="bodySm">{c.text}</Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="thumbs-up-outline" size={12} color={t.colors.textMuted} /><Txt v="caption" muted>{c.likes}</Txt></View>
              </View>
            </View>
          ))}
        </Animated.View>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, paddingBottom: insets.bottom + 10, flexDirection: 'row', gap: 10, backgroundColor: t.colors.bgElevated, borderTopWidth: 1, borderTopColor: t.colors.border }}>
        <TextInput value={draft} onChangeText={setDraft} placeholder={user ? 'Add a respectful comment…' : 'Sign in to comment'} editable={!!user}
          placeholderTextColor={t.colors.textFaint} style={{ flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 16, backgroundColor: t.colors.surfaceAlt, color: t.colors.text, fontFamily: 'Inter_400Regular' }} />
        <Tap disabled={!draft.trim()} onPress={() => { setComments([{ name: user?.name ?? 'You', place: placeName(lang, districtById(story.districtId)), text: draft.trim(), mins: 0, likes: 0 }, ...comments]); setDraft(''); }}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: draft.trim() ? palette.red : t.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Post comment">
          <Icon name="send" size={18} color={draft.trim() ? palette.white : t.colors.textFaint} />
        </Tap>
      </View>
    </KeyboardAvoidingView>
  );
}

const circle = { width: 40, height: 40, borderRadius: 20, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'rgba(0,0,0,0.5)' };
