import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { Icon, Tap, Txt, type IconName } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { Card } from '@/reporter/ui';
import { loadContacts, loadPrices, rupees, type Contact, type Price } from '@/lib/community';
import { districtById, placeName } from '@/data/locations';
import { usePrefs } from '@/store/prefs';
import { palette, radius, useTheme } from '@/theme';

const KIND_ICON: Record<string, IconName> = { emergency: 'alert-circle', police: 'shield', ambulance: 'medkit', fire: 'flame', hospital: 'medical', women: 'woman', child: 'happy', cyber: 'lock-closed', electricity: 'flash', water: 'water', municipal: 'business', collectorate: 'library', other: 'call' };
const ITEMS: Record<string, [string, string]> = {
  gold_22k: ['బంగారం 22 క్యారెట్', 'Gold 22K'], gold_24k: ['బంగారం 24 క్యారెట్', 'Gold 24K'], silver: ['వెండి', 'Silver'], petrol: ['పెట్రోల్', 'Petrol'], diesel: ['డీజిల్', 'Diesel'], lpg: ['వంట గ్యాస్', 'LPG cylinder'],
  tomato: ['టమాటా', 'Tomato'], onion: ['ఉల్లిపాయ', 'Onion'], potato: ['ఆలుగడ్డ', 'Potato'], chicken: ['చికెన్', 'Chicken'], mutton: ['మటన్', 'Mutton'], egg: ['గుడ్లు', 'Eggs'],
  paddy: ['వరి ధాన్యం', 'Paddy'], cotton: ['పత్తి', 'Cotton'], chilli: ['మిర్చి', 'Chilli'], turmeric: ['పసుపు', 'Turmeric'],
};

/** Emergency and local phone numbers + today's prices for the reader's district (all entered by editors). */
export default function LocalInfo() {
  const t = useTheme();
  const { language, districtId } = usePrefs();
  const te = language === 'te';
  const L = (a: string, b: string) => (te ? a : b);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  useEffect(() => { loadContacts(districtId).then(setContacts); loadPrices(districtId).then(setPrices); }, [districtId]);
  const national = contacts.filter((c) => !c.district_id), local = contacts.filter((c) => c.district_id);
  const ContactRow = ({ c }: { c: Contact }) => (
    <Tap onPress={() => Linking.openURL(`tel:${c.phone.replace(/[^0-9+]/g, '')}`)} accessibilityRole="button" accessibilityLabel={`${te ? c.name_te : c.name_en} ${c.phone}`} scaleTo={0.98}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(237,28,36,0.10)' }}><Icon name={KIND_ICON[c.kind] ?? 'call'} size={18} color={palette.red} /></View>
      <View style={{ flex: 1 }}><Txt v="title">{te ? c.name_te : c.name_en}</Txt>{c.address ? <Txt v="caption" muted numberOfLines={1}>{c.address}</Txt> : null}</View>
      <Txt v="h3" lang="en" color={palette.navy}>{c.phone}</Txt>
      <Icon name="call" size={18} color="#1F8A55" />
    </Tap>
  );
  return (
    <Screen back kicker={placeName(language, districtById(districtId))} title={L('అత్యవసర నంబర్లు, ధరలు', 'Helplines & prices')}>
      <Card>
        <Txt v="label" style={{ marginBottom: 4 }}>{L('అత్యవసర హెల్ప్‌లైన్లు', 'Emergency helplines')}</Txt>
        {national.map((c) => <ContactRow key={c.id} c={c} />)}
      </Card>
      {local.length > 0 && <Card><Txt v="label" style={{ marginBottom: 4 }}>{L('మీ జిల్లా', 'Your district')}</Txt>{local.map((c) => <ContactRow key={c.id} c={c} />)}</Card>}
      <Card>
        <Txt v="label">{L('ఈ రోజు ధరలు', "Today's prices")}</Txt>
        {prices.length === 0 ? <Txt v="bodySm" muted style={{ marginTop: 6 }}>{L('మీ జిల్లా ధరలు ఇంకా నమోదు కాలేదు.', 'Prices for your district have not been entered yet.')}</Txt>
          : prices.map((p) => {
            const diff = p.previous_paise != null ? p.price_paise - p.previous_paise : 0;
            return (
              <View key={p.item} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.colors.border, gap: 8 }}>
                <View style={{ flex: 1 }}><Txt v="title">{(ITEMS[p.item] ?? [p.item, p.item])[te ? 0 : 1]}</Txt><Txt v="caption" muted numberOfLines={1}>{p.unit} · {p.source}</Txt></View>
                <Txt v="h3" lang="en">{rupees(p.price_paise)}</Txt>
                {diff !== 0 && <View style={{ flexDirection: 'row', alignItems: 'center' }}><Icon name={diff > 0 ? 'caret-up' : 'caret-down'} size={14} color={diff > 0 ? palette.red : '#1F8A55'} /><Txt v="caption" lang="en" color={diff > 0 ? palette.red : '#1F8A55'}>{rupees(Math.abs(diff))}</Txt></View>}
              </View>
            );
          })}
        {prices.length > 0 && <Txt v="caption" muted style={{ marginTop: 8 }}>{L('ధరలు మార్కెట్‌ను బట్టి మారవచ్చు.', 'Prices vary by shop and market.')}</Txt>}
      </Card>
      <View style={{ height: 30 }} />
    </Screen>
  );
}
