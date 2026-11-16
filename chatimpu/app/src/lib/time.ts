import type { StringKey } from '@/i18n';

export function timeAgo(iso: string, t: (k: StringKey, v?: Record<string, string | number>) => string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 2) return t('justNow');
  if (diff < 60) return t('minAgo', { n: Math.round(diff) });
  if (diff < 60 * 24) return t('hrAgo', { n: Math.round(diff / 60) });
  return t('dayAgo', { n: Math.round(diff / 1440) });
}

export const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n);
