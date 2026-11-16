import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Icon, Tap, Txt } from '@/components/ui';
import { CATEGORIES } from '@/lib/categories';
import { categoryColors, radius, useTheme } from '@/theme';
import { useT } from '@/i18n';
import type { CategoryId } from '@/data/types';

export function InterestGrid({ value, onToggle }: { value: CategoryId[]; onToggle: (c: CategoryId) => void }) {
  const t = useTheme();
  const tr = useT();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {CATEGORIES.map((c) => {
        const sel = value.includes(c.id);
        const col = categoryColors[c.id];
        return (
          <Tap key={c.id} onPress={() => onToggle(c.id)} accessibilityRole="checkbox" accessibilityState={{ checked: sel }} accessibilityLabel={tr(`cat_${c.id}`)}
            style={{ width: '30.8%', aspectRatio: 1, borderRadius: radius.lg, padding: 12, justifyContent: 'space-between',
              backgroundColor: sel ? col + '22' : t.colors.surface, borderWidth: sel ? 2 : 1, borderColor: sel ? col : t.colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: col + (sel ? 'FF' : '22') }}>
                <Icon name={c.icon} size={20} color={sel ? '#fff' : col} />
              </View>
              {sel && <Animated.View entering={ZoomIn.springify()}><Icon name="checkmark-circle" size={20} color={col} /></Animated.View>}
            </View>
            <Txt v="label" numberOfLines={1}>{tr(`cat_${c.id}`)}</Txt>
          </Tap>
        );
      })}
    </View>
  );
}
