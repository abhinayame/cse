import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion } from '@/theme/tokens';
import { haptic } from '@/lib/haptics';

const AP = Animated.createAnimatedComponent(Pressable);

/** Pressable with a spring "squish" and selection haptic. */
export function Tap({ style, scaleTo = 0.95, onPress, haptics = true, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; haptics?: boolean }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AP
      {...rest}
      onPressIn={(e) => { s.value = withSpring(scaleTo, motion.springSnappy); rest.onPressIn?.(e); }}
      onPressOut={(e) => { s.value = withSpring(1, motion.spring); rest.onPressOut?.(e); }}
      onPress={(e) => { if (haptics) haptic.tap(); onPress?.(e); }}
      style={[style, a]}
    />
  );
}
