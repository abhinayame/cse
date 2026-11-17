/**
 * Chatimpu brand lockup from the logo: red drum-man emblem + bold navy చాటింపు wordmark + red URL.
 * The emblem is the original artwork (assets/brand/emblem.png); the wordmark is set in Ramabhadra Bold.
 */
import { View } from 'react-native';
import { Image, type ImageStyle } from 'expo-image';
import { Txt } from '@/components/ui';
import { palette } from '@/theme';
import { TE_BOLD } from '@/theme/fonts';
import { APP } from '@/config';

export const EMBLEM = require('../../assets/brand/emblem.png');

export function Emblem({ size = 40, style }: { size?: number; style?: ImageStyle }) {
  return <Image source={EMBLEM} style={[{ width: size, height: size }, style]} contentFit="contain" accessibilityIgnoresInvertColors accessible={false} />;
}

/** Bold Telugu wordmark. `onDark` switches navy → white for dark surfaces (navy on black is too dark). */
export function Wordmark({ size = 28, onDark, color }: { size?: number; onDark?: boolean; color?: string }) {
  return (
    <Txt lang="en" accessibilityRole="header" accessibilityLabel={`${APP.nameTe} ${APP.name}`}
      style={{ fontFamily: TE_BOLD, fontSize: size, lineHeight: Math.round(size * 1.75), color: color ?? (onDark ? palette.white : palette.navy) }}>
      {APP.nameTe}
    </Txt>
  );
}

export function BrandRow({ size = 26, onDark }: { size?: number; onDark?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Emblem size={Math.round(size * 1.25)} />
      <Wordmark size={size} onDark={onDark} />
    </View>
  );
}
