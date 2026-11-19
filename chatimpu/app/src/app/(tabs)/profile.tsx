import { View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Icon, Tap, Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { Group, Row } from '@/components/Row';
import { usePrefs } from '@/store/prefs';
import { useLibrary } from '@/store/library';
import { districtById, mandalById, placeName } from '@/data/locations';
import { languageByCode, useT } from '@/i18n';
import { palette, radius, shadow, useTheme } from '@/theme';
import type { ThemeMode } from '@/theme/themes';
import { supabase } from '@/lib/supabase';

export default function Profile() {
  const t = useTheme();
  const tr = useT();
  const p = usePrefs();
  const lib = useLibrary();
  const themes: { id: ThemeMode; label: string; swatch: [string, string] }[] = [
    { id: 'system', label: tr('themeSystem'), swatch: [palette.white, palette.ink] },
    { id: 'light', label: tr('themeLight'), swatch: [palette.white, palette.white] },
    { id: 'dark', label: tr('themeDark'), swatch: [palette.ink, palette.ink] },
    { id: 'amoled', label: tr('themeAmoled'), swatch: ['#000', '#000'] },
  ];

  return (
    <Screen tabs title={tr('tabProfile')}>
      <Animated.View entering={FadeInDown.springify().damping(18)} style={{ marginHorizontal: 20, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <LinearGradient colors={['#F04046', palette.red, '#A30E12']} style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="person" size={30} color={palette.white} />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Txt v="h3">{p.user ? (p.user.name ?? `+91 ${p.user.phone}`) : tr('guest')}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            {p.user?.verified && <Icon name="shield-checkmark" size={14} color={t.colors.success} />}
            <Txt v="caption" muted>{p.user?.verified ? `${tr('citizenReporter')} ✓` : `${placeName(p.language, mandalById(p.mandalId))}, ${placeName(p.language, districtById(p.districtId))}`}</Txt>
          </View>
        </View>
        {!p.user && <Tap onPress={() => router.push('/login')} style={{ paddingHorizontal: 16, height: 38, borderRadius: 19, justifyContent: 'center', backgroundColor: t.colors.text }}><Txt v="label" color={t.colors.bg}>Sign in</Txt></Tap>}
      </Animated.View>

      <View style={{ flexDirection: 'row', marginHorizontal: 20, marginTop: 20, gap: 10 }}>
        {[{ n: lib.bookmarks.length, l: tr('bookmarks'), go: '/bookmarks' }, { n: lib.history.length, l: tr('history'), go: '/history' }, { n: lib.offline.length, l: 'Offline', go: '/history' }].map((s) => (
          <Tap key={s.l} onPress={() => router.push(s.go as never)} style={{ flex: 1, padding: 14, borderRadius: radius.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border }}>
            <Txt lang="en" style={{ fontFamily: 'PlayfairDisplay_700Bold', fontSize: 28, lineHeight: 34, color: t.colors.text }}>{s.n}</Txt>
            <Txt v="caption" muted numberOfLines={1}>{s.l}</Txt>
          </Tap>
        ))}
      </View>

      {!p.premium && (
        <Tap onPress={() => router.push('/premium')} scaleTo={0.98} style={[{ marginHorizontal: 20, marginTop: 16, borderRadius: radius.lg, overflow: 'hidden' }, shadow.soft]}>
          <LinearGradient colors={[palette.ink, '#1F1F1F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Icon name="diamond" size={26} color={palette.redBright} />
            <View style={{ flex: 1 }}>
              <Txt v="title" color={palette.redBright}>{tr('premium')}</Txt>
              <Txt v="bodySm" color="#C7C7C7">{tr('premiumSub')}</Txt>
            </View>
            <Icon name="chevron-forward" size={18} color={palette.redSoft} />
          </LinearGradient>
        </Tap>
      )}

      <Txt v="overline" muted style={{ marginHorizontal: 20, marginTop: 26, marginBottom: 10 }}>{tr('theme')}</Txt>
      <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 20 }}>
        {themes.map((th) => {
          const sel = p.themeMode === th.id;
          return (
            <Tap key={th.id} onPress={() => p.set({ themeMode: th.id })} accessibilityRole="radio" accessibilityState={{ selected: sel }} accessibilityLabel={th.label}
              style={{ flex: 1, alignItems: 'center', gap: 8, paddingVertical: 12, borderRadius: radius.lg, borderWidth: sel ? 2 : 1, borderColor: sel ? t.colors.accent : t.colors.border, backgroundColor: t.colors.surface }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden', flexDirection: 'row', borderWidth: 1, borderColor: t.colors.border }}>
                <View style={{ flex: 1, backgroundColor: th.swatch[0] }} /><View style={{ flex: 1, backgroundColor: th.swatch[1] }} />
              </View>
              <Txt v="caption">{th.label}</Txt>
            </Tap>
          );
        })}
      </View>

      <Txt v="overline" muted style={{ marginHorizontal: 20, marginTop: 26, marginBottom: 10 }}>{tr('settings')}</Txt>
      <Group>
        <Row icon="language" label={tr('language')} value={languageByCode(p.language).native} onPress={() => router.push('/settings/language')} />
        <Row icon="location" label={tr('location')} value={placeName(p.language, mandalById(p.mandalId))} onPress={() => router.push('/settings/location')} />
        <Row icon="heart" label={tr('interestsTitle').replace('?', '')} value={String(p.interests.length)} onPress={() => router.push('/settings/interests')} />
        <Row icon="notifications" label={tr('notifications')} onPress={() => router.push('/settings/notifications')} last />
      </Group>
      <View style={{ height: 14 }} />
      <Group>
        <Row icon="bookmark" label={tr('bookmarks')} value={String(lib.bookmarks.length)} onPress={() => router.push('/bookmarks')} />
        <Row icon="time" label={tr('history')} onPress={() => router.push('/history')} />
        <Row icon="cloud-download" label="Offline" value={tr('offlineStories', { n: lib.offline.length })} last />
      </Group>
      <View style={{ height: 14 }} />
      <Group>
        <Row icon="newspaper" label={tr('reporterHub')} onPress={() => router.push('/reporter')} tint={palette.navy} />
        <Row icon="camera" label={tr('citizenReporter')} onPress={() => router.push('/report')} tint={palette.green} />
        <Row icon="help-buoy" label={p.language === 'te' ? 'సహాయం, ఫిర్యాదులు' : 'Help & complaints'} onPress={() => router.push('/help')} tint={palette.navy} />
        <Row icon="play-circle" label={tr('autoplay')} toggle={p.autoplay} onToggle={(v) => p.set({ autoplay: v })} />
        <Row icon="speedometer" label={tr('dataSaver')} toggle={p.dataSaver} onToggle={(v) => p.set({ dataSaver: v })} last={!p.user} />
        {p.user && <Row icon="log-out" label={tr('logout')} tint={palette.red} onPress={() => { supabase?.auth.signOut(); p.set({ user: null }); }} last />}
      </Group>
      <Txt v="caption" muted align="center" style={{ marginTop: 24 }}>Chatimpu 1.0 · Made in India</Txt>
    </Screen>
  );
}
