import { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { languageFontAssets } from '@/theme/fonts';
import type { LangCode } from '@/i18n/languages';

/** Lazily loads the Noto faces for a language; Latin faces are loaded at startup. */
export function useLanguageFonts(lang: LangCode) {
  const [ready, setReady] = useState(lang === 'en');
  useEffect(() => {
    const assets = languageFontAssets[lang];
    if (!assets) { setReady(true); return; }
    let alive = true;
    setReady(Object.keys(assets).every((f) => Font.isLoaded(f)));
    Font.loadAsync(assets).catch(() => {}).finally(() => alive && setReady(true));
    return () => { alive = false; };
  }, [lang]);
  return ready;
}
