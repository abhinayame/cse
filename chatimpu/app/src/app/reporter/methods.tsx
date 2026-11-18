import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Button, Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { addMethod, methods, removeMethod, type Method } from '@/reporter/api';
import { useRT } from '@/reporter/i18n';
import { Banner, Card, Field, ListRow, Pill, Seg, useReporter } from '@/reporter/ui';

export default function Methods() {
  const rt = useRT(); const { dash } = useReporter();
  const [ms, setMs] = useState<Method[] | null>(null);
  const [kind, setKind] = useState<'upi' | 'bank'>('upi');
  const [f, setF] = useState({ holderName: dash.profile?.full_name ?? '', upi: '', accountNumber: '', confirm: '', ifsc: '', bankName: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [okMsg, setOk] = useState<string | null>(null);
  const load = useCallback(() => { methods().then(setMs).catch((e) => setErr(e.message)); }, []);
  useFocusEffect(load);
  const save = async () => {
    setBusy(true); setErr(null); setOk(null);
    try {
      await addMethod(kind === 'upi' ? { kind, holderName: f.holderName, upi: f.upi, makeDefault: true }
        : { kind, holderName: f.holderName, accountNumber: f.accountNumber, ifsc: f.ifsc, bankName: f.bankName, makeDefault: true });
      setF({ ...f, upi: '', accountNumber: '', confirm: '', ifsc: '', bankName: '' }); setOk(rt('pendingMethod')); load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const remove = (m: Method) => Alert.alert(`${rt('remove')} ${m.masked}?`, '', [{ text: rt('back'), style: 'cancel' }, { text: rt('remove'), style: 'destructive', onPress: () => removeMethod(m.id).then(load).catch((e) => setErr(e.message)) }]);
  const tone = (s: string) => (s === 'verified' ? 'paid' : s === 'failed' ? 'failed' : 'pending');
  const valid = f.holderName.trim().length >= 3 && (kind === 'upi' ? f.upi.includes('@') : f.accountNumber.length >= 9 && f.accountNumber === f.confirm && f.ifsc.length === 11);
  return (
    <Screen back title={rt('methods')} keyboardShouldPersistTaps="handled">
      <Card style={{ paddingVertical: 4 }}>
        {ms === null ? <Txt muted style={{ padding: 12 }}>…</Txt> : ms.length === 0 ? <Txt v="bodySm" muted style={{ padding: 12 }}>{rt('needVerifiedMethod')}</Txt> : ms.map((m) => (
          <ListRow key={m.id} icon={m.kind === 'upi' ? 'flash' : 'business'} title={`${m.kind === 'upi' ? 'UPI' : m.bank_name ?? 'Bank'} · ${m.masked}`}
            meta={`${m.holder_name}${m.ifsc ? ` · ${m.ifsc}` : ''}${m.verification_status === 'failed' && m.verification_note ? `\n${m.verification_note}` : ''}`}
            right={<View style={{ alignItems: 'flex-end', gap: 6 }}><Pill status={tone(m.verification_status)} text={rt(m.verification_status === 'verified' ? 'verifiedMethod' : m.verification_status === 'failed' ? 'failedMethod' : 'pendingMethod')} />
              <Txt v="caption" color="#B00E13" onPress={() => remove(m)}>{rt('remove')}</Txt></View>} />
        ))}
      </Card>
      <Seg value={kind} onChange={setKind} options={[['upi', rt('addUpi')], ['bank', rt('addBank')]]} />
      <Card>
        <Field label={rt('holderName')} value={f.holderName} onChangeText={(v) => setF({ ...f, holderName: v })} autoComplete="name" />
        {kind === 'upi' ? <Field label={rt('upiId')} placeholder="name@okaxis" autoCapitalize="none" value={f.upi} onChangeText={(v) => setF({ ...f, upi: v.trim() })} /> : <>
          <Field label={rt('accountNumber')} keyboardType="number-pad" value={f.accountNumber} onChangeText={(v) => setF({ ...f, accountNumber: v.replace(/\D/g, '').slice(0, 18) })} autoComplete="off" />
          <Field label={rt('confirmAccount')} keyboardType="number-pad" value={f.confirm} onChangeText={(v) => setF({ ...f, confirm: v.replace(/\D/g, '').slice(0, 18) })} contextMenuHidden autoComplete="off"
            hint={f.confirm && f.confirm !== f.accountNumber ? '✕' : undefined} />
          <Field label={rt('ifsc')} autoCapitalize="characters" maxLength={11} value={f.ifsc} onChangeText={(v) => setF({ ...f, ifsc: v.toUpperCase() })} />
          <Field label={rt('bankName')} value={f.bankName} onChangeText={(v) => setF({ ...f, bankName: v })} />
        </>}
        <View style={{ gap: 10 }}>
          {err && <Banner tone="bad" text={err} />}
          {okMsg && <Banner tone="good" text={okMsg} />}
          <Button label={busy ? rt('saving') : rt('save')} loading={busy} disabled={!valid || busy} onPress={save} />
          <Txt v="caption" muted>🔒 Payment details are encrypted and only shown to you masked. The finance team verifies each method before the first payout. A mobile number alone is not accepted.</Txt>
        </View>
      </Card>
    </Screen>
  );
}
