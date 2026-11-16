/**
 * Per-language font pairing. Latin uses Playfair Display (serif headlines) + Inter (body).
 * Telugu uses Ramabhadra + Mandali + Hind Guntur (see README → Typography); Devanagari gets a serif
 * headline face; other Indic scripts use matching Noto families.
 * Fonts are loaded lazily per language (see useLanguageFonts) to keep startup fast.
 */
import type { LangCode } from '@/i18n/languages';

export interface FontPair {
  headline: string;
  headlineBold: string;
  body: string;
  bodyMedium: string;
  bodySemibold: string;
}

export const latinFonts = {
  PlayfairDisplay_600SemiBold: require('@expo-google-fonts/playfair-display/600SemiBold/PlayfairDisplay_600SemiBold.ttf'),
  PlayfairDisplay_700Bold: require('@expo-google-fonts/playfair-display/700Bold/PlayfairDisplay_700Bold.ttf'),
  PlayfairDisplay_700Bold_Italic: require('@expo-google-fonts/playfair-display/700Bold_Italic/PlayfairDisplay_700Bold_Italic.ttf'),
  Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
  Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
  // brand wordmark చాటింపు — loaded at startup in every language
  Ramabhadra_400Regular: require('@expo-google-fonts/ramabhadra/400Regular/Ramabhadra_400Regular.ttf'),
};

const LATIN: FontPair = {
  headline: 'PlayfairDisplay_600SemiBold',
  headlineBold: 'PlayfairDisplay_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
};

/** Font assets required for each language (in addition to Latin, which is always loaded). */
export const languageFontAssets: Partial<Record<LangCode, Record<string, number>>> = {
  // Telugu: Ramabhadra (news headlines) + Mandali (body, designed for Telugu news publishing)
  // + Hind Guntur SemiBold for UI labels/buttons. All SIL Open Font License, free to embed in apps.
  te: {
    Ramabhadra_400Regular: require('@expo-google-fonts/ramabhadra/400Regular/Ramabhadra_400Regular.ttf'),
    Mandali_400Regular: require('@expo-google-fonts/mandali/400Regular/Mandali_400Regular.ttf'),
    HindGuntur_500Medium: require('@expo-google-fonts/hind-guntur/500Medium/HindGuntur_500Medium.ttf'),
    HindGuntur_600SemiBold: require('@expo-google-fonts/hind-guntur/600SemiBold/HindGuntur_600SemiBold.ttf'),
  },
  hi: {
    NotoSerifDevanagari_700Bold: require('@expo-google-fonts/noto-serif-devanagari/700Bold/NotoSerifDevanagari_700Bold.ttf'),
    NotoSansDevanagari_400Regular: require('@expo-google-fonts/noto-sans-devanagari/400Regular/NotoSansDevanagari_400Regular.ttf'),
    NotoSansDevanagari_600SemiBold: require('@expo-google-fonts/noto-sans-devanagari/600SemiBold/NotoSansDevanagari_600SemiBold.ttf'),
  },
  mr: {
    NotoSerifDevanagari_700Bold: require('@expo-google-fonts/noto-serif-devanagari/700Bold/NotoSerifDevanagari_700Bold.ttf'),
    NotoSansDevanagari_400Regular: require('@expo-google-fonts/noto-sans-devanagari/400Regular/NotoSansDevanagari_400Regular.ttf'),
    NotoSansDevanagari_600SemiBold: require('@expo-google-fonts/noto-sans-devanagari/600SemiBold/NotoSansDevanagari_600SemiBold.ttf'),
  },
  ta: {
    NotoSansTamil_400Regular: require('@expo-google-fonts/noto-sans-tamil/400Regular/NotoSansTamil_400Regular.ttf'),
    NotoSansTamil_700Bold: require('@expo-google-fonts/noto-sans-tamil/700Bold/NotoSansTamil_700Bold.ttf'),
  },
  kn: {
    NotoSansKannada_400Regular: require('@expo-google-fonts/noto-sans-kannada/400Regular/NotoSansKannada_400Regular.ttf'),
    NotoSansKannada_700Bold: require('@expo-google-fonts/noto-sans-kannada/700Bold/NotoSansKannada_700Bold.ttf'),
  },
  ml: {
    NotoSansMalayalam_400Regular: require('@expo-google-fonts/noto-sans-malayalam/400Regular/NotoSansMalayalam_400Regular.ttf'),
    NotoSansMalayalam_700Bold: require('@expo-google-fonts/noto-sans-malayalam/700Bold/NotoSansMalayalam_700Bold.ttf'),
  },
  bn: {
    NotoSansBengali_400Regular: require('@expo-google-fonts/noto-sans-bengali/400Regular/NotoSansBengali_400Regular.ttf'),
    NotoSansBengali_700Bold: require('@expo-google-fonts/noto-sans-bengali/700Bold/NotoSansBengali_700Bold.ttf'),
  },
  gu: {
    NotoSansGujarati_400Regular: require('@expo-google-fonts/noto-sans-gujarati/400Regular/NotoSansGujarati_400Regular.ttf'),
    NotoSansGujarati_700Bold: require('@expo-google-fonts/noto-sans-gujarati/700Bold/NotoSansGujarati_700Bold.ttf'),
  },
};

const pair = (headline: string, body: string, semibold: string): FontPair => ({
  headline,
  headlineBold: headline,
  body,
  bodyMedium: body,
  bodySemibold: semibold,
});

export const fontPairs: Record<LangCode, FontPair> = {
  en: LATIN,
  te: { headline: 'Ramabhadra_400Regular', headlineBold: 'Ramabhadra_400Regular', body: 'Mandali_400Regular', bodyMedium: 'HindGuntur_500Medium', bodySemibold: 'HindGuntur_600SemiBold' },
  hi: pair('NotoSerifDevanagari_700Bold', 'NotoSansDevanagari_400Regular', 'NotoSansDevanagari_600SemiBold'),
  mr: pair('NotoSerifDevanagari_700Bold', 'NotoSansDevanagari_400Regular', 'NotoSansDevanagari_600SemiBold'),
  ta: pair('NotoSansTamil_700Bold', 'NotoSansTamil_400Regular', 'NotoSansTamil_700Bold'),
  kn: pair('NotoSansKannada_700Bold', 'NotoSansKannada_400Regular', 'NotoSansKannada_700Bold'),
  ml: pair('NotoSansMalayalam_700Bold', 'NotoSansMalayalam_400Regular', 'NotoSansMalayalam_700Bold'),
  bn: pair('NotoSansBengali_700Bold', 'NotoSansBengali_400Regular', 'NotoSansBengali_700Bold'),
  gu: pair('NotoSansGujarati_700Bold', 'NotoSansGujarati_400Regular', 'NotoSansGujarati_700Bold'),
};

export const latinPair = LATIN;

/** Indic scripts need extra line height so matras / conjuncts are not clipped. */
export const lineHeightScale = (lang: LangCode, kind: 'headline' | 'body' | 'semibold' = 'body') =>
  lang === 'en' ? 1 : lang === 'te' ? (kind === 'headline' ? 1.08 : 1.36) : 1.32;

/**
 * Optical size correction per script, relative to the Latin type scale.
 * Ramabhadra is a heavy, wide display face → set it smaller; Mandali has a small
 * x-height → keep body at full size so long Telugu summaries stay comfortable.
 */
export function sizeScale(lang: LangCode, kind: 'headline' | 'body' | 'semibold') {
  if (lang === 'en') return 1;
  if (lang === 'te') return kind === 'headline' ? 0.9 : kind === 'body' ? 1.02 : 0.96;
  return kind === 'headline' ? 0.86 : 0.94;
}
