import { ActivityIndicator, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Tap } from './Pressable';
import { Txt } from './Txt';
import { Icon, type IconName } from './Icon';
import { palette, radius, shadow, useTheme } from '@/theme';

interface Props {
  label: string;
  onPress?: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  size?: 'md' | 'lg';
}

export function Button({ label, onPress, kind = 'primary', icon, loading, disabled, style, size = 'lg' }: Props) {
  const t = useTheme();
  const h = size === 'lg' ? 56 : 44;
  const fg = kind === 'primary' ? palette.midnight : kind === 'danger' ? palette.white : t.colors.text;
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: h, paddingHorizontal: 22 }}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={19} color={fg} /> : null}
      <Txt v="title" color={fg}>{label}</Txt>
    </View>
  );
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        { borderRadius: radius.pill, overflow: 'hidden', opacity: disabled ? 0.45 : 1 },
        kind === 'primary' && shadow.soft,
        kind === 'secondary' && { borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.surface },
        kind === 'danger' && { backgroundColor: palette.redDeep },
        style,
      ]}
    >
      {kind === 'primary' ? (
        <LinearGradient colors={['#E2C377', palette.gold, '#B48A35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {content}
        </LinearGradient>
      ) : content}
    </Tap>
  );
}
