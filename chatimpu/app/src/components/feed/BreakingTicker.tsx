import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation } from 'react-native-reanimated';
import { Tap, Txt } from '@/components/ui';
import { palette, radius } from '@/theme';
import { useT } from '@/i18n';

/** Red "BREAKING" banner with a marquee of headlines. */
export function BreakingTicker({ headlines, lang, onPress }: { headlines: string[]; lang: string; onPress?: () => void }) {
  const tr = useT();
  const x = useSharedValue(0);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!w) return;
    x.value = 0;
    x.value = withRepeat(withTiming(-w, { duration: w * 22, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(x);
  }, [w, x]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const text = headlines.join('   •   ') + '   •   ';
  return (
    <Tap onPress={onPress} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${tr('breakingNews')}: ${headlines.join('. ')}`}
      style={{ flexDirection: 'row', alignItems: 'center', height: 34, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.55)' }}>
      <View style={{ backgroundColor: palette.red, height: 34, paddingHorizontal: 12, justifyContent: 'center', zIndex: 2, borderRadius: radius.pill }}>
        <Txt v="overline" color={palette.white}>● {tr('breakingNews')}</Txt>
      </View>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View style={[{ flexDirection: 'row' }, a]}>
          <Txt v="label" lang={lang} color={palette.white} numberOfLines={1} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ paddingLeft: 12 }}>{text}</Txt>
          <Txt v="label" lang={lang} color={palette.white} numberOfLines={1} style={{ paddingLeft: 12 }}>{text}</Txt>
        </Animated.View>
      </View>
    </Tap>
  );
}
