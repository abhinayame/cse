/** Submit or edit news (drafts, corrections). Originals go to the private `submissions` bucket. */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Switch, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Button, Chip, Icon, Tap, Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { DISTRICTS, MANDALS } from '@/data/locations';
import { CATEGORIES } from '@/lib/categories';
import { wordCount } from '@/lib/text';
import { useT } from '@/i18n';
import { palette, radius, useTheme } from '@/theme';
import { usePrefs } from '@/store/prefs';
import { haptic } from '@/lib/haptics';
import {
  addMedia, db, getSubmission, listMedia, removeMedia, rupees, safeName, saveSubmission, sendForReview, signedUrl, uploadUri,
  type Assignment, type Media, type Submission,
} from '@/reporter/api';
import { useRT } from '@/reporter/i18n';
import { Banner, Card, Field, useReporter } from '@/reporter/ui';

const TYPES = ['text_news', 'photo_story', 'video_story', 'detailed_report', 'civic_issue', 'education', 'government', 'event', 'community', 'business_jobs'] as const;
type Form = Pick<Submission, 'headline' | 'body' | 'submission_type' | 'category_id' | 'lang' | 'district_id' | 'mandal_id' | 'locality' | 'incident_location' | 'source_notes' | 'assignment_id' | 'rights_confirmed'>;

export default function SubmitScreen({ editId }: { editId?: string }) {
  const rt = useRT(); const tr = useT(); const t = useTheme();
  const params = useLocalSearchParams<{ assignment?: string }>();
  const lang = usePrefs((s) => s.language); const te = lang === 'te';
  const { dash, reload, userId } = useReporter();
  const p = dash.profile!;
  const [id, setId] = useState<string | null>(editId ?? null);
  const [f, setF] = useState<Form>({ headline: '', body: '', submission_type: 'text_news', category_id: (p.interests[0] ?? 'politics'), lang: p.preferred_language === 'en' ? 'en' : 'te',
    district_id: p.district_id, mandal_id: p.mandal_id, locality: p.locality, incident_location: '', source_notes: '', assignment_id: params.assignment ?? null, rights_confirmed: false });
  const [status, setStatus] = useState('draft');
  const [note, setNote] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [media, setMedia] = useState<(Media & { url?: string | null })[]>([]);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState<'save' | 'send' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const draft = useRef<Promise<string> | null>(null);
  const canSubmit = ['verified', 'active'].includes(p.status);

  const loadMedia = async (sid: string) => setMedia(await Promise.all((await listMedia(sid)).map(async (m) => ({ ...m, url: await signedUrl(m.bucket, m.storage_path) }))));
  useEffect(() => {
    if (!editId) return;
    getSubmission(editId).then((s) => {
      setStatus(s.status); setNote(s.correction_note);
      setF({ headline: s.headline, body: s.body, submission_type: s.submission_type, category_id: s.category_id, lang: s.lang, district_id: s.district_id, mandal_id: s.mandal_id,
        locality: s.locality, incident_location: s.incident_location ?? '', source_notes: s.source_notes ?? '', assignment_id: s.assignment_id, rights_confirmed: s.rights_confirmed });
      return loadMedia(editId);
    }).catch((e) => setErr(e.message));
  }, [editId]);
  useEffect(() => {
    const aid = f.assignment_id; if (!aid) return;
    db().from('reporter_assignments').select('*').eq('id', aid).single().then(({ data }) => {
      if (!data) return;
      setAssignment(data as Assignment);
      if (!editId) setF((x) => ({ ...x, district_id: data.district_id, mandal_id: data.mandal_id ?? x.mandal_id, locality: data.locality ?? x.locality }));
    });
  }, [f.assignment_id, editId]);

  const payload = () => ({ ...f, source_notes: f.source_notes || null, incident_location: f.incident_location || null });
  const ensureDraft = () => {
    if (id) return Promise.resolve(id);
    draft.current ??= saveSubmission(null, payload()).then((s) => { setId(s.id); return s.id; }).catch((e) => { draft.current = null; throw e; });
    return draft.current;
  };
  const pick = async (camera: boolean) => {
    setErr(null);
    if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return;
    const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: 6, quality: 0.85 });
    if (r.canceled) return;
    try {
      const sid = await ensureDraft();
      for (const a of r.assets) {
        setUploading((n) => n + 1);
        try {
          const video = a.type === 'video';
          const mime = a.mimeType ?? (video ? 'video/mp4' : 'image/jpeg');
          const path = `${userId}/${sid}/${Date.now()}-${safeName(a.fileName ?? (video ? 'video.mp4' : 'photo.jpg'))}`;
          const size = await uploadUri('submissions', path, a.uri, mime);
          await addMedia({ submission_id: sid, kind: video ? 'video' : 'photo', storage_path: path, mime_type: mime, size_bytes: size });
        } finally { setUploading((n) => n - 1); }
      }
      await loadMedia(sid);
    } catch (e) { setErr((e as Error).message); }
  };
  const save = async () => {
    setBusy('save'); setErr(null);
    try { const sid = await ensureDraft(); await saveSubmission(sid, payload()); haptic.success(); setErr(null); setNote(rt('draftSaved')); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const send = async () => {
    setBusy('send'); setErr(null);
    try {
      const sid = await ensureDraft(); await saveSubmission(sid, payload()); await sendForReview(sid);
      haptic.success(); await reload(); router.replace(`/reporter/submissions/${sid}`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  if (!['draft', 'correction_required'].includes(status)) return <Screen back title={rt('editSubmission')}><View style={{ margin: 20 }}><Banner text={rt(`s_${status}` as never)} /></View></Screen>;
  const mandals = MANDALS.filter((m) => m.districtId === f.district_id);
  const valid = canSubmit && f.rights_confirmed && f.headline.trim().length >= 10 && f.body.trim().length >= 40 && uploading === 0;

  return (
    <Screen back title={editId ? rt('editSubmission') : rt('newSubmission')} keyboardShouldPersistTaps="handled">
      <View style={{ marginHorizontal: 20, gap: 10 }}>
        {!canSubmit && <Banner tone="warn" text={rt(`stBanner_${p.status}` as never)} />}
        {status === 'correction_required' && note && <Banner tone="warn" text={`${rt('editorNote')}: ${note}`} />}
        {assignment && <Banner text={`${rt('forAssignment')} ${assignment.code}: ${assignment.title}${assignment.special_amount_paise ? ` · ${rt('special')} ${rupees(assignment.special_amount_paise)}` : ''}`} />}
      </View>
      <Card>
        <Txt v="label" style={{ marginBottom: 8 }}>{rt('type')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TYPES.map((ty) => <Chip key={ty} small label={rt(`t_${ty}` as never)} selected={f.submission_type === ty} onPress={() => setF({ ...f, submission_type: ty })} />)}
        </View>
      </Card>
      <Card>
        <Field label={rt('headline')} placeholder={rt('headlineHint')} value={f.headline} onChangeText={(v) => setF({ ...f, headline: v })} maxLength={160} />
        <Field label={rt('description')} placeholder={rt('descHint')} value={f.body} onChangeText={(v) => setF({ ...f, body: v })} multiline hint={`${wordCount(f.body || ' ') - (f.body ? 0 : 1)} ${rt('words')}`} style={{ minHeight: 170 }} />
        <Txt v="label" style={{ marginBottom: 6 }}>{rt('category')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {CATEGORIES.map((c) => <Chip key={c.id} small icon={c.icon} label={tr(`cat_${c.id}` as never)} selected={f.category_id === c.id} onPress={() => setF({ ...f, category_id: c.id })} />)}
        </View>
        <Txt v="label" style={{ marginBottom: 6 }}>{rt('newsLanguage')}</Txt>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[['te', 'తెలుగు'], ['en', 'English'], ['hi', 'हिन्दी']].map(([c, n]) => <Chip key={c} small label={n} selected={f.lang === c} onPress={() => setF({ ...f, lang: c })} />)}
        </View>
      </Card>
      <Card>
        <Txt v="label" style={{ marginBottom: 6 }}>{rt('district')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {DISTRICTS.map((d) => <Chip key={d.id} small label={te ? d.nameTe : d.name} selected={f.district_id === d.id} onPress={() => setF({ ...f, district_id: d.id, mandal_id: MANDALS.find((m) => m.districtId === d.id)?.id ?? null })} />)}
        </View>
        <Txt v="label" style={{ marginBottom: 6 }}>{rt('mandal')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {mandals.map((m) => <Chip key={m.id} small label={te ? m.nameTe : m.name} selected={f.mandal_id === m.id} onPress={() => setF({ ...f, mandal_id: m.id })} />)}
        </View>
        <Field label={rt('locality')} value={f.locality ?? ''} onChangeText={(v) => setF({ ...f, locality: v })} />
        <Field label={rt('incidentLocation')} value={f.incident_location ?? ''} onChangeText={(v) => setF({ ...f, incident_location: v })} />
      </Card>
      <Card>
        <Txt v="title" style={{ marginBottom: 10 }}>{rt('media')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {media.map((m) => (
            <View key={m.id}>
              {m.kind === 'photo' ? <Image source={{ uri: m.url ?? undefined }} style={{ width: 84, height: 84, borderRadius: radius.md }} contentFit="cover" />
                : <View style={{ width: 84, height: 84, borderRadius: radius.md, backgroundColor: t.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Icon name="videocam" size={26} /></View>}
              <Tap onPress={() => removeMedia(m).then(() => setMedia((x) => x.filter((y) => y.id !== m.id))).catch((e) => setErr(e.message))} accessibilityLabel={rt('remove')} style={{ position: 'absolute', top: -6, right: -6 }}>
                <Icon name="close-circle" size={22} color={palette.red} /></Tap>
            </View>
          ))}
          {uploading > 0 && <View style={{ width: 84, height: 84, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.surfaceAlt }}><ActivityIndicator color={palette.red} /><Txt v="caption" muted>{rt('uploading')}</Txt></View>}
          <Tap onPress={() => pick(true)} accessibilityLabel="Camera" style={{ width: 84, height: 84, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.red, alignItems: 'center', justifyContent: 'center' }}><Icon name="camera" size={26} color={palette.red} /></Tap>
          <Tap onPress={() => pick(false)} accessibilityLabel={rt('addMedia')} style={{ width: 84, height: 84, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.red, alignItems: 'center', justifyContent: 'center' }}><Icon name="images" size={26} color={palette.red} /></Tap>
        </View>
      </Card>
      <Card>
        <Field label={`🔒 ${rt('sources')}`} hint={rt('sourcesHint')} value={f.source_notes ?? ''} onChangeText={(v) => setF({ ...f, source_notes: v })} multiline />
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Switch value={f.rights_confirmed} onValueChange={(v) => setF({ ...f, rights_confirmed: v })} accessibilityLabel={rt('rights')} trackColor={{ true: palette.red, false: t.colors.border }} />
          <Txt v="bodySm" style={{ flex: 1 }}>{rt('rights')}</Txt>
        </View>
      </Card>
      <View style={{ marginHorizontal: 20, marginTop: 14, gap: 10 }}>
        {err && <Banner tone="bad" text={err} />}
        {!err && note === rt('draftSaved') && <Banner tone="good" text={rt('draftSaved')} />}
        <Button label={busy === 'send' ? rt('saving') : rt('sendForReview')} icon="send" loading={busy === 'send'} disabled={!valid || !!busy} onPress={send} />
        <Button kind="secondary" label={busy === 'save' ? rt('saving') : rt('saveDraft')} disabled={!!busy || uploading > 0} onPress={save} />
      </View>
    </Screen>
  );
}
