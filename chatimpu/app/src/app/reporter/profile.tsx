/** Reporter profile: status, identity verification (masked ID photo → private bucket) and PAN for TDS. */
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button, Chip, Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { usePrefs } from '@/store/prefs';
import { addPan, safeName, submitVerification, taxSummary, uploadUri, verifications, type TaxSummary } from '@/reporter/api';
import { useRT } from '@/reporter/i18n';
import { Banner, Card, Field, ListRow, Pill, repStatus, useReporter } from '@/reporter/ui';

const DOCS: [string, string][] = [['aadhaar_masked', 'Masked Aadhaar'], ['voter_id', 'Voter ID'], ['pan', 'PAN card'], ['driving_licence', 'Driving licence'], ['press_id', 'Press ID'], ['college_id', 'College ID']];

export default function ReporterProfile() {
  const rt = useRT(); const { dash, reload, userId } = useReporter(); const p = dash.profile!;
  const set = usePrefs((s) => s.set);
  const [vs, setVs] = useState<Awaited<ReturnType<typeof verifications>>>([]);
  const [doc, setDoc] = useState({ type: 'aadhaar_masked', last4: '', uri: '', mime: 'image/jpeg' });
  const [tax, setTax] = useState<TaxSummary | null>(null);
  const [pan, setPan] = useState({ pan: '', name: '' });
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null); const [okMsg, setOk] = useState<string | null>(null);
  const load = useCallback(() => { verifications().then(setVs).catch(() => {}); taxSummary().then(setTax).catch(() => {}); }, []);
  useFocusEffect(load);
  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled) setDoc({ ...doc, uri: r.assets[0].uri, mime: r.assets[0].mimeType ?? 'image/jpeg' });
  };
  const sendDoc = async () => {
    setBusy('doc'); setErr(null);
    try {
      const path = `${userId}/id/${Date.now()}-${safeName(`${doc.type}.jpg`)}`;
      await uploadUri('reporter-private', path, doc.uri, doc.mime);
      await submitVerification(doc.type, doc.last4, path);
      setDoc({ ...doc, last4: '', uri: '' }); setOk(rt('submitDoc') + ' ✓'); load(); reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const savePan = async () => {
    setBusy('pan'); setErr(null);
    try { await addPan(pan.pan, pan.name); setPan({ pan: '', name: '' }); setOk(rt('panSaved')); load(); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const pending = vs.some((v) => v.status === 'pending'); const approved = vs.some((v) => v.status === 'approved');
  return (
    <Screen back title={rt('profile')} keyboardShouldPersistTaps="handled">
      <Card>
        <Txt v="h3">{p.full_name}</Txt>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>{repStatus(rt, p.status)}<Txt v="caption" muted>{rt(`cat_${p.category}` as never)} · {dash.level}</Txt></View>
        {p.status_reason && <Txt v="caption" muted style={{ marginTop: 6 }}>{p.status_reason}</Txt>}
        <Txt v="caption" muted style={{ marginTop: 8 }}>{rt('contributorNote')}</Txt>
      </Card>
      <View style={{ marginHorizontal: 20, marginTop: 10, gap: 8 }}>{err && <Banner tone="bad" text={err} />}{okMsg && <Banner tone="good" text={okMsg} />}</View>
      <Card>
        <Txt v="title">{rt('idVerification')}</Txt>
        {vs.map((v) => <ListRow key={v.id} title={`${DOCS.find((d) => d[0] === v.document_type)?.[1] ?? v.document_type}${v.document_last4 ? ` ••${v.document_last4}` : ''}`} meta={v.review_note ?? undefined}
          right={<Pill status={v.status === 'approved' ? 'paid' : v.status === 'rejected' ? 'failed' : 'pending'} text={rt(v.status === 'approved' ? 'verifiedMethod' : v.status === 'rejected' ? 'failedMethod' : 'pendingMethod')} />} />)}
        {!approved && !pending && !['suspended', 'rejected'].includes(p.status) && (
          <View style={{ marginTop: 10 }}>
            <Banner text={`🔒 ${rt('idNote')}`} />
            <Txt v="label" style={{ marginVertical: 8 }}>{rt('docType')}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>{DOCS.map(([k, l]) => <Chip key={k} small label={l} selected={doc.type === k} onPress={() => setDoc({ ...doc, type: k })} />)}</View>
            <Field label={rt('last4')} maxLength={4} autoCapitalize="characters" value={doc.last4} onChangeText={(v) => setDoc({ ...doc, last4: v.replace(/[^A-Za-z0-9]/g, '') })} />
            <Button kind="secondary" size="md" icon="image" label={doc.uri ? '✓ ' + rt('uploadDoc') : rt('uploadDoc')} onPress={pick} />
            <View style={{ height: 10 }} />
            <Button label={busy === 'doc' ? rt('uploading') : rt('submitDoc')} loading={busy === 'doc'} disabled={!doc.uri || doc.last4.length < 2 || !!busy} onPress={sendDoc} />
          </View>
        )}
      </Card>
      <Card>
        <Txt v="title">{rt('panTitle')}</Txt>
        {tax?.pan && <ListRow title={`${tax.pan.masked} · ${tax.pan.name}`} meta={tax.pan.status === 'failed' ? tax.pan.note ?? undefined : undefined}
          right={<Pill status={tax.pan.status === 'verified' ? 'paid' : tax.pan.status === 'failed' ? 'failed' : 'pending'} text={rt(tax.pan.status === 'verified' ? 'panVerified' : tax.pan.status === 'failed' ? 'panFailed' : 'panPending')} />} />}
        <Txt v="caption" muted style={{ marginVertical: 8 }}>🔒 {rt('panWhy')}</Txt>
        {tax?.pan?.status !== 'verified' && <>
          <Field label={rt('panNumber')} placeholder="ABCDE1234F" autoCapitalize="characters" maxLength={10} value={pan.pan} onChangeText={(v) => setPan({ ...pan, pan: v.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
          <Field label={rt('panName')} value={pan.name} onChangeText={(v) => setPan({ ...pan, name: v })} autoComplete="name" />
          <Button kind="secondary" label={busy === 'pan' ? rt('saving') : rt('panSave')} loading={busy === 'pan'} disabled={!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.pan) || pan.name.trim().length < 3 || !!busy} onPress={savePan} />
        </>}
      </Card>
      <View style={{ marginHorizontal: 20, marginTop: 16 }}>
        <Button kind="ghost" label={rt('signOut')} onPress={async () => { await supabase?.auth.signOut(); set({ user: null }); }} />
      </View>
    </Screen>
  );
}
