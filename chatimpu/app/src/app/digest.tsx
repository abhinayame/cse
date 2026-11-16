/**
 * "Today in 60 seconds" — morning / evening digest. Plays the top local stories back-to-back
 * with TTS (headline only, ~8–10 s each) and highlights the one being read.
 */
import { useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { Icon, Tap, Txt } from '@/components/ui';
import { STORIES } from '@/data/stories';
import { ALERTS } from '@/data/catalog';
import { scoreStory } from '@/lib/personalize';
import { pick, storyText } from '@/lib/text';
import { speech } from '@/lib/speech';
import { useSpeaking } from '@/hooks/useSpeaking';
import { usePrefs } from '@/store/prefs';
import { useLibrary } from '@/store/library';
import { districtById, placeName } from '@/data/locations';
import { useT, translate } from '@/i18n';
import { categoryColors, palette, radius } from '@/theme';

export default function Digest() {
  const tr = useT();
  const insets = useSafeAreaInsets();
  const p = usePrefs();
  const affinity = useLibrary((s) => s.affinity);
  const speaking = useSpeaking();
  const morning = new Date().getHours() < 15;
  const top = useMemo(() => [...STORIES].filter((s) => !s.sponsor)
    .sort((a, b) => scoreStory(b, { ...p, affinity }) - scoreStory(a, { ...p, affinity })).slice(0, 6), [p, affinity]);
  const alert = ALERTS.find((a) => a.districtId === p.districtId && a.severity !== 'info');

  const play = () => {
    const intro = { id: 'intro', lang: p.language, text: `${translate(p.language, morning ? 'digestMorning' : 'digestEvening')}. ${placeName(p.language, districtById(p.districtId))}.` };
    speech.play([intro, ...top.map((s) => { const t = storyText(s, p.language); return { id: s.id, text: t.headline, lang: t.lang }; })]);
  };
  useEffect(() => () => speech.stop(), []);
  const playing = speaking !== null;

  return (
    <LinearGradient colors={[palette.ink, '#141414', '#0A0A0A']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 22, paddingBottom: insets.bottom + 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt v="overline" color={palette.redBright}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Txt>
          <Tap onPress={() => router.back()} accessibilityLabel="Close" style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <Icon name="close" size={20} color={palette.white} />
          </Tap>
        </View>
        <Txt v="display" color={palette.white} style={{ marginTop: 16 }}>{tr('today60')}</Txt>
        <Txt v="body" color="#A3A3A3" style={{ marginTop: 6 }}>{morning ? tr('digestMorning') : tr('digestEvening')} · {placeName(p.language, districtById(p.districtId))}</Txt>

        <Tap onPress={() => (playing ? speech.stop() : play())} style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.pill, backgroundColor: 'rgba(215,20,26,0.14)', borderWidth: 1, borderColor: 'rgba(215,20,26,0.4)' }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: palette.red, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={playing ? 'pause' : 'play'} size={24} color={palette.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="title" color={palette.white}>{playing ? tr('stop') : tr('playBriefing')}</Txt>
            <Txt v="caption" color="#A3A3A3">{top.length} stories · ~60s</Txt>
          </View>
          {playing && <Bars />}
        </Tap>

        {alert && (
          <View style={{ marginTop: 18, padding: 14, borderRadius: radius.md, backgroundColor: 'rgba(229,72,77,0.14)', borderWidth: 1, borderColor: 'rgba(229,72,77,0.4)', flexDirection: 'row', gap: 10 }}>
            <Icon name="warning" size={18} color="#FF7A7E" />
            <Txt v="bodySm" color={palette.white} style={{ flex: 1 }}>{pick(alert.title, p.language)} — {pick(alert.detail, p.language)}</Txt>
          </View>
        )}

        <View style={{ marginTop: 22, gap: 4 }}>
          {top.map((s, i) => {
            const t = storyText(s, p.language);
            const on = speaking === s.id;
            return (
              <Animated.View key={s.id} entering={FadeInDown.delay(i * 70).springify().damping(18)}>
                <Tap onPress={() => router.push(`/story/${s.id}`)} scaleTo={0.98} style={{ flexDirection: 'row', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                  <Txt lang="en" style={{ fontFamily: 'PlayfairDisplay_700Bold_Italic', fontSize: 26, lineHeight: 32, color: on ? palette.red : 'rgba(215,20,26,0.5)', width: 28 }}>{i + 1}</Txt>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Txt v="overline" color={categoryColors[s.category]}>{tr(`cat_${s.category}`)}</Txt>
                    <Txt v="title" lang={t.lang} color={on ? palette.red : palette.white}>{t.headline}</Txt>
                  </View>
                </Tap>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function Bars() {
  return <View style={{ flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 20, marginRight: 8 }}>{[0, 1, 2, 3].map((i) => <Bar key={i} i={i} />)}</View>;
}
function Bar({ i }: { i: number }) {
  const h = useSharedValue(6);
  useEffect(() => { h.value = withRepeat(withTiming(18 - i * 2, { duration: 300 + i * 90, easing: Easing.inOut(Easing.quad) }), -1, true); }, [h, i]);
  const a = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[{ width: 3, borderRadius: 2, backgroundColor: palette.red }, a]} />;
}
