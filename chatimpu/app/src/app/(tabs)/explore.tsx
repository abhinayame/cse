import { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Icon, Tap, Txt } from '@/components/ui';
import { Screen, Section } from '@/components/Screen';
import { PollCard } from '@/components/PollCard';
import { CATEGORIES } from '@/lib/categories';
import { MAGAZINES, POLLS } from '@/data/catalog';
import { STORIES } from '@/data/stories';
import { pick, storyText } from '@/lib/text';
import { compact } from '@/lib/time';
import { usePrefs } from '@/store/prefs';
import { useT } from '@/i18n';
import { categoryColors, palette, radius, shadow, useTheme } from '@/theme';

export default function Explore() {
  const t = useTheme();
  const tr = useT();
  const lang = usePrefs((s) => s.language);
  const buzz = useMemo(() => [...STORIES].sort((a, b) => b.shares - a.shares).slice(0, 5), []);

  return (
    <Screen title={tr('tabExplore')} tabs>
      <Tap onPress={() => router.push('/search')} scaleTo={0.98} style={{ marginHorizontal: 20, marginTop: 8, height: 50, borderRadius: radius.pill, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 }}>
        <Icon name="search" size={18} color={t.colors.textMuted} />
        <Txt v="body" muted>{tr('searchPlaceholder')}</Txt>
      </Tap>

      <Animated.View entering={FadeInDown.springify().damping(18)}>
        <Tap onPress={() => router.push('/digest')} scaleTo={0.98} style={[{ marginHorizontal: 20, marginTop: 18, borderRadius: radius.lg, overflow: 'hidden' }, shadow.soft]}>
          <LinearGradient colors={[palette.ink, '#1C1C1C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: palette.red, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="play" size={24} color={palette.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt v="overline" color={palette.redBright}>{new Date().getHours() < 15 ? tr('digestMorning') : tr('digestEvening')}</Txt>
              <Txt v="h3" color={palette.white}>{tr('today60')}</Txt>
            </View>
            <Icon name="chevron-forward" size={20} color={palette.redSoft} />
          </LinearGradient>
        </Tap>
      </Animated.View>

      <Section title={tr('categories')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20 }}>
          {CATEGORIES.map((c, i) => (
            <Animated.View key={c.id} entering={FadeInDown.delay(i * 25).springify().damping(18)} style={{ width: '31.4%' }}>
              <Tap onPress={() => router.push(`/category/${c.id}`)} style={{ height: 86, borderRadius: radius.lg, padding: 12, justifyContent: 'space-between', backgroundColor: categoryColors[c.id] + (t.dark ? '26' : '18') }}>
                <Icon name={c.icon} size={22} color={categoryColors[c.id]} />
                <Txt v="label" numberOfLines={1}>{tr(`cat_${c.id}`)}</Txt>
              </Tap>
            </Animated.View>
          ))}
        </View>
      </Section>

      <Section title={tr('magazines')}>
        <FlatList horizontal data={MAGAZINES} keyExtractor={(m) => m.id} showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }} snapToInterval={214} decelerationRate="fast"
          renderItem={({ item: m }) => {
            const l = (m.title as Record<string, string>)[lang] ? lang : 'en';
            return (
              <Tap onPress={() => router.push(`/magazine/${m.id}`)} style={[{ width: 200, height: 270, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: palette.ink2 }, shadow.soft]}>
                <Image source={{ uri: m.cover }} style={{ position: 'absolute', width: 200, height: 270 }} contentFit="cover" />
                <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.92)']} style={{ position: 'absolute', bottom: 0, width: 200, height: 170 }} />
                <View style={{ flex: 1, justifyContent: 'flex-end', padding: 14, gap: 4 }}>
                  <Txt v="overline" color={palette.redBright}>{m.theme} · {m.storyIds.length}</Txt>
                  <Txt v="h3" lang={l} color={palette.white}>{pick(m.title, lang)}</Txt>
                  <Txt v="caption" lang={l} color="#C7C7C7" numberOfLines={2}>{pick(m.subtitle, lang)}</Txt>
                </View>
              </Tap>
            );
          }} />
      </Section>

      <Section title={tr('topBuzz')}>
        <View style={{ paddingHorizontal: 20, gap: 4 }}>
          {buzz.map((s, i) => {
            const txt = storyText(s, lang);
            return (
              <Tap key={s.id} onPress={() => router.push(`/story/${s.id}`)} scaleTo={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 }}>
                <Txt lang="en" style={{ fontFamily: 'PlayfairDisplay_700Bold_Italic', fontSize: 34, lineHeight: 40, width: 30, color: t.colors.accent }}>{i + 1}</Txt>
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt v="title" lang={txt.lang} numberOfLines={2}>{txt.headline}</Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name="share-social" size={12} color={t.colors.textMuted} />
                    <Txt v="caption" muted>{compact(s.shares)} · {tr(`cat_${s.category}`)}</Txt>
                  </View>
                </View>
                <Image source={{ uri: s.image }} style={{ width: 64, height: 64, borderRadius: radius.md }} contentFit="cover" />
              </Tap>
            );
          })}
        </View>
      </Section>

      <Section title={tr('polls')}>
        <View style={{ gap: 14 }}>{POLLS.map((p) => <PollCard key={p.id} poll={p} />)}</View>
      </Section>

      <Tap onPress={() => router.push('/report')} scaleTo={0.98} style={{ margin: 20, marginTop: 28, padding: 18, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: t.colors.accent, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Icon name="camera" size={26} color={t.colors.accentText} />
        <View style={{ flex: 1 }}>
          <Txt v="title">{tr('citizenReporter')}</Txt>
          <Txt v="bodySm" muted>{tr('reportNews')}</Txt>
        </View>
        <Icon name="chevron-forward" size={18} color={t.colors.textMuted} />
      </Tap>
    </Screen>
  );
}
