import { useLocalSearchParams } from 'expo-router';
import { CollectionReader } from '@/components/CollectionReader';
import { STORIES } from '@/data/stories';
import { useT } from '@/i18n';
import type { CategoryId } from '@/data/types';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: CategoryId }>();
  const tr = useT();
  const stories = STORIES.filter((s) => s.category === id).sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  return <CollectionReader title={tr(`cat_${id}`)} stories={stories} />;
}
