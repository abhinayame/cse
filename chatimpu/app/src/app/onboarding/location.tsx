import { router } from 'expo-router';
import { Button } from '@/components/ui';
import { Scaffold } from '@/components/onboarding/Scaffold';
import { LocationPicker } from '@/components/LocationPicker';
import { useT } from '@/i18n';

export default function LocationStep() {
  const tr = useT();
  return (
    <Scaffold step={1} title={tr('locationTitle')} sub={tr('locationSub')}
      footer={<Button label={tr('continue')} icon="arrow-forward" onPress={() => router.push('/onboarding/interests')} />}>
      <LocationPicker />
    </Scaffold>
  );
}
