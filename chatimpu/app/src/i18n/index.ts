import { useCallback } from 'react';
import en, { type StringKey, type Strings } from './strings/en';
import te from './strings/te';
import hi from './strings/hi';
import { ta, kn, ml, mr, bn, gu } from './strings/regional';
import type { LangCode } from './languages';
import { usePrefs } from '@/store/prefs';

const tables: Record<LangCode, Partial<Strings>> = { en, te, hi, ta, kn, ml, mr, bn, gu };

export function translate(lang: LangCode, key: StringKey, vars?: Record<string, string | number>) {
  let s = tables[lang]?.[key] ?? en[key] ?? key;
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, String(vars[k]));
  return s;
}

/** UI-language translator bound to the user's chosen language. */
export function useT() {
  const lang = usePrefs((s) => s.language);
  return useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );
}

export type { StringKey };
export * from './languages';
