import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, interpolate } from 'react-native-reanimated';
import { palette } from '@/theme/tokens';

/** Web fallback mirroring assets/lottie/empty.json with Reanimated. */
export function EmptyArt({ size = 150 }: { size?: number }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }), -1); }, [p]);
  const ring = useAnimatedStyle(() => ({ opacity: 1 - p.value, transform: [{ scale: interpolate(p.value, [0, 1], [0.4, 1.2]) }] }));
  const page = useAnimatedStyle(() => ({ transform: [{ translateY: Math.sin(p.value * Math.PI * 2) * 4 }, { rotate: '-6deg' }] }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size * 0.7, height: size * 0.7, borderRadius: size, borderWidth: 3, borderColor: palette.gold }, ring]} />
      <Animated.View style={[{ width: size * 0.32, height: size * 0.4, borderRadius: 8, backgroundColor: palette.ivory, borderWidth: 2, borderColor: palette.gold }, page]}>
        {[0, 1, 2].map((i) => <View key={i} style={{ height: 3, marginHorizontal: 7, marginTop: 9, backgroundColor: palette.goldSoft, borderRadius: 2 }} />)}
      </Animated.View>
    </View>
  );
}
