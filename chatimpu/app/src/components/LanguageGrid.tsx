import { View } from 'react-native';
import { Tap, Txt } from '@/components/ui';
import { LANGUAGES } from '@/i18n';
import { palette, radius, shadow, useTheme } from '@/theme';

export function LanguageGrid({ value, onChange }: { value: string; onChange: (c: (typeof LANGUAGES)[number]['code']) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {LANGUAGES.map((l) => {
        const sel = l.code === value;
        return (
          <Tap key={l.code} onPress={() => onChange(l.code)} accessibilityRole="radio" accessibilityState={{ selected: sel }} accessibilityLabel={l.english}
            style={[{ width: '30.8%', aspectRatio: 0.92, borderRadius: radius.lg, padding: 12, justifyContent: 'space-between',
              backgroundColor: sel ? (t.dark ? '#1F1F1F' : palette.paper) : t.colors.surface, borderWidth: sel ? 2 : 1, borderColor: sel ? t.colors.accent : t.colors.border }, sel && shadow.soft]}>
            <Txt lang={l.code} v="h1" color={sel ? t.colors.accentText : t.colors.text} style={[{ fontSize: 30 }, l.code === 'te' && { fontFamily: 'Ramabhadra_400Regular', lineHeight: 52 }]}>{l.glyph}</Txt>
            <View>
              <Txt lang={l.code} v="title" numberOfLines={1} style={l.code === 'te' ? { fontFamily: 'Ramabhadra_400Regular', lineHeight: 30 } : undefined}>{l.native}</Txt>
              <Txt lang="en" v="caption" muted>{l.english}</Txt>
            </View>
          </Tap>
        );
      })}
    </View>
  );
}
