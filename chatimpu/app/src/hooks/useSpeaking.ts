import { useEffect, useState } from 'react';
import { speech } from '@/lib/speech';

/** Id of the story currently being read aloud (or null). */
export function useSpeaking() {
  const [id, setId] = useState<string | null>(speech.current);
  useEffect(() => speech.subscribe(setId), []);
  return id;
}
