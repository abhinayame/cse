import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, Icon, Tap, Txt } from '@/components/ui';
import { usePrefs } from '@/store/prefs';
import { useT } from '@/i18n';
import { palette, radius } from '@/theme';

const PLANS = [
  { id: 'month', price: '₹49', per: '/ month', note: '' },
  { id: 'year', price: '₹399', per: '/ year', note: 'Save 32%' },
];
const PERKS = ['No ads between stories', 'Unlimited “Listen” briefings', 'Offline magazines', 'Early access to new features'];

/** Ad-free subscription paywall. Billing via RevenueCat / Play Billing / StoreKit in production. */
export default function Premium() {
  const tr = useT();
  const insets = useSafeAreaInsets();
  const set = usePrefs((s) => s.set);
  const [plan, setPlan] = useState('year');
  return (
    <LinearGradient colors={[palette.ink, '#1A1A1A']} style={{ flex: 1, paddingTop: insets.top + 12, paddingHorizontal: 22, paddingBottom: insets.bottom + 20 }}>
      <Tap onPress={() => router.back()} accessibilityLabel="Close" style={{ alignSelf: 'flex-end', width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' }}>
        <Icon name="close" size={20} color={palette.white} />
      </Tap>
      <Animated.View entering={FadeInDown.springify()} style={{ marginTop: 10, gap: 8 }}>
        <Icon name="diamond" size={40} color={palette.redBright} />
        <Txt v="display" color={palette.white}>{tr('premium')}</Txt>
        <Txt v="body" color="#A3A3A3">{tr('premiumSub')}</Txt>
      </Animated.View>
      <View style={{ marginTop: 26, gap: 12 }}>
        {PERKS.map((p) => (
          <View key={p} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="checkmark-circle" size={20} color={palette.redBright} />
            <Txt v="body" color={palette.white}>{p}</Txt>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 18 }}>
        {PLANS.map((p) => (
          <Tap key={p.id} onPress={() => setPlan(p.id)} style={{ flex: 1, padding: 16, borderRadius: radius.lg, borderWidth: 2, borderColor: plan === p.id ? palette.red : 'rgba(255,255,255,0.12)', backgroundColor: plan === p.id ? 'rgba(215,20,26,0.12)' : 'transparent' }}>
            {p.note ? <Txt v="overline" color={palette.redBright}>{p.note}</Txt> : <Txt v="overline" color="transparent">.</Txt>}
            <Txt lang="en" style={{ fontFamily: 'PlayfairDisplay_700Bold', fontSize: 30, lineHeight: 36, color: palette.white }}>{p.price}</Txt>
            <Txt v="caption" color="#A3A3A3">{p.per}</Txt>
          </Tap>
        ))}
      </View>
      <Button label="Start 7-day free trial" onPress={() => { set({ premium: true }); router.back(); }} />
    </LinearGradient>
  );
}
