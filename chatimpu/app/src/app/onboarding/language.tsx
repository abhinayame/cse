import { router } from 'expo-router';
import { Button } from '@/components/ui';
import { LanguageGrid } from '@/components/LanguageGrid';
import { Scaffold } from '@/components/onboarding/Scaffold';
import { useT } from '@/i18n';
import { usePrefs } from '@/store/prefs';

export default function LanguageStep() {
  const tr = useT();
  const lang = usePrefs((s) => s.language);
  const set = usePrefs((s) => s.set);
  return (
    <Scaffold step={0} title={tr('chooseLanguage')} sub={tr('chooseLanguageSub')} back={false}
      footer={<Button label={tr('continue')} icon="arrow-forward" onPress={() => router.push('/onboarding/location')} />}>
      <LanguageGrid value={lang} onChange={(c) => set({ language: c })} />
    </Scaffold>
  );
}

