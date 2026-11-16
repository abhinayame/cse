import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme';

/** Shimmer loading skeleton block. */
export function Shimmer({ style }: { style?: ViewStyle }) {
  const t = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [p]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(p.value, [0, 1], [-300, 300]) }] }));
  return (
    <View style={[{ backgroundColor: t.colors.skeleton, overflow: 'hidden', borderRadius: 10 }, style]}>
      <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: 300 }, a]}>
        <LinearGradient
          colors={['transparent', t.colors.skeletonHi, 'transparent']}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}
