import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { InterestGrid } from '@/components/InterestGrid';
import { usePrefs } from '@/store/prefs';
import { useT } from '@/i18n';

export default function InterestSettings() {
  const tr = useT();
  const interests = usePrefs((s) => s.interests);
  const set = usePrefs((s) => s.set);
  return (
    <Screen back title={tr('interestsTitle')}>
      <View style={{ padding: 20 }}>
        <InterestGrid value={interests} onToggle={(c) => set({ interests: interests.includes(c) ? interests.filter((x) => x !== c) : [...interests, c] })} />
      </View>
    </Screen>
  );
}
