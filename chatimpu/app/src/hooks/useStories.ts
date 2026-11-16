import { useEffect, useState } from 'react';
import { fetchStories } from '@/lib/api';
import { usePrefs } from '@/store/prefs';
import { useLibrary } from '@/store/library';
import type { Story } from '@/data/types';

/** Loads the story pool, caches the newest 100 for offline, falls back to the cache on failure. */
export function useStories() {
  const { language, districtId, mandalId, stateId } = usePrefs();
  const cache = useLibrary((s) => s.cache);
  const [stories, setStories] = useState<Story[] | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchStories({ lang: language, districtId, mandalId, stateId })
      .then((s) => { if (!alive) return; setStories(s); setOffline(false); cache(s); })
      .catch(() => { if (!alive) return; setStories(useLibrary.getState().offline); setOffline(true); });
    return () => { alive = false; };
  }, [language, districtId, mandalId, stateId, cache]);

  return { stories, offline, loading: stories === null };
}
