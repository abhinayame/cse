import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { Group, Row } from '@/components/Row';
import { FaqList } from '@/components/FaqList';
import { Card, Pill } from '@/reporter/ui';
import { grievanceOfficer, myGrievances, type Officer } from '@/lib/community';
import { APP } from '@/config';
import { usePrefs } from '@/store/prefs';
import { palette } from '@/theme';

/** Reader help centre: FAQs, complaints (grievance redressal) and the grievance officer's details. */
export default function Help() {
  const te = usePrefs((s) => s.language) === 'te';
  const L = (a: string, b: string) => (te ? a : b);
  const [officer, setOfficer] = useState<Officer | null>(null);
  const [mine, setMine] = useState<Awaited<ReturnType<typeof myGrievances>>>([]);
  useEffect(() => { grievanceOfficer().then(setOfficer); myGrievances().then(setMine); }, []);
  return (
    <Screen back title={L('సహాయం', 'Help & support')}>
      <FaqList audience="reader" te={te} />
      <Txt v="overline" muted style={{ marginHorizontal: 20, marginTop: 26, marginBottom: 10 }}>{L('ఫిర్యాదులు', 'Complaints')}</Txt>
      <Group>
        <Row icon="document-text" label={L('ఫిర్యాదు చేయండి (గ్రీవెన్స్)', 'File a grievance')} tint={palette.red} onPress={() => router.push('/grievance')} />
        <Row icon="newspaper" label={L('రిపోర్టర్ సహాయం, అకాడమీ', 'Reporter help & Academy')} tint={palette.navy} onPress={() => router.push('/reporter/help')} />
        <Row icon="mail" label={`support@${APP.domain}`} onPress={() => Linking.openURL(`mailto:support@${APP.domain}`)} last />
      </Group>
      {mine.length > 0 && <Card>
        <Txt v="label" style={{ marginBottom: 8 }}>{L('నా ఫిర్యాదులు', 'My complaints')}</Txt>
        {mine.map((g) => (
          <View key={g.code} style={{ paddingVertical: 8, gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Txt v="title" lang="en">{g.code}</Txt><Pill status={g.status === 'resolved' ? 'completed' : g.status === 'rejected' ? 'rejected' : 'pending'} text={g.status} /></View>
            {g.resolution ? <Txt v="bodySm" muted>{g.resolution}</Txt> : <Txt v="caption" muted>{L('పరిష్కార గడువు', 'Resolve by')} {new Date(g.resolve_due_at).toLocaleDateString(te ? 'te-IN' : 'en-IN')}</Txt>}
          </View>
        ))}
      </Card>}
      <Card>
        <Txt v="label">{L('ఫిర్యాదుల అధికారి', 'Grievance officer')}</Txt>
        {officer ? <View style={{ marginTop: 6, gap: 2 }}>
          <Txt v="title">{officer.name}</Txt>
          {!!officer.email && <Txt v="bodySm" color={palette.navy} onPress={() => Linking.openURL(`mailto:${officer.email}`)}>{officer.email}</Txt>}
          {!!officer.phone && <Txt v="bodySm">{officer.phone}</Txt>}
          {!!officer.address && <Txt v="caption" muted>{officer.address}</Txt>}
        </View> : <Txt v="bodySm" muted style={{ marginTop: 6 }}>{L('వివరాలు త్వరలో. అప్పటివరకు', 'Details coming soon. Until then write to')} grievance@{APP.domain}</Txt>}
        <Txt v="caption" muted style={{ marginTop: 10 }}>{L('ఫిర్యాదు అందినట్లు 24 గంటల్లో తెలియజేసి, 15 రోజుల్లో పరిష్కరిస్తాం.', 'We acknowledge every complaint within 24 hours and resolve it within 15 days.')}</Txt>
      </Card>
      <View style={{ height: 30 }} />
    </Screen>
  );
}
