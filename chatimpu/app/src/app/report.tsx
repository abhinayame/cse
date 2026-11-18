/**
 * Citizen Reporter: verified users submit news with photos/videos, location and category.
 * Submissions follow the contributor workflow (draft → submitted → automated checks → under review) and
 * appear on the CMS editorial desk. Contributors can track them in the reporter portal (/reporter).
 */
import { useState } from 'react';
import { ScrollView, Switch, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Button, Chip, EmptyState, Icon, Tap, Txt } from '@/components/ui';
import { OtpLogin } from '@/components/OtpLogin';
import { CATEGORIES } from '@/lib/categories';
import { submitCitizenReport } from '@/lib/api';
import { wordCount } from '@/lib/text';
import { districtById, mandalById, placeName } from '@/data/locations';
import { usePrefs } from '@/store/prefs';
import { useT } from '@/i18n';
import { radius, useTheme } from '@/theme';
import type { CategoryId, ContentLang } from '@/data/types';
import { haptic } from '@/lib/haptics';

export default function Report() {
  const t = useTheme();
  const tr = useT();
  const insets = useSafeAreaInsets();
  const p = usePrefs();
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [media, setMedia] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [rights, setRights] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState<string | undefined>();

  const pickMedia = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: 4, quality: 0.8 });
    if (!r.canceled) setMedia([...media, ...r.assets.map((a) => a.uri)].slice(0, 4));
  };
  const capture = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
    if (!r.canceled) setMedia([...media, r.assets[0].uri].slice(0, 4));
  };
  const words = wordCount(body || ' ') - (body ? 0 : 1);
  const valid = headline.trim().length > 10 && words >= 30 && category && rights;
  const submit = async () => {
    if (!valid) return;
    setBusy(true); setErr(null);
    try {
      const r = await submitCitizenReport({ headline, body, category: category!, lang: p.language as ContentLang, districtId: p.districtId, mandalId: p.mandalId, media, rightsConfirmed: rights });
      setCode(r.code); haptic.success(); setDone(true);
    } catch (e) {
      setErr((e as Error).message || 'Could not submit. Please try again.');
    } finally { setBusy(false); }
  };

  const input = { borderRadius: radius.md, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.surface, color: t.colors.text, padding: 14, fontFamily: t.fonts.body, fontSize: 16 };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="h2">{tr('citizenReporter')}</Txt>
        <Tap onPress={() => router.back()} accessibilityLabel="Close" style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.surfaceAlt }}><Icon name="close" size={20} /></Tap>
      </View>
      {done ? (
        <Animated.View entering={ZoomIn.springify()} style={{ flex: 1, justifyContent: 'center', padding: 20, gap: 20 }}>
          <EmptyState title="✓" sub={code ? `${tr('submitted')} · ${code}` : tr('submitted')} />
          <Button label={tr('done')} onPress={() => router.back()} />
        </Animated.View>
      ) : !p.user?.verified ? (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View style={{ padding: 14, borderRadius: radius.md, backgroundColor: t.colors.surfaceAlt, flexDirection: 'row', gap: 10 }}>
            <Icon name="shield-checkmark" size={20} color={t.colors.success} />
            <Txt v="bodySm" style={{ flex: 1 }}>{tr('verifiedOnly')}</Txt>
          </View>
          <OtpLogin onDone={() => {}} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="location" size={15} color={t.colors.accentText} />
            <Txt v="label" muted>{placeName(p.language, mandalById(p.mandalId))}, {placeName(p.language, districtById(p.districtId))}</Txt>
          </View>
          <TextInput value={headline} onChangeText={setHeadline} placeholder={tr('title')} placeholderTextColor={t.colors.textFaint} style={[input, { fontFamily: t.fonts.headlineBold, fontSize: 20 }]} maxLength={120} accessibilityLabel={tr('title')} />
          <View>
            <TextInput value={body} onChangeText={setBody} placeholder={tr('description')} placeholderTextColor={t.colors.textFaint} multiline style={[input, { minHeight: 160, textAlignVertical: 'top' }]} accessibilityLabel={tr('description')} />
            <Txt v="caption" color={words > 80 ? t.colors.breakingText : t.colors.textMuted} style={{ alignSelf: 'flex-end', marginTop: 4 }}>{words} / 60–80 words</Txt>
          </View>
          <Txt v="label" muted>{tr('category')}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map((c) => <Chip key={c.id} small icon={c.icon} label={tr(`cat_${c.id}`)} selected={category === c.id} onPress={() => setCategory(c.id)} />)}
          </View>
          <Txt v="label" muted>{tr('addMedia')}</Txt>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {media.map((m) => (
              <Animated.View key={m} entering={FadeIn}>
                <Image source={{ uri: m }} style={{ width: 84, height: 84, borderRadius: radius.md }} />
                <Tap onPress={() => setMedia(media.filter((x) => x !== m))} style={{ position: 'absolute', top: -6, right: -6 }}><Icon name="close-circle" size={22} color={t.colors.breaking} /></Tap>
              </Animated.View>
            ))}
            {media.length < 4 && (
              <>
                <Tap onPress={capture} style={mediaBtn(t)}><Icon name="camera" size={24} color={t.colors.accentText} /></Tap>
                <Tap onPress={pickMedia} style={mediaBtn(t)}><Icon name="images" size={24} color={t.colors.accentText} /></Tap>
              </>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Switch value={rights} onValueChange={setRights} accessibilityLabel={tr('rightsConsent')} trackColor={{ true: t.colors.accent, false: t.colors.border }} />
            <Txt v="bodySm" style={{ flex: 1 }}>{tr('rightsConsent')}</Txt>
          </View>
          {err && <Txt v="bodySm" color={t.colors.breakingText} accessibilityRole="alert">{err}</Txt>}
          <Button label={tr('submit')} icon="send" disabled={!valid} loading={busy} onPress={submit} style={{ marginTop: 8 }} />
          <Txt v="caption" muted align="center">Submissions are reviewed by an editor before publishing. Do not share content you did not capture yourself.</Txt>
          <Tap onPress={() => router.push('/reporter')} accessibilityRole="link">
            <Txt v="label" color={t.colors.accentText} align="center">{tr('reporterHub')} →</Txt>
          </Tap>
        </ScrollView>
      )}
    </View>
  );
}

const mediaBtn = (t: ReturnType<typeof useTheme>) => ({ width: 84, height: 84, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed' as const, borderColor: t.colors.accent, alignItems: 'center' as const, justifyContent: 'center' as const });
