import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { OtpLogin } from '@/components/OtpLogin';
import { Txt } from '@/components/ui';
import { useT } from '@/i18n';

export default function Login() {
  const tr = useT();
  return (
    <Screen back title={tr('loginTitle')}>
      <View style={{ padding: 20, gap: 18 }}>
        <Txt v="body" muted>{tr('loginSub')}</Txt>
        <OtpLogin onDone={() => router.back()} />
      </View>
    </Screen>
  );
}
