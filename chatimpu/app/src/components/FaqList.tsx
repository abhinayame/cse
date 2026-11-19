import { useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Icon, Tap, Txt } from '@/components/ui';
import { loadFaqs, type Faq } from '@/lib/community';
import { radius, useTheme } from '@/theme';

/** Searchable, grouped FAQ accordion (Telugu or English, from the CMS-managed faqs table). */
export function FaqList({ audience, te }: { audience: Faq['audience']; te: boolean }) {
  const t = useTheme();
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => { loadFaqs(audience).then(setFaqs); }, [audience]);
  const lang = te ? 'te' : 'en';
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const m = new Map<string, Faq[]>();
    for (const f of faqs) {
      const qq = te ? f.question_te : f.question_en, a = te ? f.answer_te : f.answer_en;
      if (needle && !`${qq} ${a} ${f.question_en}`.toLowerCase().includes(needle)) continue;
      const cat = (te && f.category_te) || f.category;
      m.set(cat, [...(m.get(cat) ?? []), f]);
    }
    return [...m.entries()];
  }, [faqs, q, te]);
  return (
    <View style={{ marginHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 46, borderRadius: radius.pill, backgroundColor: t.colors.surfaceAlt, marginBottom: 8 }}>
        <Icon name="search" size={17} color={t.colors.textMuted} />
        <TextInput value={q} onChangeText={setQ} placeholder={te ? 'ప్రశ్న వెతకండి' : 'Search questions'} placeholderTextColor={t.colors.textFaint}
          accessibilityLabel={te ? 'ప్రశ్న వెతకండి' : 'Search questions'} style={{ flex: 1, color: t.colors.text, fontSize: 16, fontFamily: t.fonts.body }} />
      </View>
      {groups.map(([cat, list]) => (
        <View key={cat} style={{ marginTop: 14 }}>
          <Txt v="overline" muted style={{ marginBottom: 6 }}>{cat}</Txt>
          <Animated.View layout={LinearTransition} style={{ borderRadius: radius.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, overflow: 'hidden' }}>
            {list.map((f, i) => {
              const isOpen = open === f.id;
              return (
                <View key={f.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: t.colors.border }}>
                  <Tap onPress={() => setOpen(isOpen ? null : f.id)} scaleTo={0.99} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
                    <Txt v="title" lang={lang} style={{ flex: 1 }}>{te ? f.question_te : f.question_en}</Txt>
                    <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={17} color={t.colors.textMuted} />
                  </Tap>
                  {isOpen && <Animated.View entering={FadeIn} style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                    <Txt v="bodySm" lang={lang} style={{ color: t.colors.textMuted }}>{te ? f.answer_te : f.answer_en}</Txt>
                  </Animated.View>}
                </View>
              );
            })}
          </Animated.View>
        </View>
      ))}
      {!groups.length && <Txt v="bodySm" muted style={{ marginTop: 16 }}>{te ? 'సమాధానం దొరకలేదు. మాకు రాయండి.' : 'No match. Write to us below.'}</Txt>}
    </View>
  );
}
