import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { StoryRow } from '@/components/StoryRow';
import { EmptyState, Tap, Txt } from '@/components/ui';
import { useLibrary } from '@/store/library';
import { usePrefs } from '@/store/prefs';
import { storyById } from '@/data/stories';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

export default function History() {
  const tr = useT();
  const t = useTheme();
  const lang = usePrefs((s) => s.language);
  const history = useLibrary((s) => s.history);
  const clear = useLibrary((s) => s.clearHistory);
  const offline = useLibrary((s) => s.offline);
  const stories = history.map((h) => storyById(h.id) ?? offline.find((o) => o.id === h.id)).filter(Boolean);
  return (
    <Screen back title={tr('history')} right={history.length ? <Tap onPress={clear}><Txt v="label" color={t.colors.accentText}>Clear</Txt></Tap> : undefined}>
      <Txt v="caption" muted style={{ paddingHorizontal: 20 }}>{tr('offlineStories', { n: offline.length })}</Txt>
      <View style={{ height: 8 }} />
      {stories.length ? stories.map((s) => <StoryRow key={s!.id} story={s!} lang={lang} />) : <EmptyState title={tr('emptyHistory')} />}
    </Screen>
  );
}
