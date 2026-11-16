import { useEffect } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Icon, Tap, Txt, type IconName } from '@/components/ui';
import { motion, palette, radius, shadow, useTheme } from '@/theme';
import { useT, type StringKey } from '@/i18n';

const TABS: Record<string, { icon: IconName; active: IconName; label: StringKey }> = {
  feed: { icon: 'newspaper-outline', active: 'newspaper', label: 'tabFeed' },
  explore: { icon: 'compass-outline', active: 'compass', label: 'tabExplore' },
  videos: { icon: 'play-circle-outline', active: 'play-circle', label: 'tabVideos' },
  local: { icon: 'location-outline', active: 'location', label: 'tabLocal' },
  profile: { icon: 'person-circle-outline', active: 'person-circle', label: 'tabProfile' },
};

export const TAB_BAR_H = 66;
export const TAB_BAR_MARGIN = 12;
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_H + TAB_BAR_MARGIN + Math.max(insets.bottom - 6, 6);
}

export function GlassTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const t = useTheme();
  const tr = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const barW = Math.min(width - TAB_BAR_MARGIN * 2, 520);
  const itemW = barW / state.routes.length;
  const x = useSharedValue(state.index * itemW);
  useEffect(() => { x.value = withSpring(state.index * itemW, motion.spring); }, [state.index, itemW, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const onVideos = state.routes[state.index]?.name === 'videos';

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom - 6, 6), alignItems: 'center' }}>
      <View style={[{ width: barW, height: TAB_BAR_H, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: onVideos ? 'rgba(255,255,255,0.12)' : t.colors.glassBorder }, shadow.lift]}>
        <BlurView intensity={Platform.OS === 'android' ? 60 : 40} tint={t.dark || onVideos ? 'dark' : 'light'} experimentalBlurMethod="dimezisBlurView" style={{ position: 'absolute', inset: 0 } as never} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: onVideos ? 'rgba(0,0,0,0.55)' : t.colors.glass }} />
        <Animated.View style={[{ position: 'absolute', top: 8, left: 6, width: itemW - 12, height: TAB_BAR_H - 16, borderRadius: radius.lg, backgroundColor: t.dark || onVideos ? 'rgba(215,20,26,0.22)' : 'rgba(215,20,26,0.10)' }, pill]} />
        <View style={{ flexDirection: 'row', flex: 1 }}>
          {state.routes.map((r, i) => {
            const meta = TABS[r.name];
            if (!meta) return null;
            const focused = state.index === i;
            const fg = focused ? (t.dark || onVideos ? palette.redBright : palette.red) : onVideos ? '#C7C7C7' : t.colors.textMuted;
            return (
              <Tap key={r.key} onPress={() => navigateToTab(r.key)} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={tr(meta.label)}
                style={{ width: itemW, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <Icon name={focused ? meta.active : meta.icon} size={23} color={fg} />
                <Txt v="caption" color={fg} numberOfLines={1} style={{ fontSize: 11, lineHeight: 14 }}>{tr(meta.label)}</Txt>
              </Tap>
            );
          })}
        </View>
      </View>
    </View>
  );
}
