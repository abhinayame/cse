import { DISTRICTS, MANDALS } from '@data/locations';

export const fmt = (n: number) => n.toLocaleString('en-IN');
export const compact = (n: number) => (n >= 1e7 ? `${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));
export const district = (id: string) => DISTRICTS.find((d) => d.id === id)?.name ?? id;
export const mandal = (id?: string) => MANDALS.find((m) => m.id === id)?.name ?? '';
export const ago = (iso: string) => {
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  return m < 0 ? `in ${Math.round(-m / 60)}h` : m < 60 ? `${Math.round(m)}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};
export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
export const LANGS: { code: string; name: string }[] = [
  { code: 'en', name: 'English' }, { code: 'te', name: 'తెలుగు' }, { code: 'hi', name: 'हिन्दी' }, { code: 'ta', name: 'தமிழ்' },
  { code: 'kn', name: 'ಕನ್ನಡ' }, { code: 'ml', name: 'മലയാളം' }, { code: 'mr', name: 'मराठी' }, { code: 'bn', name: 'বাংলা' }, { code: 'gu', name: 'ગુજરાતી' },
];
export const CATS = ['politics', 'cinema', 'sports', 'business', 'tech', 'jobs', 'education', 'devotional', 'agriculture', 'health', 'crime', 'weather'] as const;
export const CAT_COLOR: Record<string, string> = {
  politics: '#7C5CDB', cinema: '#D9487A', sports: '#2F9E6B', business: '#3D7BD9', tech: '#1BA3B8', jobs: '#E39A2D',
  education: '#5A7FD6', devotional: '#C9A24D', agriculture: '#5E9E3A', health: '#E06A5A', crime: '#B23A48', weather: '#4A90C2',
};
export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
