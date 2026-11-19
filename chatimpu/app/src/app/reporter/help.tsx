import { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button, Icon, Tap, Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { FaqList } from '@/components/FaqList';
import { APP } from '@/config';
import { academyProgress } from '@/lib/community';
import { usePrefs } from '@/store/prefs';
import { useRT } from '@/reporter/i18n';
import { palette, radius } from '@/theme';

/** Reporter help: Academy progress, searchable FAQs (managed in the CMS), agreement and contact. */
export default function Help() {
  const rt = useRT(); const te = usePrefs((s) => s.language) === 'te';
  const L = (a: string, b: string) => (te ? a : b);
  const portal = process.env.EXPO_PUBLIC_REPORTER_PORTAL_URL || `https://www.${APP.domain}/reporter`;
  const [prog, setProg] = useState<{ lessons: number; passed: number } | null>(null);
  useFocusEffect(useCallback(() => { academyProgress().then(setProg).catch(() => setProg(null)); }, []));
  const pct = prog && prog.lessons ? prog.passed / prog.lessons : 0;
  return (
    <Screen back title={rt('help')}>
      <Tap onPress={() => router.push('/reporter/academy')} scaleTo={0.98} accessibilityRole="button"
        style={{ marginHorizontal: 20, marginTop: 8, marginBottom: 18, padding: 18, borderRadius: radius.lg, backgroundColor: palette.navy, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name="school" size={26} color={palette.white} />
          <View style={{ flex: 1 }}>
            <Txt v="title" color={palette.white}>{L('రిపోర్టర్ అకాడమీ', 'Reporter Academy')}</Txt>
            <Txt v="caption" color="#C9CBF0">{L('5 చిన్న పాఠాలు, ప్రతి దానికి చిన్న క్విజ్', '5 short lessons, each with a quick quiz')}</Txt>
          </View>
          <Txt v="h3" lang="en" color={palette.white}>{prog ? `${prog.passed}/${prog.lessons}` : ''}</Txt>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' }}><View style={{ width: `${pct * 100}%`, height: 6, borderRadius: 3, backgroundColor: palette.redBright }} /></View>
      </Tap>
      <FaqList audience="reporter" te={te} />
      <View style={{ marginHorizontal: 20, marginTop: 22, gap: 10, marginBottom: 30 }}>
        <Button kind="secondary" icon="document-text" label={rt('agreement')} onPress={() => Linking.openURL(`${portal}/help`)} />
        <Button kind="ghost" icon="mail" label={`reporters@${APP.domain}`} onPress={() => Linking.openURL(`mailto:reporters@${APP.domain}`)} />
      </View>
    </Screen>
  );
}
