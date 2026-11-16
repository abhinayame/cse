/**
 * Stylised editorial map (pure SVG, works on iOS / Android / web without API keys).
 * Swap for react-native-maps + a custom dark map style in production — pins and
 * selection logic stay the same (see README → Maps).
 */
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Line, Path, Pattern, Rect, RadialGradient, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Icon, Tap, Txt, type IconName } from '@/components/ui';
import { MANDALS, placeName } from '@/data/locations';
import { categoryColors, palette, radius, shadow, useTheme } from '@/theme';
import type { AlertKind, LocalAlert, Story } from '@/data/types';

export const ALERT_META: Record<AlertKind, { icon: IconName; color: string }> = {
  power: { icon: 'flash', color: '#E39A2D' },
  water: { icon: 'water', color: '#3D7BD9' },
  traffic: { icon: 'car', color: '#E5484D' },
  weather: { icon: 'thunderstorm', color: '#4A90C2' },
  jobs: { icon: 'briefcase', color: '#2F9E6B' },
  events: { icon: 'calendar', color: '#7C5CDB' },
};

interface Props {
  width: number;
  height: number;
  districtId: string;
  me: { lat: number; lng: number };
  stories: Story[];
  alerts: LocalAlert[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  lang: string;
}

export function LocalMap({ width, height, districtId, me, stories, alerts, selected, onSelect, lang }: Props) {
  const t = useTheme();
  const mandals = MANDALS.filter((m) => m.districtId === districtId);
  const proj = useMemo(() => {
    const pts = [...mandals, ...stories, ...alerts, me];
    const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
    const pad = 0.012;
    const minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad;
    const minLng = Math.min(...lngs) - pad, maxLng = Math.max(...lngs) + pad;
    const sx = (width - 60) / (maxLng - minLng), sy = (height - 60) / (maxLat - minLat);
    const s = Math.min(sx, sy);
    const ox = (width - (maxLng - minLng) * s) / 2, oy = (height - (maxLat - minLat) * s) / 2;
    return (lat: number, lng: number) => ({ x: ox + (lng - minLng) * s, y: oy + (maxLat - lat) * s });
  }, [mandals, stories, alerts, me, width, height]);

  const bg = t.dark ? '#111111' : '#F2F2F2';
  const road = t.dark ? '#2A2A2A' : '#FFFFFF';
  const grid = t.dark ? '#1A1A1A' : '#E6E6E6';
  const water = t.dark ? '#1C2633' : '#DCE7F2';
  const meP = proj(me.lat, me.lng);

  return (
    <View style={[{ width, height, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: bg }, shadow.soft]}>
      <Svg width={width} height={height} onPress={() => onSelect(null)}>
        <Defs>
          <Pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <Path d="M 28 0 L 0 0 0 28" fill="none" stroke={grid} strokeWidth="1" />
          </Pattern>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={palette.red} stopOpacity="0.35" />
            <Stop offset="1" stopColor={palette.red} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#grid)" />
        {districtId === 'vsp' && <Path d={`M ${width * 0.72} 0 C ${width * 0.6} ${height * 0.35}, ${width * 0.95} ${height * 0.6}, ${width * 0.8} ${height} L ${width} ${height} L ${width} 0 Z`} fill={water} />}
        {districtId === 'hyd' && <Circle cx={width * 0.42} cy={height * 0.42} r={26} fill={water} />}
        {/* arterial roads between mandal centres */}
        {mandals.map((a, i) => mandals.slice(i + 1).map((b) => {
          const p = proj(a.lat, a.lng), q = proj(b.lat, b.lng);
          return <Line key={a.id + b.id} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={road} strokeWidth={5} strokeLinecap="round" />;
        }))}
        <Circle cx={meP.x} cy={meP.y} r={70} fill="url(#glow)" />
      </Svg>

      {mandals.map((m) => {
        const p = proj(m.lat, m.lng);
        return (
          <View key={m.id} pointerEvents="none" style={{ position: 'absolute', left: p.x - 50, top: p.y + 10, width: 100, alignItems: 'center' }}>
            <Txt v="caption" muted style={{ fontSize: 10.5 }} numberOfLines={1}>{placeName(lang, m)}</Txt>
          </View>
        );
      })}

      <Pulse x={meP.x} y={meP.y} />

      {stories.map((s) => {
        const p = proj(s.lat, s.lng);
        const sel = selected === s.id;
        return (
          <Tap key={s.id} onPress={() => onSelect(s.id)} accessibilityLabel={s.content.en.headline}
            style={{ position: 'absolute', left: p.x - (sel ? 14 : 10), top: p.y - (sel ? 14 : 10), width: sel ? 28 : 20, height: sel ? 28 : 20, borderRadius: 14, backgroundColor: categoryColors[s.category], borderWidth: 3, borderColor: t.dark ? palette.ink : palette.paper, zIndex: sel ? 5 : 1 }} />
        );
      })}
      {alerts.map((a) => {
        const p = proj(a.lat, a.lng);
        const meta = ALERT_META[a.kind];
        const sel = selected === a.id;
        return (
          <Tap key={a.id} onPress={() => onSelect(a.id)} accessibilityLabel={a.title.en}
            style={[{ position: 'absolute', left: p.x - 15, top: p.y - 15, width: 30, height: 30, borderRadius: 9, backgroundColor: meta.color, alignItems: 'center', justifyContent: 'center', borderWidth: sel ? 3 : 2, borderColor: t.dark ? palette.ink : palette.paper, transform: [{ rotate: '45deg' }], zIndex: sel ? 5 : 2 }, shadow.soft]}>
            <View style={{ transform: [{ rotate: '-45deg' }] }}><Icon name={meta.icon} size={14} color="#fff" /></View>
          </Tap>
        );
      })}
    </View>
  );
}

function Pulse({ x, y }: { x: number; y: number }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1); }, [p]);
  const a = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - p.value), transform: [{ scale: 0.6 + p.value * 2.2 }] }));
  return (
    <>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x - 14, top: y - 14, width: 28, height: 28, borderRadius: 14, backgroundColor: palette.red }, a]} />
      <View pointerEvents="none" style={{ position: 'absolute', left: x - 8, top: y - 8, width: 16, height: 16, borderRadius: 8, backgroundColor: palette.red, borderWidth: 3, borderColor: '#fff' }} />
    </>
  );
}
