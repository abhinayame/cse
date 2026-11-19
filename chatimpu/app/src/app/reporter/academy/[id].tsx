import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Icon, Tap, Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { Banner, Card } from '@/reporter/ui';
import { loadLessons, submitQuiz, type Lesson, type QuizResult } from '@/lib/community';
import { usePrefs } from '@/store/prefs';
import { palette, radius, useTheme } from '@/theme';

export default function LessonScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const te = usePrefs((s) => s.language) === 'te';
  const L = (a: string, b: string) => (te ? a : b);
  const lang = te ? 'te' : 'en';
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadLessons().then(setLessons); setAnswers([]); setResult(null); }, [id]);
  const idx = lessons.findIndex((l) => l.id === id);
  const l = lessons[idx];
  if (!l) return <Screen back title=""><View /></Screen>;
  const next = lessons[idx + 1];
  const blocks = (te ? l.body_te : l.body_en).split(/\n\n+/);
  const check = async () => {
    setBusy(true); setErr('');
    try { setResult(await submitQuiz(l.id, l.quiz.map((_, i) => answers[i] ?? -1))); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <Screen back kicker={L(`పాఠం ${idx + 1} / ${lessons.length}`, `Lesson ${idx + 1} of ${lessons.length}`)} title={te ? l.title_te : l.title_en}>
      <Card>
        {blocks.map((b, i) => (
          <View key={i} style={{ marginBottom: 10, gap: 6 }}>
            {b.split('\n').map((line, j) => line.startsWith('• ')
              ? <View key={j} style={{ flexDirection: 'row', gap: 8 }}><Txt v="body" color={palette.red}>•</Txt><Txt v="body" lang={lang} style={{ flex: 1 }}>{line.slice(2)}</Txt></View>
              : <Txt key={j} v="body" lang={lang}>{line}</Txt>)}
          </View>
        ))}
      </Card>
      <Txt v="overline" muted style={{ marginHorizontal: 20, marginTop: 22 }}>{L('క్విజ్', 'Quiz')}</Txt>
      {l.quiz.map((q, qi) => {
        const wrong = result?.wrong.includes(qi + 1);
        return (
          <Card key={qi} style={wrong ? { borderColor: palette.red } : result?.passed ? { borderColor: '#1F8A55' } : undefined}>
            <Txt v="title" lang={lang} style={{ marginBottom: 10 }}>{qi + 1}. {te ? q.q_te : q.q_en}</Txt>
            {q.options.map((o, oi) => {
              const sel = answers[qi] === oi;
              return (
                <Tap key={oi} onPress={() => { const a = [...answers]; a[qi] = oi; setAnswers(a); setResult(null); }} disabled={result?.passed}
                  accessibilityRole="radio" accessibilityState={{ selected: sel }} scaleTo={0.99}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 6, borderRadius: radius.md, borderWidth: 1, borderColor: sel ? palette.navy : t.colors.border, backgroundColor: sel ? palette.navyTint : 'transparent' }}>
                  <Icon name={sel ? 'radio-button-on' : 'radio-button-off'} size={18} color={sel ? palette.navy : t.colors.textMuted} />
                  <Txt v="bodySm" lang={lang} style={{ flex: 1 }} color={sel && !t.dark ? palette.navy : undefined}>{te ? o.te : o.en}</Txt>
                </Tap>
              );
            })}
            {wrong && <Txt v="caption" color={palette.red}>{L('ఈ జవాబు సరికాదు. పాఠం మళ్ళీ చదివి ప్రయత్నించండి.', 'Not quite. Re-read the lesson and try again.')}</Txt>}
          </Card>
        );
      })}
      <View style={{ margin: 20, gap: 10 }}>
        {result?.passed && <Banner tone="good" text={L(`సరైన జవాబులు! ${result.completed}/${result.lessons} పాఠాలు పూర్తి.`, `All correct! ${result.completed} of ${result.lessons} lessons completed.`)} />}
        {result && !result.passed && <Banner tone="warn" text={L(`${result.total}లో ${result.score} సరైనవి.`, `${result.score} of ${result.total} correct.`)} />}
        {!!err && <Banner tone="bad" text={err} />}
        {result?.passed
          ? <Button label={next ? L('తదుపరి పాఠం', 'Next lesson') : L('అకాడమీకి తిరిగి', 'Back to the Academy')} icon={next ? 'arrow-forward' : 'school'}
              onPress={() => (next ? router.replace(`/reporter/academy/${next.id}`) : router.back())} />
          : <Button label={L('జవాబులు తనిఖీ చేయండి', 'Check answers')} icon="checkmark-done" loading={busy} disabled={answers.filter((a) => a !== undefined).length < l.quiz.length} onPress={check} />}
      </View>
    </Screen>
  );
}
