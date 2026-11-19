import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Chip, Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { Banner, Card, Field } from '@/reporter/ui';
import { submitGrievance, type GrievanceCategory } from '@/lib/community';
import { isDemoMode } from '@/lib/supabase';
import { usePrefs } from '@/store/prefs';

const CATS: [GrievanceCategory, string, string][] = [
  ['content', 'వార్తలో తప్పు', 'Wrong or harmful content'], ['defamation', 'పరువు నష్టం', 'Defamation'], ['privacy', 'గోప్యత', 'Privacy'],
  ['copyright', 'కాపీరైట్', 'Copyright'], ['reporter_conduct', 'రిపోర్టర్ ప్రవర్తన', 'Reporter conduct'], ['other', 'ఇతర', 'Other'],
];

/** Formal grievance (IT Rules 2021 for digital news publishers): code, 24 h acknowledgement, 15 day resolution. */
export default function Grievance() {
  const te = usePrefs((s) => s.language) === 'te';
  const user = usePrefs((s) => s.user);
  const L = (a: string, b: string) => (te ? a : b);
  const { story } = useLocalSearchParams<{ story?: string }>();
  const [name, setName] = useState(user?.name ?? '');
  const [contact, setContact] = useState(user?.phone ?? '');
  const [cat, setCat] = useState<GrievanceCategory>('content');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ code: string } | null>(null);
  const valid = name.trim().length >= 2 && contact.trim().length >= 6 && details.trim().length >= 20;
  const send = async () => {
    setBusy(true); setErr('');
    try { setDone(await submitGrievance({ name, contact, category: cat, details, storyId: story ?? null })); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  if (done) return (
    <Screen back title={L('ఫిర్యాదు', 'Grievance')}>
      <Card><Txt v="h3">{L('ఫిర్యాదు అందింది', 'Complaint received')}</Txt>
        <Txt v="h2" lang="en" style={{ marginTop: 8 }}>{done.code}</Txt>
        <Txt v="bodySm" muted style={{ marginTop: 8 }}>{L('ఈ కోడ్‌ను గుర్తుంచుకోండి. 24 గంటల్లో స్పందించి, 15 రోజుల్లో పరిష్కరిస్తాం. స్థితి సహాయం పేజీలో కనిపిస్తుంది.', 'Keep this code. We will acknowledge within 24 hours and resolve within 15 days. You can follow it on the Help page.')}</Txt>
      </Card>
      <View style={{ margin: 20 }}><Button label={L('పూర్తయింది', 'Done')} onPress={() => router.back()} /></View>
    </Screen>
  );
  return (
    <Screen back title={L('ఫిర్యాదు చేయండి', 'File a grievance')}>
      <Card>
        <Txt v="bodySm" muted style={{ marginBottom: 14 }}>{L('వార్తలోని తప్పు చిన్నదైతే, వార్తలోనే "ఫిర్యాదు" నొక్కండి. పరువు, గోప్యత, కాపీరైట్ వంటి అధికారిక ఫిర్యాదులకు ఈ ఫారం.', 'For a small mistake, use "Report this story" on the story. Use this form for formal complaints such as defamation, privacy or copyright.')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {CATS.map(([k, a, b]) => <Chip key={k} small label={L(a, b)} selected={cat === k} onPress={() => setCat(k)} />)}
        </View>
        <Field label={L('పేరు', 'Your name')} value={name} onChangeText={setName} />
        <Field label={L('ఫోన్ లేదా ఈమెయిల్', 'Phone or email')} hint={L('మీకు జవాబు ఇవ్వడానికి మాత్రమే. ఎప్పుడూ ప్రచురించం.', 'Only to reply to you. Never published.')} value={contact} onChangeText={setContact} autoCapitalize="none" />
        <Field label={L('వివరాలు', 'Details')} hint={L('కనీసం 20 అక్షరాలు. ఏ వార్త, ఏది తప్పు, మీరు ఏం కోరుతున్నారు.', 'At least 20 characters: which story, what is wrong, what you want us to do.')} value={details} onChangeText={setDetails} multiline maxLength={3000} />
        {story ? <Txt v="caption" muted>{L('ఈ వార్తకు జత చేయబడింది', 'Linked to this story')}</Txt> : null}
        {isDemoMode && <Banner tone="warn" text={L('డెమో మోడ్: ఫిర్యాదు పంపడానికి బ్యాకెండ్ అవసరం.', 'Demo mode: sending needs the backend.')} />}
        {!!err && <View style={{ marginTop: 8 }}><Banner tone="bad" text={err} /></View>}
      </Card>
      <View style={{ margin: 20 }}><Button label={L('ఫిర్యాదు పంపండి', 'Send complaint')} icon="send" loading={busy} disabled={!valid || isDemoMode} onPress={send} /></View>
    </Screen>
  );
}
