export type LangCode = 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml' | 'mr' | 'bn' | 'gu';

export interface Language {
  code: LangCode;
  /** Name in its own script */
  native: string;
  english: string;
  /** Sample glyph shown on the language tile */
  glyph: string;
  /** BCP-47 tag for Text-to-Speech */
  tts: string;
}

export const LANGUAGES: Language[] = [
  { code: 'te', native: 'తెలుగు', english: 'Telugu', glyph: 'అ', tts: 'te-IN' },
  { code: 'en', native: 'English', english: 'English', glyph: 'Aa', tts: 'en-IN' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', glyph: 'अ', tts: 'hi-IN' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil', glyph: 'அ', tts: 'ta-IN' },
  { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada', glyph: 'ಅ', tts: 'kn-IN' },
  { code: 'ml', native: 'മലയാളം', english: 'Malayalam', glyph: 'അ', tts: 'ml-IN' },
  { code: 'mr', native: 'मराठी', english: 'Marathi', glyph: 'म', tts: 'mr-IN' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali', glyph: 'অ', tts: 'bn-IN' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati', glyph: 'અ', tts: 'gu-IN' },
];

export const languageByCode = (c: LangCode) => LANGUAGES.find((l) => l.code === c)!;
