import { View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Tap } from './Pressable';
import { Txt } from './Txt';
import { Icon, type IconName } from './Icon';
import { motion, palette, radius, useTheme } from '@/theme';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  dot?: string;
  /** "glass" chips float over imagery */
  glass?: boolean;
  small?: boolean;
}

export function Chip({ label, selected, onPress, icon, dot, glass, small }: Props) {
  const t = useTheme();
  const bg = selected ? palette.red : glass ? 'rgba(0,0,0,0.42)' : t.colors.surface;
  const fg = selected ? palette.white : glass ? palette.white : t.colors.text;
  const a = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(selected ? 1 : 0.97, motion.spring) }],
    opacity: withTiming(1),
  }));
  return (
    <Tap onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label}>
      <Animated.View
        style={[
          {
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: small ? 12 : 16, height: small ? 32 : 38, borderRadius: radius.pill,
            backgroundColor: bg,
            borderWidth: selected || glass ? 0 : 1, borderColor: t.colors.border,
          },
          a,
        ]}
      >
        {dot ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} /> : null}
        {icon ? <Icon name={icon} size={15} color={fg} /> : null}
        <Txt v="label" color={fg}>{label}</Txt>
      </Animated.View>
    </Tap>
  );
}
