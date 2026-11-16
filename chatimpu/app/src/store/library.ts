import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CategoryId, ReactionKind, Story } from '@/data/types';
import { safeStorage } from './storage';

export const OFFLINE_LIMIT = 100;

interface HistoryItem { id: string; at: number; dwellMs: number }

interface LibraryState {
  bookmarks: string[];
  history: HistoryItem[];
  reactions: Record<string, ReactionKind>;
  pollVotes: Record<string, string>;
  /** Learned per-category affinity used by the personalization engine */
  affinity: Partial<Record<CategoryId, number>>;
  /** Last N stories cached for offline reading */
  offline: Story[];
  toggleBookmark: (id: string) => boolean;
  react: (id: string, kind: ReactionKind) => void;
  vote: (pollId: string, optionId: string) => void;
  recordRead: (story: Story, dwellMs: number) => void;
  recordShare: (story: Story) => void;
  cache: (stories: Story[]) => void;
  clearHistory: () => void;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      bookmarks: [],
      history: [],
      reactions: {},
      pollVotes: {},
      affinity: {},
      offline: [],
      toggleBookmark: (id) => {
        const has = get().bookmarks.includes(id);
        set({ bookmarks: has ? get().bookmarks.filter((b) => b !== id) : [id, ...get().bookmarks] });
        return !has;
      },
      react: (id, kind) => {
        const r = { ...get().reactions };
        if (r[id] === kind) delete r[id]; else r[id] = kind;
        set({ reactions: r });
      },
      vote: (pollId, optionId) => set({ pollVotes: { ...get().pollVotes, [pollId]: optionId } }),
      /**
       * Implicit feedback: a "skip" (< 2.5 s) lowers affinity, a full read (> 12 s) raises it.
       * Values decay slowly toward 0 so tastes can change.
       */
      recordRead: (story, dwellMs) => {
        const a = { ...get().affinity };
        const prev = a[story.category] ?? 0;
        const signal = dwellMs < 2500 ? -0.6 : dwellMs > 12000 ? 1 : dwellMs / 12000 * 0.6;
        a[story.category] = clamp(prev * 0.97 + signal, -5, 10);
        const history = [{ id: story.id, at: Date.now(), dwellMs }, ...get().history.filter((h) => h.id !== story.id)].slice(0, 300);
        set({ affinity: a, history });
      },
      recordShare: (story) => {
        const a = { ...get().affinity };
        a[story.category] = clamp((a[story.category] ?? 0) + 2, -5, 10);
        set({ affinity: a });
      },
      cache: (stories) => {
        const map = new Map<string, Story>();
        for (const s of [...stories, ...get().offline]) if (!map.has(s.id)) map.set(s.id, s);
        set({ offline: [...map.values()].slice(0, OFFLINE_LIMIT) });
      },
      clearHistory: () => set({ history: [] }),
    }),
    { name: 'chatimpu.library.v1', storage: safeStorage },
  ),
);
