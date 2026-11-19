import { useCallback, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Button, Chip, Icon, Tap, Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { Banner, Pill } from '@/reporter/ui';
import { POST_KINDS, loadCommunity, rupees, type CommunityPost, type PostKind } from '@/lib/community';
import { isDemoMode } from '@/lib/supabase';
import { districtById, placeName } from '@/data/locations';
import { timeAgo } from '@/lib/time';
import { useT } from '@/i18n';
import { usePrefs } from '@/store/prefs';
import { palette, radius, useTheme } from '@/theme';

/** Moderated community board for the reader's district. */
export default function Community() {
  const t = useTheme();
  const tr = useT();
  const { language, districtId } = usePrefs();
  const te = language === 'te';
  const L = (a: string, b: string) => (te ? a : b);
  const [kind, setKind] = useState<PostKind | 'all'>('all');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [err, setErr] = useState('');
  useFocusEffect(useCallback(() => { loadCommunity(districtId, kind).then(setPosts, (e) => setErr(e.message)); }, [districtId, kind]));
  const label = (k: PostKind) => { const x = POST_KINDS.find((p) => p[0] === k)!; return te ? x[1] : x[2]; };
  return (
    <Screen back kicker={placeName(language, districtById(districtId))} title={L('కమ్యూనిటీ బోర్డు', 'Community board')}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 12 }}>
        <Chip small label={L('అన్నీ', 'All')} selected={kind === 'all'} onPress={() => setKind('all')} />
        {POST_KINDS.map(([k, a, b]) => <Chip key={k} small label={te ? a : b} selected={kind === k} onPress={() => setKind(k)} />)}
      </ScrollView>
      <View style={{ marginHorizontal: 20, marginBottom: 12 }}>
        <Button icon="add" label={L('పోస్ట్ చేయండి', 'Post on the board')} onPress={() => router.push('/community/new')} />
      </View>
      {isDemoMode && <View style={{ marginHorizontal: 20 }}><Banner text={L('కమ్యూనిటీ పోస్ట్‌లు బ్యాకెండ్ కనెక్ట్ చేశాక కనిపిస్తాయి.', 'Community posts appear once the app is connected to the backend.')} /></View>}
      {!!err && <View style={{ marginHorizontal: 20 }}><Banner tone="bad" text={err} /></View>}
      <View style={{ marginHorizontal: 20, gap: 12 }}>
        {posts.map((p) => {
          const kindInfo = POST_KINDS.find((k) => k[0] === p.kind)!;
          return (
            <View key={p.id} style={{ borderRadius: radius.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: p.kind === 'obituary' ? t.colors.textMuted : t.colors.border, overflow: 'hidden' }}>
              {p.photo && <Image source={{ uri: p.photo }} style={{ width: '100%', aspectRatio: 16 / 10 }} contentFit="cover" />}
              <View style={{ padding: 14, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name={kindInfo[3]} size={14} color={palette.red} />
                  <Txt v="overline" color={palette.red} style={{ flex: 1 }}>{label(p.kind)} · {timeAgo(p.created_at, tr)}</Txt>
                  {p.mine && p.status !== 'approved' && <Pill status={p.status === 'pending' ? 'pending' : 'rejected'} text={p.status === 'pending' ? L('పరిశీలనలో', 'In review') : L('ఆమోదం కాలేదు', 'Not approved')} />}
                </View>
                <Txt v="title">{p.title}</Txt>
                <Txt v="bodySm" style={{ color: t.colors.textMuted }}>{p.body}</Txt>
                {p.price_paise != null && <Txt v="h3" lang="en">{rupees(p.price_paise)}</Txt>}
                {p.event_at && <Txt v="caption">{new Date(p.event_at).toLocaleString(te ? 'te-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</Txt>}
                {p.mine && p.reject_reason && <Txt v="caption" color={palette.red}>{p.reject_reason}</Txt>}
                {p.contact_phone && (
                  <Tap onPress={() => Linking.openURL(`tel:${p.contact_phone}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: 'rgba(31,138,85,0.12)' }}>
                    <Icon name="call" size={15} color="#1F8A55" /><Txt v="label" color="#1F8A55">{L('కాల్ చేయండి', 'Call')}</Txt>
                  </Tap>
                )}
              </View>
            </View>
          );
        })}
        {!isDemoMode && !posts.length && !err && <Txt v="bodySm" muted>{L('ఇంకా పోస్ట్‌లు లేవు. మొదటిది మీరే పెట్టండి!', 'No posts yet. Be the first!')}</Txt>}
      </View>
      <Txt v="caption" muted style={{ marginHorizontal: 20, marginTop: 18, marginBottom: 30 }}>{L('ప్రతి పోస్ట్‌ను మా బృందం తనిఖీ చేస్తుంది. డబ్బు ముందుగా పంపమని అడిగే వారితో జాగ్రత్త.', 'Every post is checked by our team. Be careful with anyone who asks for money in advance.')}</Txt>
    </Screen>
  );
}
