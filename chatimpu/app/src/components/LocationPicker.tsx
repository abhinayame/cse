import { useState } from 'react';
import { Platform, View } from 'react-native';
import * as Location from 'expo-location';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Button, Chip, Icon, Txt } from '@/components/ui';
import { DISTRICTS, MANDALS, STATES, VILLAGES, districtById, mandalById, nearestMandal, placeName } from '@/data/locations';
import { usePrefs } from '@/store/prefs';
import { useT } from '@/i18n';
import { radius, useTheme } from '@/theme';
import { haptic } from '@/lib/haptics';

/** GPS auto-detect with manual State → District → Mandal → Village override. */
export function LocationPicker() {
  const t = useTheme();
  const tr = useT();
  const p = usePrefs();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const detect = async () => {
    setBusy(true); setMsg(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('denied');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const m = nearestMandal(pos.coords.latitude, pos.coords.longitude);
      const d = districtById(m.districtId)!;
      p.set({ stateId: d.stateId, districtId: d.id, mandalId: m.id, villageId: undefined });
      haptic.success();
      setMsg(`${placeName(p.language, m)}, ${placeName(p.language, d)}`);
    } catch {
      setMsg(Platform.OS === 'web' ? 'Location unavailable — choose manually below.' : 'Permission denied — choose manually below.');
    } finally { setBusy(false); }
  };

  const districts = DISTRICTS.filter((d) => d.stateId === p.stateId);
  const mandals = MANDALS.filter((m) => m.districtId === p.districtId);
  const villages = VILLAGES.filter((v) => v.mandalId === p.mandalId);

  return (
    <View style={{ gap: 18 }}>
      <Button label={busy ? tr('detecting') : tr('useMyLocation')} icon="navigate" loading={busy} onPress={detect} kind="secondary" />
      {msg && (
        <Animated.View entering={FadeIn} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: t.colors.surfaceAlt }}>
          <Icon name="location" size={16} color={t.colors.accentText} />
          <Txt v="bodySm" style={{ flex: 1 }}>{msg}</Txt>
        </Animated.View>
      )}
      <Txt v="overline" muted>{tr('pickManually')}</Txt>
      <Group label={tr('state')}>
        {STATES.map((s) => <Chip key={s.id} label={placeName(p.language, s)} selected={p.stateId === s.id}
          onPress={() => { const d = DISTRICTS.find((x) => x.stateId === s.id)!; const m = MANDALS.find((x) => x.districtId === d.id)!; p.set({ stateId: s.id, districtId: d.id, mandalId: m.id, villageId: undefined }); }} />)}
      </Group>
      <Group label={tr('district')}>
        {districts.map((d) => <Chip key={d.id} label={placeName(p.language, d)} selected={p.districtId === d.id}
          onPress={() => p.set({ districtId: d.id, mandalId: MANDALS.find((m) => m.districtId === d.id)!.id, villageId: undefined })} />)}
      </Group>
      <Group label={tr('mandal')}>
        {mandals.map((m) => <Chip key={m.id} label={placeName(p.language, m)} selected={p.mandalId === m.id} onPress={() => p.set({ mandalId: m.id, villageId: undefined })} />)}
      </Group>
      {villages.length > 0 && (
        <Group label={tr('village')}>
          {villages.map((v) => <Chip key={v.id} label={placeName(p.language, v)} selected={p.villageId === v.id} onPress={() => p.set({ villageId: p.villageId === v.id ? undefined : v.id })} />)}
        </Group>
      )}
      <Txt v="caption" muted>{placeName(p.language, mandalById(p.mandalId))} · {placeName(p.language, districtById(p.districtId))}</Txt>
    </View>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt v="label" muted>{label}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}
