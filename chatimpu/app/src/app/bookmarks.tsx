import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { StoryRow } from '@/components/StoryRow';
import { EmptyState } from '@/components/ui';
import { useLibrary } from '@/store/library';
import { usePrefs } from '@/store/prefs';
import { storyById } from '@/data/stories';
import { useT } from '@/i18n';

export default function Bookmarks() {
  const tr = useT();
  const lang = usePrefs((s) => s.language);
  const ids = useLibrary((s) => s.bookmarks);
  const offline = useLibrary((s) => s.offline);
  const stories = ids.map((id) => storyById(id) ?? offline.find((o) => o.id === id)).filter(Boolean);
  return (
    <Screen back title={tr('bookmarks')}>
      <View style={{ height: 8 }} />
      {stories.length ? stories.map((s) => <StoryRow key={s!.id} story={s!} lang={lang} />) : <EmptyState title={tr('emptyBookmarks')} />}
    </Screen>
  );
}
