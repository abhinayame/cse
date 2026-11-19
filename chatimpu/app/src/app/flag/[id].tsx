import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Tap, Txt, Icon } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { Banner, Card, Field } from '@/reporter/ui';
import { flagStory, type FlagReason } from '@/lib/community';
import { isDemoMode } from '@/lib/supabase';
import { usePrefs } from '@/store/prefs';
import { palette, radius, useTheme } from '@/theme';

const REASONS: [FlagReason, string, string][] = [
  ['wrong_facts', 'తప్పు సమాచారం', 'Wrong facts'], ['misleading', 'తప్పుదోవ పట్టించే శీర్షిక / ఫోటో', 'Misleading headline or photo'],
  ['offensive', 'అభ్యంతరకరం / ద్వేషపూరితం', 'Offensive or hateful'], ['privacy', 'నా గోప్యత / బాధితుని గుర్తింపు', 'My privacy or a victim identified'],
  ['copyright', 'నా ఫోటో / వార్త అనుమతి లేకుండా', 'My photo or text used without permission'], ['duplicate', 'ఒకే వార్త మళ్ళీ', 'Same story repeated'], ['other', 'ఇతర', 'Something else'],
];

/** "Report this story": goes to the editors' corrections queue (CMS → Corrections & grievances). */
export default function Flag() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const te = usePrefs((s) => s.language) === 'te';
  const L = (a: string, b: string) => (te ? a : b);
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const send = async () => {
    setBusy(true);
    try { await flagStory(id, reason!, details); setMsg({ tone: 'good', text: L('ధన్యవాదాలు. ఎడిటర్లు పరిశీలిస్తారు; సవరిస్తే వార్తలో సవరణ నోట్ కనిపిస్తుంది.', 'Thank you. Editors will check it; if we correct the story, a correction note appears on it.') }); }
    catch (e) { setMsg({ tone: 'bad', text: (e as Error).message }); }
    setBusy(false);
  };
  return (
    <Screen back title={L('ఈ వార్తపై ఫిర్యాదు', 'Report this story')}>
      <Card>
        <Txt v="label" style={{ marginBottom: 10 }}>{L('ఏది తప్పు?', 'What is wrong?')}</Txt>
        {REASONS.map(([k, a, b]) => (
          <Tap key={k} onPress={() => setReason(k)} accessibilityRole="radio" accessibilityState={{ selected: reason === k }} scaleTo={0.99}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 6, borderRadius: radius.md, borderWidth: 1, borderColor: reason === k ? palette.red : t.colors.border }}>
            <Icon name={reason === k ? 'radio-button-on' : 'radio-button-off'} size={19} color={reason === k ? palette.red : t.colors.textMuted} />
            <Txt v="bodySm" style={{ flex: 1 }}>{L(a, b)}</Txt>
          </Tap>
        ))}
        <View style={{ height: 8 }} />
        <Field label={L('వివరాలు (ఐచ్ఛికం)', 'Details (optional)')} value={details} onChangeText={setDetails} multiline maxLength={1000}
          hint={L('సరైన సమాచారం ఏమిటో తెలిస్తే రాయండి.', 'If you know the correct facts, tell us.')} />
        {isDemoMode && <Banner tone="warn" text={L('డెమో మోడ్: పంపడానికి బ్యాకెండ్ అవసరం.', 'Demo mode: sending needs the backend.')} />}
        {msg && <Banner tone={msg.tone} text={msg.text} />}
        <Tap onPress={() => router.push({ pathname: '/grievance', params: { story: id } })} style={{ marginTop: 12 }}>
          <Txt v="label" color={palette.navy}>{L('పరువు / చట్టపరమైన ఫిర్యాదా? అధికారిక ఫిర్యాదు చేయండి →', 'Defamation or a legal issue? File a formal grievance →')}</Txt>
        </Tap>
      </Card>
      <View style={{ margin: 20 }}>
        {msg?.tone === 'good' ? <Button label={L('పూర్తయింది', 'Done')} onPress={() => router.back()} />
          : <Button label={L('పంపండి', 'Send report')} icon="flag" loading={busy} disabled={!reason || isDemoMode} onPress={send} />}
      </View>
    </Screen>
  );
}
