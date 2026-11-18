/** Reporter hub — the contributor portal inside the app. Routes mirror the web portal (/reporter/…), so
 *  push-notification links open the same screen in either. */
import { Stack } from 'expo-router';
import { ReporterProvider } from '@/reporter/ui';

export default function ReporterLayout() {
  return (
    <ReporterProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </ReporterProvider>
  );
}
