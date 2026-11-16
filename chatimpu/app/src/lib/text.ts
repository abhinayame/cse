import type { ContentLang, Story, StoryText } from '@/data/types';

export type Localized = Partial<Record<ContentLang, string>> & { en: string };

/** Pick the user's language with English fallback. */
export const pick = (v: Localized, lang: string) => (v as Record<string, string>)[lang] ?? v.en;

/** Story text in the reader's language, plus the language actually used (for font + TTS). */
export function storyText(s: Story, lang: string): StoryText & { lang: ContentLang } {
  const t = (s.content as Record<string, StoryText | undefined>)[lang];
  return t ? { ...t, lang: lang as ContentLang } : { ...s.content.en, lang: 'en' };
}

export const wordCount = (s: string) => s.trim().split(/\s+/).length;
