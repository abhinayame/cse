import { router } from 'expo-router';
import { Button } from '@/components/ui';
import { Scaffold } from '@/components/onboarding/Scaffold';
import { InterestGrid } from '@/components/InterestGrid';
import { usePrefs } from '@/store/prefs';
import { useT } from '@/i18n';

export default function InterestsStep() {
  const tr = useT();
  const interests = usePrefs((s) => s.interests);
  const set = usePrefs((s) => s.set);
  const need = Math.max(0, 3 - interests.length);
  return (
    <Scaffold step={2} title={tr('interestsTitle')} sub={tr('interestsSub')}
      footer={<Button label={need ? tr('pickAtLeast', { n: need }) : tr('continue')} disabled={need > 0} icon="arrow-forward" onPress={() => router.push('/onboarding/login')} />}>
      <InterestGrid value={interests} onToggle={(c) => set({ interests: interests.includes(c) ? interests.filter((x) => x !== c) : [...interests, c] })} />
    </Scaffold>
  );
}
