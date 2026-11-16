import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { LanguageGrid } from '@/components/LanguageGrid';
import { usePrefs } from '@/store/prefs';
import { useT } from '@/i18n';

export default function LanguageSettings() {
  const tr = useT();
  const lang = usePrefs((s) => s.language);
  const set = usePrefs((s) => s.set);
  return (
    <Screen back title={tr('language')}>
      <View style={{ padding: 20 }}><LanguageGrid value={lang} onChange={(c) => set({ language: c })} /></View>
    </Screen>
  );
}
