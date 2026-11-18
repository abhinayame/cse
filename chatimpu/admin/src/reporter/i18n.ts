/** Reporter portal strings (English / Telugu). Telugu is the default for local contributors. */
import { useCallback, useSyncExternalStore } from 'react';

import { reporterEn as en, reporterTe as te, type ReporterKey as Key } from '@data/reporterStrings';

export type Lang = 'te' | 'en';
const KEY = 'chatimpu.reporter.lang';
const listeners = new Set<() => void>();
let current: Lang = (() => { try { return (localStorage.getItem(KEY) as Lang) || 'te'; } catch { return 'te'; } })();

export function setLang(l: Lang) {
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* private mode */ }
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

export function useLang(): Lang {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => current, () => current);
}

export function useT() {
  const lang = useLang();
  return useCallback((k: Key) => (lang === 'te' ? te[k] ?? en[k] : en[k]), [lang]);
}
export type T = ReturnType<typeof useT>;

/** ₹ from paise, Indian grouping. */
export const rupees = (paise: number | null | undefined) =>
  `₹${((paise ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: (paise ?? 0) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

const CAT_TE: Record<string, string> = {
  politics: 'రాజకీయం', cinema: 'సినిమా', sports: 'క్రీడలు', business: 'వ్యాపారం', tech: 'టెక్', jobs: 'ఉద్యోగాలు', education: 'విద్య',
  devotional: 'భక్తి', agriculture: 'వ్యవసాయం', health: 'ఆరోగ్యం', crime: 'నేరాలు', weather: 'వాతావరణం',
};
export const catLabel = (lang: Lang, c: string) => (lang === 'te' ? CAT_TE[c] ?? c : c[0].toUpperCase() + c.slice(1));
