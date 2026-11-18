import { Linking, View } from 'react-native';
import { Button, Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { APP } from '@/config';
import { usePrefs } from '@/store/prefs';
import { useRT } from '@/reporter/i18n';
import { Card } from '@/reporter/ui';

/** Short help; the full contributor agreement, policies and FAQ live in the web portal (same text). */
export default function Help() {
  const rt = useRT(); const te = usePrefs((s) => s.language) === 'te';
  const portal = process.env.EXPO_PUBLIC_REPORTER_PORTAL_URL || `https://www.${APP.domain}/reporter`;
  const points = te ? [
    'ఎడిటర్ ఆమోదించిన వార్తలకు మాత్రమే రేట్ కార్డ్ ప్రకారం డబ్బు వస్తుంది.',
    'పరిశీలనలో ఉన్న మొత్తం అందుబాటు బ్యాలెన్స్‌లోకి రాదు.',
    'చెల్లింపు విఫలమైతే, ఫైనాన్స్ బృందం సరిచూసి పూర్తి మొత్తాన్ని తిరిగి జమ చేస్తుంది.',
    'మీ సోర్సెస్, గుర్తింపు పత్రాలు, బ్యాంక్ వివరాలు ఎడిటర్లు/ఫైనాన్స్ మాత్రమే చూస్తారు.',
    'కంట్రిబ్యూటర్ హోదాలు ప్రెస్ అక్రిడిటేషన్ కావు.',
  ] : [
    'Only stories an editor approves earn money, at the rate card amount.',
    'Money for stories under review is pending and does not count towards withdrawal.',
    'If a payout fails, finance reconciles it and the full amount returns to your balance.',
    'Your sources, ID documents and bank details are seen only by editors / finance.',
    'Contributor titles describe your role on Chatimpu; they are not press accreditation.',
  ];
  return (
    <Screen back title={rt('help')}>
      <Card>{points.map((p) => <View key={p} style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}><Txt v="body">•</Txt><Txt v="bodySm" style={{ flex: 1 }}>{p}</Txt></View>)}</Card>
      <View style={{ marginHorizontal: 20, marginTop: 14, gap: 10 }}>
        <Button kind="secondary" icon="document-text" label={rt('agreement')} onPress={() => Linking.openURL(`${portal}/help`)} />
        <Button kind="ghost" icon="mail" label={`reporters@${APP.domain}`} onPress={() => Linking.openURL(`mailto:reporters@${APP.domain}`)} />
      </View>
    </Screen>
  );
}
