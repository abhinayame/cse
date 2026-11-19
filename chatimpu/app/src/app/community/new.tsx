import { useState } from 'react';
import { Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Chip, Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { Banner, Card, Field } from '@/reporter/ui';
import { OtpLogin } from '@/components/OtpLogin';
import { POST_KINDS, postCommunity, type PostKind } from '@/lib/community';
import { isDemoMode, supabase } from '@/lib/supabase';
import { usePrefs } from '@/store/prefs';
import { palette } from '@/theme';

/** New community post: always reviewed by the team before it appears. */
export default function NewPost() {
  const { language, districtId, mandalId, user } = usePrefs();
  const te = language === 'te';
  const L = (a: string, b: string) => (te ? a : b);
  const [kind, setKind] = useState<PostKind>('wishes');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [phone, setPhone] = useState('');
  const [price, setPrice] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const [signedIn, setSignedIn] = useState(!!user);
  const valid = title.trim().length >= 5 && body.trim().length >= 10 && consent && (!phone || /^[0-9]{10}$/.test(phone));
  const send = async () => {
    setBusy(true); setErr('');
    try {
      const r = await postCommunity({ kind, district_id: districtId, mandal_id: mandalId, lang: te ? 'te' : 'en', title: title.trim(), body: body.trim(),
        contact_phone: phone || null, price_paise: kind === 'buy_sell' && price ? Math.round(Number(price) * 100) : null, consent_confirmed: consent });
      setDone(r.code);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  if (done) return (
    <Screen back title={L('పోస్ట్ పంపబడింది', 'Post sent')}>
      <Card><Txt v="h3">{L('ధన్యవాదాలు!', 'Thank you!')}</Txt><Txt v="bodySm" muted style={{ marginTop: 6 }}>{L(`మీ పోస్ట్ ${done} పరిశీలనలో ఉంది. ఆమోదించగానే మీకు తెలియజేస్తాం.`, `Your post ${done} is in review. We will notify you when it is live.`)}</Txt></Card>
      <View style={{ margin: 20 }}><Button label={L('పూర్తయింది', 'Done')} onPress={() => router.back()} /></View>
    </Screen>
  );
  if (!isDemoMode && !signedIn && supabase) return (
    <Screen back title={L('పోస్ట్ చేయండి', 'New post')}>
      <View style={{ paddingHorizontal: 20, gap: 12 }}><Txt v="bodySm" muted>{L('పోస్ట్ చేయడానికి మీ మొబైల్ నంబర్‌తో సైన్ ఇన్ చేయండి.', 'Sign in with your mobile number to post.')}</Txt><OtpLogin onDone={() => setSignedIn(true)} /></View>
    </Screen>
  );
  return (
    <Screen back title={L('పోస్ట్ చేయండి', 'New post')}>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {POST_KINDS.map(([k, a, b]) => <Chip key={k} small label={te ? a : b} selected={kind === k} onPress={() => setKind(k)} />)}
        </View>
        <Field label={L('శీర్షిక', 'Title')} value={title} onChangeText={setTitle} maxLength={120} />
        <Field label={L('వివరాలు', 'Details')} value={body} onChangeText={setBody} multiline maxLength={1000} />
        {kind === 'buy_sell' && <Field label={L('ధర (₹)', 'Price (₹)')} value={price} onChangeText={(v) => setPrice(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />}
        <Field label={L('ఫోన్ (ఐచ్ఛికం)', 'Phone (optional)')} hint={L('ఈ నంబర్ అందరికీ కనిపిస్తుంది.', 'This number will be shown to everyone.')} value={phone} onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, '').slice(0, 10))} keyboardType="number-pad" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <Switch value={consent} onValueChange={setConsent} trackColor={{ true: palette.red }} accessibilityLabel="consent" />
          <Txt v="bodySm" style={{ flex: 1 }}>{L('ఈ పోస్ట్‌లో పేర్లు, ఫోటోలు, నంబర్లు ఉన్నవారి అనుమతి నాకు ఉంది. సమాచారం నిజం.', 'I have the consent of the people named or shown, and the information is true.')}</Txt>
        </View>
        {isDemoMode && <View style={{ marginTop: 12 }}><Banner tone="warn" text={L('డెమో మోడ్: పోస్ట్ చేయడానికి బ్యాకెండ్ అవసరం.', 'Demo mode: posting needs the backend.')} /></View>}
        {!!err && <View style={{ marginTop: 12 }}><Banner tone="bad" text={err} /></View>}
      </Card>
      <View style={{ margin: 20 }}><Button label={L('పరిశీలనకు పంపండి', 'Send for review')} icon="send" loading={busy} disabled={!valid || isDemoMode} onPress={send} /></View>
    </Screen>
  );
}
