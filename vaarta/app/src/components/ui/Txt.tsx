import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme';
import { usePrefs } from '@/store/prefs';

export type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'bodySm' | 'caption' | 'label' | 'overline';

const sizes: Record<Variant, { size: number; lh: number; kind: 'headline' | 'body' | 'semibold'; ls?: number; upper?: boolean }> = {
  display: { size: 40, lh: 46, kind: 'headline', ls: -0.6 },
  h1: { size: 30, lh: 36, kind: 'headline', ls: -0.4 },
  h2: { size: 24, lh: 30, kind: 'headline', ls: -0.2 },
  h3: { size: 19, lh: 25, kind: 'headline' },
  title: { size: 16, lh: 22, kind: 'semibold' },
  body: { size: 16, lh: 25, kind: 'body' },
  bodySm: { size: 14, lh: 21, kind: 'body' },
  caption: { size: 12.5, lh: 17, kind: 'body' },
  label: { size: 13, lh: 17, kind: 'semibold', ls: 0.1 },
  overline: { size: 11, lh: 14, kind: 'semibold', ls: 1.4, upper: true },
};

export interface TxtProps extends TextProps {
  v?: Variant;
  color?: string;
  muted?: boolean;
  /** Content language — chooses the matching Noto font. Defaults to the UI language. */
  lang?: string;
  align?: TextStyle['textAlign'];
}

export function Txt({ v = 'body', color, muted, lang, align, style, ...rest }: TxtProps) {
  const t = useTheme();
  const uiLang = usePrefs((s) => s.language);
  const l = lang ?? uiLang;
  const f = t.fontsFor(l);
  const spec = sizes[v];
  const family = spec.kind === 'headline' ? f.headlineBold : spec.kind === 'semibold' ? f.bodySemibold : f.body;
  const scale = t.lh(l);
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: family,
          fontSize: l === 'en' ? spec.size : spec.size * (spec.kind === 'headline' ? 0.86 : 0.94),
          lineHeight: Math.round(spec.lh * scale),
          letterSpacing: l === 'en' ? spec.ls : 0,
          color: color ?? (muted ? t.colors.textMuted : t.colors.text),
          textTransform: spec.upper && l === 'en' ? 'uppercase' : undefined,
          textAlign: align,
        },
        style,
      ]}
    />
  );
}
