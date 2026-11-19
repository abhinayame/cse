import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Icon, Tap, Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { Banner } from '@/reporter/ui';
import { academyProgress, loadLessons, type Lesson } from '@/lib/community';
import { usePrefs } from '@/store/prefs';
import { palette, radius, useTheme } from '@/theme';

/** Reporter Academy: short lessons on writing, checking facts, photos, the law and safety. */
export default function Academy() {
  const t = useTheme();
  const te = usePrefs((s) => s.language) === 'te';
  const L = (a: string, b: string) => (te ? a : b);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [passed, setPassed] = useState<string[]>([]);
  useFocusEffect(useCallback(() => {
    loadLessons().then(setLessons);
    academyProgress().then((p) => setPassed(p.passed_ids)).catch(() => {});
  }, []));
  const done = lessons.length > 0 && lessons.every((l) => passed.includes(l.id));
  return (
    <Screen back title={L('రిపోర్టర్ అకాడమీ', 'Reporter Academy')}>
      <Txt v="bodySm" muted style={{ marginHorizontal: 20, marginBottom: 14 }}>
        {L('ప్రతి పాఠం 2 నిమిషాలు. చివర్లో క్విజ్‌లో అన్ని జవాబులు సరిగా ఉంటే పాఠం పూర్తవుతుంది. ఎడిటర్లు మీ పురోగతిని చూస్తారు.', 'Each lesson takes about 2 minutes. Answer every quiz question correctly to complete it. Editors can see your progress.')}
      </Txt>
      {done && <View style={{ marginHorizontal: 20, marginBottom: 12 }}><Banner tone="good" text={L('అభినందనలు! మీరు అకాడమీ పూర్తి చేశారు.', 'Well done! You have completed the Academy.')} /></View>}
      <View style={{ marginHorizontal: 20, gap: 10 }}>
        {lessons.map((l, i) => {
          const ok = passed.includes(l.id);
          return (
            <Tap key={l.id} onPress={() => router.push(`/reporter/academy/${l.id}`)} scaleTo={0.98} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: ok ? '#1F8A55' : t.colors.border }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: ok ? '#1F8A55' : palette.navyTint }}>
                {ok ? <Icon name="checkmark" size={22} color={palette.white} /> : <Txt v="title" lang="en" color={palette.navy}>{i + 1}</Txt>}
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="title">{te ? l.title_te : l.title_en}</Txt>
                <Txt v="caption" muted>{ok ? L('పూర్తయింది', 'Completed') : L(`${l.quiz.length} ప్రశ్నలు`, `${l.quiz.length} questions`)}</Txt>
              </View>
              <Icon name="chevron-forward" size={18} color={t.colors.textFaint} />
            </Tap>
          );
        })}
      </View>
      <View style={{ height: 30 }} />
    </Screen>
  );
}
