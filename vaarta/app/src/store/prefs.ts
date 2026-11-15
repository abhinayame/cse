import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LangCode } from '@/i18n/languages';
import type { ThemeMode } from '@/theme/themes';
import type { CategoryId } from '@/data/types';
import { safeStorage } from './storage';

export interface User {
  id: string;
  phone: string;
  name?: string;
  /** Verified citizen reporter */
  verified: boolean;
}

export interface NotificationPrefs {
  breaking: boolean;
  local: boolean;
  digest: boolean;
  interests: boolean;
}

interface PrefsState {
  hydrated: boolean;
  onboarded: boolean;
  language: LangCode;
  themeMode: ThemeMode;
  stateId: string;
  districtId: string;
  mandalId: string;
  villageId?: string;
  interests: CategoryId[];
  user: User | null;
  notifications: NotificationPrefs;
  autoplay: boolean;
  dataSaver: boolean;
  premium: boolean;
  set: (p: Partial<Omit<PrefsState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

const defaults = {
  onboarded: false,
  language: 'te' as LangCode,
  themeMode: 'system' as ThemeMode,
  stateId: 'tg',
  districtId: 'hyd',
  mandalId: 'hyd-amp',
  villageId: undefined,
  interests: [] as CategoryId[],
  user: null,
  notifications: { breaking: true, local: true, digest: true, interests: true },
  autoplay: true,
  dataSaver: false,
  premium: false,
};

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      ...defaults,
      hydrated: false,
      set: (p) => set(p),
      reset: () => set({ ...defaults }),
    }),
    {
      name: 'vaarta.prefs.v1',
      storage: safeStorage,
      partialize: ({ hydrated, set, reset, ...rest }) => rest,
      onRehydrateStorage: () => () => usePrefs.setState({ hydrated: true }),
    },
  ),
);
