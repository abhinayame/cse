import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Txt } from '@/components/ui';
import { palette } from '@/theme';
import { usePrefs } from '@/store/prefs';
import { useT } from '@/i18n';
import { APP } from '@/config';

/** Animated splash: red చా monogram springs in, a light sweep crosses it, the చాటింపు wordmark rises. */
export default function Splash() {
  const onboarded = usePrefs((s) => s.onboarded);
  const tr = useT();
  const scale = useSharedValue(0.4);
  const rot = useSharedValue(-12);
  const sweep = useSharedValue(-120);
  const ring = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 11, stiffness: 120 });
    rot.value = withSpring(0, { damping: 12 });
    ring.value = withDelay(250, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    sweep.value = withDelay(500, withSequence(withTiming(140, { duration: 800, easing: Easing.inOut(Easing.quad) })));
    const id = setTimeout(() => router.replace(onboarded ? '/(tabs)/feed' : '/onboarding/language'), 1900);
    return () => clearTimeout(id);
  }, [onboarded, ring, rot, scale, sweep]);

  const mono = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { rotate: `${rot.value}deg` }] }));
  const shine = useAnimatedStyle(() => ({ transform: [{ translateX: sweep.value }, { rotate: '20deg' }] }));
  const ringS = useAnimatedStyle(() => ({ opacity: 1 - ring.value, transform: [{ scale: 0.8 + ring.value * 0.9 }] }));

  return (
    <View style={{ flex: 1, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 1.5, borderColor: palette.red }, ringS]} />
      <Animated.View style={[{ width: 104, height: 104, borderRadius: 30, overflow: 'hidden' }, mono]}>
        <LinearGradient colors={['#F04046', palette.red, '#A30E12']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Txt lang="en" style={{ fontFamily: 'Ramabhadra_400Regular', fontSize: 50, lineHeight: 92, color: palette.white }}>చా</Txt>
        </LinearGradient>
        <Animated.View style={[{ position: 'absolute', top: -40, width: 30, height: 200, backgroundColor: 'rgba(255,255,255,0.45)' }, shine]} />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(450).springify().damping(16)} style={{ alignItems: 'center', marginTop: 26 }}>
        <Txt lang="en" style={{ fontFamily: 'Ramabhadra_400Regular', fontSize: 42, lineHeight: 72, color: palette.white }}>{APP.nameTe}</Txt>
        <Txt lang="en" style={{ fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 16, color: palette.redBright, letterSpacing: 6, marginTop: -4 }}>{APP.name.toUpperCase()}</Txt>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(850).duration(600)}>
        <Txt v="bodySm" color="#BDBDBD" style={{ marginTop: 14 }}>{tr('tagline')}</Txt>
      </Animated.View>
    </View>
  );
}
