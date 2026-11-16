import { router } from 'expo-router';
import { Button } from '@/components/ui';
import { Scaffold } from '@/components/onboarding/Scaffold';
import { OtpLogin } from '@/components/OtpLogin';
import { usePrefs } from '@/store/prefs';
import { requestPushPermission } from '@/lib/notifications';
import { useT } from '@/i18n';

export default function LoginStep() {
  const tr = useT();
  const set = usePrefs((s) => s.set);
  const finish = async () => {
    set({ onboarded: true });
    requestPushPermission().catch(() => {});
    router.replace('/(tabs)/feed');
  };
  return (
    <Scaffold step={3} title={tr('loginTitle')} sub={tr('loginSub')}
      footer={<Button kind="ghost" label={tr('continueAsGuest')} onPress={finish} />}>
      <OtpLogin onDone={finish} />
    </Scaffold>
  );
}
