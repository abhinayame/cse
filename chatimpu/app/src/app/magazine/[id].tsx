import { useLocalSearchParams } from 'expo-router';
import { CollectionReader } from '@/components/CollectionReader';
import { MAGAZINES } from '@/data/catalog';
import { storyById } from '@/data/stories';
import { usePrefs } from '@/store/prefs';
import { pick } from '@/lib/text';
import type { Story } from '@/data/types';

export default function MagazineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lang = usePrefs((s) => s.language);
  const mag = MAGAZINES.find((m) => m.id === id);
  if (!mag) return null;
  return <CollectionReader title={pick(mag.title, lang)} stories={mag.storyIds.map(storyById).filter(Boolean) as Story[]} />;
}
