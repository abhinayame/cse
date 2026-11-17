import { forwardRef, type ComponentRef } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Txt } from '@/components/ui';
import { categoryColors, palette } from '@/theme';
import { storyText } from '@/lib/text';
import { districtById, placeName } from '@/data/locations';
import { translate } from '@/i18n';
import type { LangCode } from '@/i18n/languages';
import type { Story } from '@/data/types';
import { APP } from '@/config';
import { Emblem, Wordmark } from '@/components/Brand';

/** Branded 1080×1350 (4:5) share template for WhatsApp / Instagram. Rendered at 360×450 and captured at 3×. */
export const ShareCard = forwardRef<ComponentRef<typeof View>, { story: Story; lang: LangCode }>(function ShareCard({ story, lang }, ref) {
  const txt = storyText(story, lang);
  return (
    <View ref={ref} collapsable={false} style={{ width: 360, height: 450, backgroundColor: palette.ink }}>
      <Image source={{ uri: story.image }} style={{ width: 360, height: 220 }} contentFit="cover" />
      <LinearGradient colors={['rgba(0,0,0,0)', palette.ink]} style={{ position: 'absolute', top: 120, width: 360, height: 100 }} />
      <View style={{ position: 'absolute', top: 14, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Emblem size={26} />
        <Wordmark size={17} onDark />
      </View>
      <View style={{ padding: 18, paddingTop: 4, flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: categoryColors[story.category] }} />
          <Txt v="overline" lang={lang} color={palette.redBright}>{translate(lang, `cat_${story.category}`)} · {placeName(lang, districtById(story.districtId))}</Txt>
        </View>
        <Txt v="h3" lang={txt.lang} color={palette.white} numberOfLines={3}>{txt.headline}</Txt>
        <Txt v="caption" lang={txt.lang} color="#C7C7C7" numberOfLines={5} style={{ marginTop: 8 }}>{txt.summary}</Txt>
        <View style={{ flex: 1 }} />
        <View style={{ height: 1, backgroundColor: 'rgba(215,20,26,0.4)', marginBottom: 8 }} />
        <Txt v="caption" lang="en" color={palette.redSoft}>Read more short news in your language · www.{APP.domain}</Txt>
      </View>
    </View>
  );
});
