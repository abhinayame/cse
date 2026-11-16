import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { LocationPicker } from '@/components/LocationPicker';
import { useT } from '@/i18n';

export default function LocationSettings() {
  const tr = useT();
  return <Screen back title={tr('location')}><View style={{ padding: 20 }}><LocationPicker /></View></Screen>;
}
