import { View } from 'react-native';
import { Txt } from './Txt';
import { EmptyArt } from './EmptyArt';

export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
      <EmptyArt size={150} />
      <Txt v="h3" align="center">{title}</Txt>
      {sub ? <Txt v="bodySm" muted align="center">{sub}</Txt> : null}
    </View>
  );
}
