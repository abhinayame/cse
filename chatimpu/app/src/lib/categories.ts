import type { IconName } from '@/components/ui';
import type { CategoryId } from '@/data/types';

export const CATEGORIES: { id: CategoryId; icon: IconName }[] = [
  { id: 'politics', icon: 'megaphone' },
  { id: 'cinema', icon: 'film' },
  { id: 'sports', icon: 'football' },
  { id: 'business', icon: 'trending-up' },
  { id: 'tech', icon: 'hardware-chip' },
  { id: 'jobs', icon: 'briefcase' },
  { id: 'education', icon: 'school' },
  { id: 'devotional', icon: 'flower' },
  { id: 'agriculture', icon: 'leaf' },
  { id: 'health', icon: 'medkit' },
  { id: 'crime', icon: 'shield' },
  { id: 'weather', icon: 'rainy' },
];
