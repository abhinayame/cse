/** Wallet: withdraw · earnings · payment history (routes /reporter/withdraw, /earnings, /history mirror the portal). */
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Button, Icon, Tap, Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { palette, radius, useTheme } from '@/theme';
import { usePrefs } from '@/store/prefs';
import {
  cancelWithdrawal, earnings, methods, rates, requestWithdrawal, rupees, taxSummary, utrFor, withdrawals,
  type Earning, type Method, type Rate, type TaxSummary, type Withdrawal,
} from '@/reporter/api';
import { useRT } from '@/reporter/i18n';
import { Banner, Card, Field, ListRow, Seg, go, useReporter, wdStatus, when } from '@/reporter/ui';

type Tab = 'withdraw' | 'earnings' | 'history';

export default function Wallet({ initial }: { initial?: Tab }) {
  const rt = useRT();
  const q = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(initial ?? q.tab ?? 'withdraw');
  const [tax, setTax] = useState<TaxSummary | null>(null);
  useEffect(() => { taxSummary().then(setTax).catch(() => setTax(null)); }, []);
  return (
    <Screen back title={rt('wallet')}>
      <Balance />
      <Seg value={tab} onChange={setTab} options={[['withdraw', rt('withdraw')], ['earnings', rt('earnings')], ['history', rt('tabHistory')]]} />
      {tab === 'withdraw' && <Withdraw tax={tax} />}
      {tab === 'earnings' && <Earnings tax={tax} />}
      {tab === 'history' && <History />}
    </Screen>
  );
}

function Balance() {
  const rt = useRT(); const { dash } = useReporter(); const w = dash.wallet;
  const pct = Math.min(100, Math.round((w.available_paise / Math.max(1, dash.threshold_paise)) * 100));
  return (
    <View style={{ marginHorizontal: 20, marginBottom: 10, borderRadius: 22, padding: 18, backgroundColor: palette.ink }}>
      <Txt v="bodySm" color="#BDBDBD">{rt('available')}</Txt>
      <Txt lang="en" style={{ fontFamily: 'Inter_700Bold', fontSize: 32, lineHeight: 40, color: palette.white }}>{rupees(w.available_paise)}</Txt>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 8, overflow: 'hidden' }}><View style={{ width: `${pct}%`, height: 6, backgroundColor: palette.red }} /></View>
      <Txt v="caption" color="#E0E0E0" style={{ marginTop: 6 }}>{rt('threshold')}: {rupees(dash.threshold_paise)} · {rt('pending')} {rupees(dash.pending_earnings_paise)} · {rt('requested')} {rupees(w.reserved_paise)}</Txt>
    </View>
  );
}

function TdsNote({ tax }: { tax: TaxSummary | null }) {
  const rt = useRT();
  if (!tax?.tds_enabled) return null;
  const text = rt('tdsNote').replace('{threshold}', rupees(tax.threshold_paise)).replace('{rate}', String(tax.rate_bps / 100)).replace('{noPan}', String(tax.rate_no_pan_bps / 100));
  return <Banner text={text} action={tax.pan?.status !== 'verified' ? { label: rt('panTitle'), onPress: () => go('/reporter/profile') } : undefined} />;
}

function Withdraw({ tax }: { tax: TaxSummary | null }) {
  const rt = useRT(); const t = useTheme(); const { dash, reload } = useReporter();
  const [ms, setMs] = useState<Method[] | null>(null);
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState(String(Math.floor(dash.wallet.available_paise / 100)));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [done, setDone] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { methods().then((m) => { setMs(m); const v = m.filter((x) => x.verification_status === 'verified'); setMethod((v.find((x) => x.is_default) ?? v[0])?.id ?? ''); }).catch((e) => setErr(e.message)); }, []));
  useEffect(() => { setAmount(String(Math.floor(dash.wallet.available_paise / 100))); }, [dash.wallet.available_paise]);
  const verified = (ms ?? []).filter((m) => m.verification_status === 'verified');
  const paise = Math.round(Number(amount || 0) * 100);
  const eligible = dash.wallet.available_paise >= dash.threshold_paise;
  const valid = eligible && paise >= dash.threshold_paise && paise <= dash.wallet.available_paise && !!method && dash.verified_identity;
  const submit = async () => {
    setBusy(true); setErr(null);
    try { const w = await requestWithdrawal(paise, method); setDone(`${rt('requested')} · ${w.code}`); await reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Card>
      <Txt v="title">{rt('requestWithdrawal')}</Txt>
      <Txt v="caption" muted style={{ marginVertical: 8 }}>{rt('withdrawRules')}</Txt>
      <View style={{ gap: 10, marginBottom: 12 }}>
        {!dash.verified_identity && <Banner tone="warn" text={rt('needId')} action={{ label: rt('addId'), onPress: () => go('/reporter/profile') }} />}
        {ms && verified.length === 0 && <Banner tone="warn" text={rt('needVerifiedMethod')} action={{ label: rt('methods'), onPress: () => go('/reporter/methods') }} />}
        <TdsNote tax={tax} />
      </View>
      <Field label={`${rt('amount')} (₹)`} value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" editable={eligible}
        hint={`${rt('threshold')} ${rupees(dash.threshold_paise)} · max ${rupees(dash.wallet.available_paise)}`} style={{ fontSize: 22, fontFamily: 'Inter_700Bold' }} />
      {verified.map((m) => (
        <Tap key={m.id} onPress={() => setMethod(m.id)} accessibilityRole="radio" accessibilityState={{ checked: method === m.id }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: method === m.id ? palette.red : t.colors.border, marginBottom: 8 }}>
          <Icon name={method === m.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={palette.red} />
          <View style={{ flex: 1 }}><Txt v="title">{m.kind === 'upi' ? 'UPI' : m.bank_name ?? 'Bank'} · {m.masked}</Txt><Txt v="caption" muted>{m.holder_name}</Txt></View>
        </Tap>
      ))}
      {err && <View style={{ marginBottom: 10 }}><Banner tone="bad" text={err} /></View>}
      {done && <View style={{ marginBottom: 10 }}><Banner tone="good" text={done} /></View>}
      <Button label={busy ? rt('saving') : `${rt('requestWithdrawal')} ${paise > 0 ? rupees(paise) : ''}`} loading={busy} disabled={!valid || busy} onPress={submit} />
    </Card>
  );
}

function Earnings({ tax }: { tax: TaxSummary | null }) {
  const rt = useRT(); const te = usePrefs((s) => s.language) === 'te';
  const [r, setR] = useState<Rate[]>([]); const [e, setE] = useState<Earning[] | null>(null);
  useEffect(() => { Promise.all([rates(), earnings()]).then(([a, b]) => { setR(a); setE(b); }).catch(() => setE([])); }, []);
  const label = (c: string) => { const x = r.find((y) => y.code === c); return x ? (te ? x.label_te : x.label_en) : c; };
  return (
    <>
      <Card>
        <Txt v="title" style={{ marginBottom: 4 }}>{rt('rateCard')}</Txt>
        {r.map((x) => <ListRow key={x.code} title={te ? x.label_te : x.label_en} right={<Txt v="label">{x.admin_defined ? '—' : x.min_paise === x.max_paise ? rupees(x.min_paise) : `${rupees(x.min_paise)}–${rupees(x.max_paise)}`}</Txt>} />)}
      </Card>
      {tax?.tds_enabled && <Card><ListRow title={`${rt('tdsThisYear')} · FY ${tax.fy}`} right={<Txt v="label">{rupees(tax.fy_tds_paise)}</Txt>} /><TdsNote tax={tax} /></Card>}
      <Card>
        <Txt v="title" style={{ marginBottom: 4 }}>{rt('earnings')}</Txt>
        {e === null ? <Txt muted>…</Txt> : e.length === 0 ? <Txt v="bodySm" muted>—</Txt> : e.map((x) => (
          <ListRow key={x.id} title={label(x.contribution_code)} meta={`${x.code} · ${when(x.approved_at, te)}`}
            right={<Txt v="label" color={x.status === 'reversed' ? undefined : '#1F8A55'} style={x.status === 'reversed' ? { textDecorationLine: 'line-through' } : undefined}>+{rupees(x.amount_paise)}</Txt>} />
        ))}
      </Card>
    </>
  );
}

function History() {
  const rt = useRT(); const te = usePrefs((s) => s.language) === 'te'; const { reload } = useReporter();
  const [rows, setRows] = useState<(Withdrawal & { utr?: string | null })[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const w = await withdrawals();
    setRows(await Promise.all(w.map(async (x) => (x.status === 'paid' ? { ...x, utr: await utrFor(x.id) } : x))));
  }, []);
  useFocusEffect(useCallback(() => { load().catch((e) => setErr(e.message)); }, [load]));
  const cancel = (w: Withdrawal) => Alert.alert(`${rt('cancel')} ${w.code}?`, rupees(w.amount_paise), [
    { text: rt('back'), style: 'cancel' },
    { text: rt('cancel'), style: 'destructive', onPress: () => cancelWithdrawal(w.id).then(() => Promise.all([load(), reload()])).catch((e) => setErr(e.message)) },
  ]);
  return (
    <Card style={{ paddingVertical: 4 }}>
      {err && <Banner tone="bad" text={err} />}
      {rows === null ? <Txt muted style={{ padding: 16 }}>…</Txt> : rows.length === 0 ? <Txt v="bodySm" muted align="center" style={{ padding: 20 }}>{rt('noHistory')}</Txt> : rows.map((w) => (
        <View key={w.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)', gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Txt lang="en" style={{ fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 24 }}>{rupees(w.amount_paise)}</Txt>{wdStatus(rt, w.status)}</View>
          <Txt v="caption" muted>{w.code} · {w.method_snapshot?.kind === 'upi' ? 'UPI' : 'Bank'} {w.method_snapshot?.masked} · {when(w.created_at, te)}</Txt>
          {w.tds_paise > 0 && <Txt v="caption" muted>{rt('tdsLine')} −{rupees(w.tds_paise)} · {rt('received')} {rupees(w.net_paise ?? w.amount_paise - w.tds_paise)}</Txt>}
          {w.utr && <Txt v="caption">UTR: {w.utr}</Txt>}
          {w.reason && ['rejected', 'failed', 'reversed'].includes(w.status) && <Txt v="caption" color={palette.redDeep}>{w.reason}</Txt>}
          {['failed', 'reversed', 'rejected'].includes(w.status) && !w.needs_reconciliation && <Txt v="caption" color="#1F8A55">✓ {rt('restored')}</Txt>}
          {['requested', 'under_review'].includes(w.status) && <Tap onPress={() => cancel(w)}><Txt v="label" color={palette.red}>{rt('cancel')}</Txt></Tap>}
        </View>
      ))}
    </Card>
  );
}
