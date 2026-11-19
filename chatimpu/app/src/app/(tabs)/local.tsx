import { useEffect, useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeInDown, FadeOutDown, LinearTransition } from 'react-native-reanimated';
import { Chip, Icon, Tap, Txt } from '@/components/ui';
import { Screen, Section } from '@/components/Screen';
import { LocalMap } from '@/components/LocalMap';
import { AlertRow } from '@/components/AlertRow';
import { STORIES } from '@/data/stories';
import { districtById, haversineKm, mandalById, placeName } from '@/data/locations';
import { fetchAlerts } from '@/lib/api';
import { storyText } from '@/lib/text';
import { timeAgo } from '@/lib/time';
import { usePrefs } from '@/store/prefs';
import { useT } from '@/i18n';
import { categoryColors, palette, radius, shadow, useTheme } from '@/theme';
import type { AlertKind, LocalAlert } from '@/data/types';

export default function Local() {
  const t = useTheme();
  const tr = useT();
  const { width } = useWindowDimensions();
  const { language: lang, districtId, mandalId } = usePrefs();
  const [view, setView] = useState<'map' | 'list'>('map');
  const [kind, setKind] = useState<AlertKind | 'all'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<LocalAlert[]>([]);
  useEffect(() => { fetchAlerts(districtId).then(setAlerts); }, [districtId]);

  const me = mandalById(mandalId) ?? { lat: 17.4, lng: 78.4 };
  const nearby = useMemo(() => STORIES.filter((s) => s.districtId === districtId)
    .map((s) => ({ s, km: haversineKm(me.lat, me.lng, s.lat, s.lng) }))
    .sort((a, b) => a.km - b.km), [districtId, me.lat, me.lng]);
  const shownAlerts = alerts.filter((a) => kind === 'all' || a.kind === kind);
  const selStory = nearby.find((n) => n.s.id === selected);
  const selAlert = alerts.find((a) => a.id === selected);

  return (
    <Screen tabs kicker={`${placeName(lang, mandalById(mandalId))} · ${placeName(lang, districtById(districtId))}`} title={tr('tabLocal')}
      right={<Tap onPress={() => router.push('/settings/location')} accessibilityLabel={tr('location')} style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.colors.surfaceAlt, marginBottom: 4 }}>
        <Icon name="navigate" size={15} color={t.colors.accentText} /><Txt v="label">{tr('location')}</Txt></Tap>}>
      <View style={{ flexDirection: 'row', marginHorizontal: 20, marginTop: 8, padding: 4, borderRadius: radius.pill, backgroundColor: t.colors.surfaceAlt }}>
        {(['map', 'list'] as const).map((v) => (
          <Tap key={v} onPress={() => setView(v)} style={{ flex: 1, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: view === v ? t.colors.surface : 'transparent' }}>
            <Icon name={v === 'map' ? 'map' : 'list'} size={16} color={view === v ? t.colors.text : t.colors.textMuted} />
            <Txt v="label" color={view === v ? t.colors.text : t.colors.textMuted}>{v === 'map' ? tr('mapView') : tr('listView')}</Txt>
          </Tap>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 14 }}>
        {([['/local-info', 'call', lang === 'te' ? 'హెల్ప్‌లైన్లు, ధరలు' : 'Helplines & prices', palette.red], ['/community', 'people', lang === 'te' ? 'కమ్యూనిటీ బోర్డు' : 'Community board', palette.navy]] as const).map(([to, icon, label, c]) => (
          <Tap key={to} onPress={() => router.push(to)} scaleTo={0.97} accessibilityRole="button" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c + '1A' }}><Icon name={icon} size={18} color={c} /></View>
            <Txt v="label" style={{ flex: 1 }} numberOfLines={2}>{label}</Txt>
          </Tap>
        ))}
      </View>

      {view === 'map' && (
        <Animated.View entering={FadeInDown} style={{ marginHorizontal: 20, marginTop: 16 }}>
          <LocalMap width={width - 40} height={360} districtId={districtId} me={me} stories={nearby.map((n) => n.s)} alerts={alerts}
            selected={selected} onSelect={setSelected} lang={lang} />
          {(selStory || selAlert) && (
            <Animated.View entering={FadeInDown.springify().damping(16)} exiting={FadeOutDown} style={{ marginTop: -70, marginHorizontal: 10 }}>
              {selAlert ? <AlertRow alert={selAlert} lang={lang} /> : selStory && (
                <Tap onPress={() => router.push(`/story/${selStory.s.id}`)} style={[{ flexDirection: 'row', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border }, shadow.lift]}>
                  <Image source={{ uri: selStory.s.image }} style={{ width: 70, height: 70, borderRadius: radius.md }} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Txt v="overline" color={categoryColors[selStory.s.category]}>{tr(`cat_${selStory.s.category}`)} · {tr('kmAway', { n: selStory.km.toFixed(1) })}</Txt>
                    <Txt v="title" lang={storyText(selStory.s, lang).lang} numberOfLines={2}>{storyText(selStory.s, lang).headline}</Txt>
                  </View>
                </Tap>
              )}
            </Animated.View>
          )}
        </Animated.View>
      )}

      <Section title={tr('localAlerts')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 12 }}>
          <Chip small label="All" selected={kind === 'all'} onPress={() => setKind('all')} />
          {(['power', 'water', 'traffic', 'weather', 'jobs', 'events'] as AlertKind[]).map((k) => (
            <Chip key={k} small label={tr(`alert_${k}`)} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        <Animated.View layout={LinearTransition.springify()} style={{ gap: 10, paddingHorizontal: 20 }}>
          {shownAlerts.map((a) => <AlertRow key={a.id} alert={a} lang={lang} />)}
          {!shownAlerts.length && <Txt v="bodySm" muted>—</Txt>}
        </Animated.View>
      </Section>

      <Section title={tr('nearby')}>
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {nearby.map(({ s, km }) => {
            const txt = storyText(s, lang);
            return (
              <Tap key={s.id} onPress={() => router.push(`/story/${s.id}`)} scaleTo={0.98} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Image source={{ uri: s.image }} style={{ width: 84, height: 84, borderRadius: radius.md }} contentFit="cover" />
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt v="title" lang={txt.lang} numberOfLines={3}>{txt.headline}</Txt>
                  <Txt v="caption" muted>{tr('kmAway', { n: km.toFixed(1) })} · {timeAgo(s.publishedAt, tr)}</Txt>
                </View>
              </Tap>
            );
          })}
        </View>
      </Section>
    </Screen>
  );
}
