import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { usePrefs } from '@/store/prefs';
import { listSubmissions, type Submission } from '@/reporter/api';
import { useRT } from '@/reporter/i18n';
import { Banner, Card, ListRow, Seg, go, subStatus, when } from '@/reporter/ui';

const FILTERS = { all: null, review: ['submitted', 'ai_processing', 'under_review', 'on_hold'], correction: ['correction_required'], published: ['approved', 'published'], drafts: ['draft'] } as const;

export default function Submissions() {
  const rt = useRT(); const te = usePrefs((s) => s.language) === 'te';
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [f, setF] = useState<keyof typeof FILTERS>('all');
  const [err, setErr] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { listSubmissions().then(setRows).catch((e) => setErr(e.message)); }, []));
  const shown = (rows ?? []).filter((r) => !FILTERS[f] || (FILTERS[f] as readonly string[]).includes(r.status));
  return (
    <Screen back title={rt('myNews')}>
      <Seg value={f} onChange={setF} options={[['all', rt('all')], ['review', rt('inReview')], ['correction', rt('needsCorrection')], ['published', rt('published')], ['drafts', rt('drafts')]]} />
      {err && <View style={{ margin: 20 }}><Banner tone="bad" text={err} /></View>}
      <Card style={{ paddingVertical: 0 }}>
        {rows === null ? <Txt v="bodySm" muted style={{ padding: 20 }}>…</Txt> : shown.length === 0 ? <Txt v="bodySm" muted align="center" style={{ padding: 24 }}>{rt('noSubmissions')}</Txt> : shown.map((s) => (
          <ListRow key={s.id} title={s.headline || '—'} meta={`${s.code ?? rt('s_draft')} · ${when(s.updated_at, te)}${s.status === 'correction_required' && s.correction_note ? `\n✎ ${s.correction_note}` : ''}`}
            right={subStatus(rt, s.status)} onPress={() => go(s.status === 'draft' || s.status === 'correction_required' ? `/reporter/submit/${s.id}` : `/reporter/submissions/${s.id}`)} />
        ))}
      </Card>
    </Screen>
  );
}
