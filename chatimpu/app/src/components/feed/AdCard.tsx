import { Linking, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Txt } from '@/components/ui';
import { palette, radius } from '@/theme';
import { useT } from '@/i18n';
import { usePrefs } from '@/store/prefs';
import { pick } from '@/lib/text';
import type { Ad } from '@/data/types';

/** Native full-screen ad card. Always carries a visible "Ad" label. */
export function AdCard({ ad, width, height, bottomInset }: { ad: Ad; width: number; height: number; bottomInset: number }) {
  const tr = useT();
  const lang = usePrefs((s) => s.language);
  const l = (ad.headline as Record<string, string>)[lang] ? lang : 'en';
  return (
    <View style={{ width, height, backgroundColor: palette.ink }}>
      <Image source={{ uri: ad.image }} style={{ position: 'absolute', width, height }} contentFit="cover" />
      <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.95)']} locations={[0, 0.45, 0.85]} style={{ position: 'absolute', width, height }} />
      <View style={{ flex: 1, justifyContent: 'flex-end', padding: 24, paddingBottom: bottomInset + 24, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ backgroundColor: palette.red, paddingHorizontal: 8, height: 22, borderRadius: radius.xs, justifyContent: 'center' }}>
            <Txt v="overline" color={palette.white}>{tr('advertisement')}</Txt>
          </View>
          <Txt v="label" color={palette.white}>{ad.advertiser}</Txt>
        </View>
        <Txt v="h1" lang={l} color={palette.white}>{pick(ad.headline, lang)}</Txt>
        <Txt v="body" lang={l} color="#DADADA">{pick(ad.body, lang)}</Txt>
        <Button label={pick(ad.cta, lang)} icon={ad.phone ? 'call' : 'arrow-forward'} onPress={() => Linking.openURL(ad.phone ? `tel:${ad.phone}` : ad.url)} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
      </View>
    </View>
  );
}
