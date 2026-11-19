/** Daily WhatsApp status: swipe through today's cards, share one to WhatsApp as an image. */
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, FlatList, Platform, ScrollView, Share, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, Icon, Tap, Txt } from '@/components/ui';
import { StatusCardView } from '@/components/StatusCardView';
import { STATUS_KIND_LABEL, type StatusCard, type StatusKind } from '@/data/status';
import { bumpStatusShare, loadStatusCards } from '@/lib/status';
import { compact } from '@/lib/time';
import { haptic } from '@/lib/haptics';
import { usePrefs } from '@/store/prefs';
import { useT } from '@/i18n';
import { palette } from '@/theme';
import { APP } from '@/config';

export default function StatusScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tr = useT();
  const lang = usePrefs((s) => s.language);
  const [cards, setCards] = useState<StatusCard[] | null>(null);
  const [kind, setKind] = useState<StatusKind | 'all'>('all');
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const refs = useRef<Record<string, ComponentRef<typeof View> | null>>({});
  useEffect(() => { loadStatusCards(lang).then(setCards).catch(() => setCards([])); }, [lang]);
  const shown = useMemo(() => (cards ?? []).filter((c) => kind === 'all' || c.kind === kind), [cards, kind]);
  const kinds = useMemo(() => [...new Set((cards ?? []).map((c) => c.kind))], [cards]);
  const pageH = height - insets.top - 56 - 96 - insets.bottom;
  const cardW = Math.min(width - 40, Math.round(pageH * 9 / 16));
  const te = lang === 'te';

  const share = async (c: StatusCard) => {
    setBusy(true); haptic.success();
    try {
      bumpStatusShare(c.id);
      setCards((x) => x?.map((y) => (y.id === c.id ? { ...y, shares: y.shares + 1 } : y)) ?? null);
      const node = refs.current[c.id];
      if (node && Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
        const uri = await captureRef(node, { format: 'png', quality: 0.95, width: 1080, height: 1920 });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'WhatsApp status', UTI: 'public.png' });
      } else {
        await Share.share({ message: `${c.text}\n\n${APP.nameTe} · www.${APP.domain}` });
      }
    } catch { /* user cancelled */ } finally { setBusy(false); }
  };

  const current = shown[index];
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name="logo-whatsapp" size={24} color="#25D366" />
        <Txt v="h3" color={palette.white} style={{ flex: 1 }}>{te ? 'వాట్సాప్ స్టేటస్' : 'WhatsApp Status'}</Txt>
        <Tap onPress={() => router.back()} accessibilityLabel="Close" style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' }}>
          <Icon name="close" size={22} color={palette.white} />
        </Tap>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 8 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        <Chip small glass label={te ? 'అన్నీ' : 'All'} selected={kind === 'all'} onPress={() => { setKind('all'); setIndex(0); }} />
        {kinds.map((k) => <Chip key={k} small glass label={te ? STATUS_KIND_LABEL[k].te : STATUS_KIND_LABEL[k].en} selected={kind === k} onPress={() => { setKind(k); setIndex(0); }} />)}
      </ScrollView>
      {cards === null ? <ActivityIndicator color={palette.white} style={{ flex: 1 }} /> : (
        <FlatList
          key={kind}
          data={shown}
          keyExtractor={(c) => c.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.y / pageH))}
          getItemLayout={(_, i) => ({ length: pageH, offset: pageH * i, index: i })}
          style={{ flex: 1, marginTop: 8 }}
          renderItem={({ item }) => (
            <View style={{ height: pageH, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ borderRadius: 22, overflow: 'hidden' }}>
                <StatusCardView ref={(r) => { refs.current[item.id] = r; }} card={item} width={cardW} />
              </View>
            </View>
          )}
          ListEmptyComponent={<Txt color="#BDBDBD" align="center" style={{ marginTop: 60 }}>{tr('noResults')}</Txt>}
        />
      )}
      {current && (
        <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16, paddingTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Txt v="caption" color="#BDBDBD" style={{ flex: 1 }}>{index + 1} / {shown.length} · {compact(current.shares)} {te ? 'షేర్లు' : 'shares'}</Txt>
          <Tap onPress={() => share(current)} disabled={busy} accessibilityRole="button" accessibilityLabel="Share to WhatsApp status"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, paddingHorizontal: 22, borderRadius: 26, backgroundColor: '#25D366' }}>
            {busy ? <ActivityIndicator color={palette.white} /> : <Icon name="logo-whatsapp" size={22} color={palette.white} />}
            <Txt v="title" color={palette.white}>{te ? 'స్టేటస్‌గా షేర్' : 'Share as status'}</Txt>
          </Tap>
        </View>
      )}
    </View>
  );
}
