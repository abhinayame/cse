import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Txt } from '@/components/ui';
import { Emblem, Wordmark } from '@/components/Brand';
import { palette } from '@/theme';
import { usePrefs } from '@/store/prefs';
import { useT } from '@/i18n';
import { APP } from '@/config';

/**
 * Launch screen matching the logo lockup on white (same as the native splash): the drum-man emblem
 * drops in with two "drum-beat" ripples, then the bold navy చాటింపు wordmark and the red web address rise.
 */
export default function Splash() {
  const onboarded = usePrefs((s) => s.onboarded);
  const tr = useT();
  const scale = useSharedValue(0.5);
  const beat = useSharedValue(0);
  const beat2 = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(withSpring(1.06, { damping: 9, stiffness: 140 }), withSpring(1, { damping: 14 }));
    const ripple = () => withRepeat(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }), 2, false);
    beat.value = withDelay(220, ripple());
    beat2.value = withDelay(520, ripple());
    const id = setTimeout(() => router.replace(onboarded ? '/(tabs)/feed' : '/onboarding/language'), 2000);
    return () => clearTimeout(id);
  }, [onboarded, scale, beat, beat2]);

  const em = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const r1 = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - beat.value), transform: [{ scale: 1 + beat.value * 0.7 }] }));
  const r2 = useAnimatedStyle(() => ({ opacity: 0.4 * (1 - beat2.value), transform: [{ scale: 1 + beat2.value * 0.7 }] }));
  const ring = { position: 'absolute' as const, width: 168, height: 168, borderRadius: 84, borderWidth: 2, borderColor: palette.logoRed };

  return (
    <View style={{ flex: 1, backgroundColor: palette.white, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 168, height: 168, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[ring, r1]} />
        <Animated.View style={[ring, r2]} />
        <Animated.View style={em}><Emblem size={168} /></Animated.View>
      </View>
      <Animated.View entering={FadeInDown.delay(450).springify().damping(16)} style={{ alignItems: 'center', marginTop: 18 }}>
        <Wordmark size={46} />
        <Txt lang="en" style={{ fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 18, color: palette.redDeep, letterSpacing: 0.4, marginTop: -6 }}>www.{APP.domain}</Txt>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(850).duration(600)}>
        <Txt v="bodySm" color={palette.slate} style={{ marginTop: 18 }}>{tr('tagline')}</Txt>
      </Animated.View>
    </View>
  );
}
