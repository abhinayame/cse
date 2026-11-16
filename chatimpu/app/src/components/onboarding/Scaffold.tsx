import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon, Tap, Txt } from '@/components/ui';
import { motion, useTheme } from '@/theme';

interface Props { step: number; total?: number; title: string; sub?: string; children: ReactNode; footer: ReactNode; back?: boolean }

export function Scaffold({ step, total = 4, title, sub, children, footer, back = true }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {back && router.canGoBack() ? (
          <Tap onPress={() => router.back()} accessibilityLabel="Back" style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.surfaceAlt }}>
            <Icon name="chevron-back" size={20} />
          </Tap>
        ) : <View style={{ width: 40 }} />}
        <View style={{ flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
          {Array.from({ length: total }).map((_, i) => <Dot key={i} active={i === step} done={i < step} />)}
        </View>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.springify().damping(18)}>
          <Txt v="h1">{title}</Txt>
          {sub ? <Txt v="body" muted style={{ marginTop: 8 }}>{sub}</Txt> : null}
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(120).springify().damping(18)} style={{ marginTop: 24 }}>{children}</Animated.View>
      </ScrollView>
      <View style={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 16, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: t.colors.border, backgroundColor: t.colors.bg }}>{footer}</View>
    </View>
  );
}

function Dot({ active, done }: { active: boolean; done: boolean }) {
  const t = useTheme();
  const a = useAnimatedStyle(() => ({ width: withSpring(active ? 26 : 8, motion.spring) }));
  return <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: active || done ? t.colors.accent : t.colors.border }, a]} />;
}
