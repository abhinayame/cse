import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Button, Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { usePrefs } from '@/store/prefs';
import { acceptAssignment, listAssignments, rupees, type Assignment } from '@/reporter/api';
import { useRT } from '@/reporter/i18n';
import { Banner, Card, Pill, Seg, go, useReporter, when } from '@/reporter/ui';

export default function Assignments() {
  const rt = useRT(); const te = usePrefs((s) => s.language) === 'te';
  const { userId, dash } = useReporter();
  const [rows, setRows] = useState<Assignment[] | null>(null);
  const [tab, setTab] = useState<'mine' | 'open'>('mine');
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { listAssignments().then(setRows).catch((e) => setErr(e.message)); }, []);
  useFocusEffect(load);
  const mine = (rows ?? []).filter((a) => a.assigned_reporter_id === userId && a.status !== 'cancelled');
  const open = (rows ?? []).filter((a) => !a.assigned_reporter_id && a.status === 'open');
  const active = ['active', 'verified'].includes(dash.profile?.status ?? '');
  const accept = async (a: Assignment) => { try { await acceptAssignment(a.id); load(); setTab('mine'); } catch (e) { setErr((e as Error).message); } };
  return (
    <Screen back title={rt('assignments')}>
      <Seg value={tab} onChange={setTab} options={[['mine', `${rt('mine')} ${rows ? mine.length : ''}`], ['open', `${rt('openNearYou')} ${rows ? open.length : ''}`]]} />
      {err && <View style={{ margin: 20 }}><Banner tone="bad" text={err} /></View>}
      {(tab === 'mine' ? mine : open).length === 0 && rows && <Txt v="bodySm" muted align="center" style={{ padding: 30 }}>{rt('noAssignments')}</Txt>}
      {(tab === 'mine' ? mine : open).map((a) => (
        <Card key={a.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Txt v="caption" muted>{a.code}</Txt><Pill status={a.status} text={a.status} /></View>
          <Txt v="h3" style={{ marginTop: 6 }}>{a.title}</Txt>
          <Txt v="bodySm" style={{ marginTop: 6 }}>{a.description}</Txt>
          {a.deadline && <Txt v="caption" muted style={{ marginTop: 8 }}>⏰ {rt('deadline')}: {when(a.deadline, te)}</Txt>}
          {a.special_amount_paise > 0 && <Txt v="label" style={{ marginTop: 6 }}>{rt('special')}: {rupees(a.special_amount_paise)}</Txt>}
          <View style={{ marginTop: 12 }}>
            {(a.status === 'open' || (a.status === 'assigned' && a.assigned_reporter_id === userId)) && <Button size="md" kind="secondary" label={rt('accept')} disabled={!active} onPress={() => accept(a)} />}
            {a.status === 'accepted' && a.assigned_reporter_id === userId && <Button size="md" label={rt('submitReport')} onPress={() => go(`/reporter/submit?assignment=${a.id}`)} />}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
