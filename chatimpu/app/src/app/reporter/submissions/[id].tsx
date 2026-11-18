import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Button, Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { palette, radius, useTheme } from '@/theme';
import { usePrefs } from '@/store/prefs';
import { getSubmission, history, listMedia, signedUrl, type Media, type Submission } from '@/reporter/api';
import { useRT } from '@/reporter/i18n';
import { Banner, Card, go, subStatus, when } from '@/reporter/ui';

const STEPS = ['submitted', 'ai_processing', 'under_review', 'approved', 'published'];

export default function SubmissionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rt = useRT(); const t = useTheme(); const te = usePrefs((s) => s.language) === 'te';
  const [s, setS] = useState<Submission | null>(null);
  const [media, setMedia] = useState<(Media & { url: string | null })[]>([]);
  const [hist, setHist] = useState<Awaited<ReturnType<typeof history>>>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        setS(await getSubmission(id));
        const [m, h] = await Promise.all([listMedia(id), history(id)]);
        setMedia(await Promise.all(m.map(async (x) => ({ ...x, url: await signedUrl(x.bucket, x.storage_path) }))));
        setHist(h);
      } catch (e) { setErr((e as Error).message); }
    })();
  }, [id]);
  if (err) return <Screen back title={rt('timeline')}><View style={{ margin: 20 }}><Banner tone="bad" text={err} /></View></Screen>;
  if (!s) return <Screen back title="…"><Txt muted style={{ margin: 20 }}>…</Txt></Screen>;
  const reached = STEPS.indexOf(['on_hold', 'correction_required', 'rejected'].includes(s.status) ? 'under_review' : s.status);
  return (
    <Screen back kicker={s.code ?? ''} title={rt(`t_${s.submission_type}` as never)}>
      <View style={{ marginHorizontal: 20, gap: 10 }}>
        {subStatus(rt, s.status)}
        <Txt v="h2" lang={s.lang}>{s.headline}</Txt>
        {s.status === 'correction_required' && <Banner tone="warn" text={`${rt('editorNote')}: ${s.correction_note ?? ''}`} action={{ label: rt('edit'), onPress: () => go(`/reporter/submit/${s.id}`) }} />}
        {s.status === 'rejected' && s.rejection_reason && <Banner tone="bad" text={`${rt('editorNote')}: ${s.rejection_reason}`} />}
        {s.status === 'published' && s.story_id && <Button kind="secondary" size="md" icon="newspaper" label={rt('s_published')} onPress={() => go(`/story/${s.story_id}`)} />}
      </View>
      {s.status !== 'draft' && s.status !== 'rejected' && (
        <Card>
          <Txt v="title" style={{ marginBottom: 10 }}>{rt('timeline')}</Txt>
          <View style={{ flexDirection: 'row', gap: 4 }}>{STEPS.map((st, i) => <View key={st} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= reached ? palette.red : t.colors.surfaceAlt }} />)}</View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>{STEPS.map((st) => <Txt key={st} v="caption" muted style={{ fontSize: 10, flex: 1 }} numberOfLines={2}>{rt(`s_${st}` as never)}</Txt>)}</View>
        </Card>
      )}
      <Card>
        {media.filter((m) => m.kind === 'photo').length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {media.filter((m) => m.kind === 'photo').map((m) => <Image key={m.id} source={{ uri: m.url ?? undefined }} style={{ width: 96, height: 96, borderRadius: radius.md }} contentFit="cover" />)}
          </View>
        )}
        <Txt v="body" lang={s.lang}>{s.body}</Txt>
        <Txt v="caption" muted style={{ marginTop: 10 }}>{[s.locality, s.incident_location].filter(Boolean).join(' · ')}</Txt>
      </Card>
      {hist.length > 0 && (
        <Card>
          {hist.map((h) => (
            <View key={h.id} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.red, marginTop: 7 }} />
              <View style={{ flex: 1 }}><Txt v="label">{rt(`s_${h.to_status}` as never) ?? h.to_status} <Txt v="caption" muted>· {when(h.created_at, te)}</Txt></Txt>{h.note ? <Txt v="caption" muted>{h.note}</Txt> : null}</View>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
