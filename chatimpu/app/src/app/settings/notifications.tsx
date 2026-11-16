import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Group, Row } from '@/components/Row';
import { Button, Txt } from '@/components/ui';
import { usePrefs } from '@/store/prefs';
import { requestPushPermission, registerForPush } from '@/lib/notifications';
import { useT } from '@/i18n';
import { palette } from '@/theme';

export default function NotificationSettings() {
  const tr = useT();
  const n = usePrefs((s) => s.notifications);
  const set = usePrefs((s) => s.set);
  const update = (k: keyof typeof n, v: boolean) => { set({ notifications: { ...n, [k]: v } }); registerForPush().catch(() => {}); };
  return (
    <Screen back title={tr('notifications')}>
      <View style={{ height: 12 }} />
      <Group>
        <Row icon="flash" tint={palette.red} label={tr('pushBreaking')} toggle={n.breaking} onToggle={(v) => update('breaking', v)} />
        <Row icon="location" label={tr('pushLocal')} toggle={n.local} onToggle={(v) => update('local', v)} />
        <Row icon="sunny" label={tr('pushDigest')} toggle={n.digest} onToggle={(v) => update('digest', v)} />
        <Row icon="heart" label={tr('pushInterests')} toggle={n.interests} onToggle={(v) => update('interests', v)} last />
      </Group>
      <View style={{ padding: 20, gap: 10 }}>
        <Txt v="bodySm" muted>Alerts are targeted by your district, mandal and interests. Rich notifications include the story image and a one-tap “Listen” action.</Txt>
        <Button kind="secondary" icon="notifications" label="Enable on this device" onPress={() => requestPushPermission()} />
      </View>
    </Screen>
  );
}
