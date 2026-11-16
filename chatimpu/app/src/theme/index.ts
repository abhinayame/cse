import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { usePrefs } from '@/store/prefs';
import { amoledTheme, darkTheme, lightTheme, type Theme } from './themes';
import { fontPairs, latinPair, lineHeightScale, type FontPair } from './fonts';
import type { LangCode } from '@/i18n/languages';

export * from './tokens';
export type { Theme } from './themes';

export interface ThemeCtx extends Theme {
  /** Fonts for UI chrome in the user's language */
  fonts: FontPair;
  /** Fonts for a given content language (story text may fall back to English) */
  fontsFor: (lang: string) => FontPair;
  lh: (lang: string, kind?: 'headline' | 'body' | 'semibold') => number;
}

export function useTheme(): ThemeCtx {
  const mode = usePrefs((s) => s.themeMode);
  const lang = usePrefs((s) => s.language);
  const system = useColorScheme();
  return useMemo(() => {
    const base = mode === 'amoled' ? amoledTheme : mode === 'dark' ? darkTheme : mode === 'light' ? lightTheme : system === 'dark' ? darkTheme : lightTheme;
    const fontsFor = (l: string) => fontPairs[l as LangCode] ?? latinPair;
    return { ...base, fonts: fontsFor(lang), fontsFor, lh: (l: string, k?: 'headline' | 'body' | 'semibold') => lineHeightScale(l as LangCode, k) };
  }, [mode, lang, system]);
}
