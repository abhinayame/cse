/**
 * Text-to-speech "Listen" mode. Uses the device's Indic voices via expo-speech.
 * A queue lets the morning/evening briefing auto-play several stories back to back.
 */
import * as Speech from 'expo-speech';
import { LANGUAGES } from '@/i18n/languages';

const ttsTag = (lang: string) => LANGUAGES.find((l) => l.code === lang)?.tts ?? 'en-IN';

let queue: { id: string; text: string; lang: string }[] = [];
let listeners = new Set<(id: string | null) => void>();
let current: string | null = null;

const emit = () => listeners.forEach((l) => l(current));

function playNext() {
  const item = queue.shift();
  current = item?.id ?? null;
  emit();
  if (!item) return;
  Speech.speak(item.text, {
    language: ttsTag(item.lang),
    rate: 0.98,
    pitch: 1,
    onDone: playNext,
    onStopped: () => { current = null; emit(); },
    onError: playNext,
  });
}

export const speech = {
  play(items: { id: string; text: string; lang: string }[]) {
    Speech.stop();
    queue = [...items];
    playNext();
  },
  stop() { queue = []; Speech.stop(); current = null; emit(); },
  subscribe(fn: (id: string | null) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  get current() { return current; },
};
