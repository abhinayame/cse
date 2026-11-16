import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const ok = Platform.OS === 'ios' || Platform.OS === 'android';
export const haptic = {
  flip: () => ok && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  tap: () => ok && Haptics.selectionAsync().catch(() => {}),
  success: () => ok && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  heavy: () => ok && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
};
