/** Reporter-hub strings: the same English / Telugu dictionary as the web portal (data/reporterStrings). */
import { useCallback } from 'react';
import { reporterEn, reporterTe, type ReporterKey } from '@/data/reporterStrings';
import { usePrefs } from '@/store/prefs';

export function useRT() {
  const lang = usePrefs((s) => s.language);
  return useCallback((k: ReporterKey) => (lang === 'te' ? reporterTe[k] ?? reporterEn[k] : reporterEn[k]), [lang]);
}
export type RT = ReturnType<typeof useRT>;
export const isTe = () => usePrefs.getState().language === 'te';
