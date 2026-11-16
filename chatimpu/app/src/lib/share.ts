import type { ComponentRef } from 'react';
import { Platform, Share, type View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { APP } from '@/config';
import { storyText } from './text';
import type { Story } from '@/data/types';

/** Capture the branded ShareCard as a PNG and open the native share sheet (WhatsApp / Instagram etc). */
export async function shareStoryImage(node: ComponentRef<typeof View> | null, story: Story, lang: string) {
  const txt = storyText(story, lang);
  const message = `${txt.headline}\n\n${APP.shareBase}${story.id}`;
  try {
    if (node && Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
      const uri = await captureRef(node, { format: 'png', quality: 0.95, width: 1080, height: 1350 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: txt.headline, UTI: 'public.png' });
      return true;
    }
  } catch {
    // fall through to text share
  }
  try {
    await Share.share({ message, title: txt.headline, url: `${APP.shareBase}${story.id}` });
    return true;
  } catch {
    return false;
  }
}
