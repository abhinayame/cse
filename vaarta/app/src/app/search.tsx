import { useEffect, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Chip, EmptyState, Icon, Tap, Txt } from '@/components/ui';
import { StoryRow } from '@/components/StoryRow';
import { searchStories, type SearchFilters } from '@/lib/api';
import { CATEGORIES } from '@/lib/categories';
import { DISTRICTS, placeName } from '@/data/locations';
import { usePrefs } from '@/store/prefs';
import { useT } from '@/i18n';
import { radius, useTheme } from '@/theme';
import type { Story } from '@/data/types';

const DATES = [{ h: 0, l: 'any' }, { h: 24, l: '24h' }, { h: 24 * 7, l: '7d' }] as const;

export default function Search() {
  const t = useTheme();
  const tr = useT();
  const insets = useSafeAreaInsets();
  const lang = usePrefs((s) => s.language);
  const [f, setF] = useState<SearchFilters>({ q: '' });
  const [res, setRes] = useState<Story[]>([]);
  useEffect(() => { const id = setTimeout(() => searchStories(f).then(setRes), 120); return () => clearTimeout(id); }, [f]);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top + 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
        <View style={{ flex: 1, height: 48, borderRadius: radius.pill, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 }}>
          <Icon name="search" size={18} color={t.colors.textMuted} />
          <TextInput autoFocus value={f.q} onChangeText={(q) => setF({ ...f, q })} placeholder={tr('searchPlaceholder')} placeholderTextColor={t.colors.textFaint}
            style={{ flex: 1, color: t.colors.text, fontFamily: t.fonts.body, fontSize: 16, outlineStyle: 'none' } as never} returnKeyType="search" accessibilityLabel={tr('searchPlaceholder')} />
          {!!f.q && <Tap onPress={() => setF({ ...f, q: '' })}><Icon name="close-circle" size={18} color={t.colors.textFaint} /></Tap>}
        </View>
        <Tap onPress={() => router.back()}><Txt v="label" color={t.colors.accentText}>{tr('cancel')}</Txt></Tap>
      </View>
      <FlatList
        data={res}
        keyExtractor={(s) => s.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
        ListHeaderComponent={
          <View style={{ gap: 10, paddingVertical: 14 }}>
            <FilterRow label={tr('district')}>
              <Chip small label={tr('any')} selected={!f.districtId} onPress={() => setF({ ...f, districtId: undefined })} />
              {DISTRICTS.map((d) => <Chip key={d.id} small label={placeName(lang, d)} selected={f.districtId === d.id} onPress={() => setF({ ...f, districtId: d.id })} />)}
            </FilterRow>
            <FilterRow label={tr('category')}>
              <Chip small label={tr('any')} selected={!f.category} onPress={() => setF({ ...f, category: undefined })} />
              {CATEGORIES.map((c) => <Chip key={c.id} small label={tr(`cat_${c.id}`)} selected={f.category === c.id} onPress={() => setF({ ...f, category: c.id })} />)}
            </FilterRow>
            <FilterRow label={`${tr('date')} · ${tr('language')}`}>
              {DATES.map((d) => <Chip key={d.l} small label={d.l === 'any' ? tr('any') : d.l} selected={(f.sinceHours ?? 0) === d.h} onPress={() => setF({ ...f, sinceHours: d.h || undefined })} />)}
              <Chip small label="English" selected={f.lang === 'en'} onPress={() => setF({ ...f, lang: f.lang === 'en' ? undefined : 'en' })} />
              <Chip small label="తెలుగు" selected={f.lang === 'te'} onPress={() => setF({ ...f, lang: f.lang === 'te' ? undefined : 'te' })} />
            </FilterRow>
            <Txt v="caption" muted style={{ paddingHorizontal: 20 }}>{res.length} results</Txt>
          </View>
        }
        renderItem={({ item }) => <Animated.View entering={FadeIn}><StoryRow story={item} lang={lang} /></Animated.View>}
        ListEmptyComponent={<EmptyState title={tr('noResults')} />}
      />
    </View>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Txt v="overline" muted style={{ paddingHorizontal: 20 }}>{label}</Txt>
      <FlatList horizontal data={[0]} renderItem={() => <View style={{ flexDirection: 'row', gap: 8 }}>{children}</View>} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled" />
    </View>
  );
}
