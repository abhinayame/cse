/** Daily WhatsApp status cards (migrations/0008_content.sql §3). Demo data mirrors the seeded cards. */
export type StatusKind = 'good_morning' | 'good_night' | 'quote' | 'proverb' | 'devotional' | 'motivation' | 'festival' | 'meme';
export interface StatusCard { id: string; kind: StatusKind; lang: string; text: string; attribution: string | null; background: string; image: string | null; publishOn: string; shares: number }

/** Gradient presets — same keys as the CMS picker. */
export const STATUS_BACKGROUNDS: Record<string, [string, string]> = {
  saffron: ['#F7971E', '#C0392B'],
  dawn: ['#FF9A5A', '#7A1F3D'],
  night: ['#0F2027', '#203A43'],
  green: ['#0B6E4F', '#08403A'],
  navy: ['#2E3192', '#0B0C3B'],
  red: ['#ED1C24', '#6E0A0E'],
  purple: ['#41295A', '#1C0C2E'],
};

export const STATUS_KIND_LABEL: Record<StatusKind, { te: string; en: string }> = {
  good_morning: { te: 'శుభోదయం', en: 'Good morning' },
  good_night: { te: 'శుభరాత్రి', en: 'Good night' },
  quote: { te: 'సూక్తి', en: 'Quote' },
  proverb: { te: 'సామెత', en: 'Proverb' },
  devotional: { te: 'భక్తి', en: 'Devotional' },
  motivation: { te: 'ప్రేరణ', en: 'Motivation' },
  festival: { te: 'పండుగ', en: 'Festival' },
  meme: { te: 'మీమ్స్', en: 'Memes' },
};

const today = new Date().toISOString().slice(0, 10);
const c = (id: string, kind: StatusKind, lang: string, text: string, background: string, attribution: string | null = null, shares = 0): StatusCard =>
  ({ id, kind, lang, text, attribution, background, image: null, publishOn: today, shares });

export const DEMO_STATUS: StatusCard[] = [
  c('seed-gm-1', 'good_morning', 'te', 'శుభోదయం! ఈ రోజు మీ ఊరిలో, మీ ఇంట్లో, మీ మనసులో వెలుగు నిండాలి.', 'dawn', null, 5200),
  c('seed-gm-2', 'good_morning', 'te', 'కొత్త రోజు, కొత్త అవకాశం. చిరునవ్వుతో మొదలుపెట్టండి. శుభోదయం!', 'saffron', null, 3100),
  c('seed-pv-1', 'proverb', 'te', 'కృషితో నాస్తి దుర్భిక్షం.', 'green', 'తెలుగు సామెత', 2400),
  c('seed-pv-4', 'proverb', 'te', 'ఇంట గెలిచి రచ్చ గెలువు.', 'red', 'తెలుగు సామెత', 1900),
  c('seed-mo-1', 'motivation', 'te', 'పెద్ద మార్పు ఒక్క రోజులో రాదు. ప్రతి రోజు చిన్న అడుగు వేయండి.', 'red', null, 2800),
  c('seed-mo-2', 'motivation', 'te', 'మీ ఊరి సమస్యను మీరే మొదట గమనిస్తారు. దాన్ని లోకానికి చెప్పండి — చాటింపు చేయండి!', 'navy', null, 1200),
  c('seed-mo-3', 'motivation', 'te', 'అడుగు అడుగుకీ అనుభవం, అనుభవమే గురువు.', 'purple', null, 900),
  c('seed-dv-1', 'devotional', 'te', 'ఓం నమః శివాయ. అందరికీ ఆరోగ్యం, శాంతి, సంతోషం కలగాలి.', 'saffron', null, 6100),
  c('seed-dv-2', 'devotional', 'te', 'సర్వే జనాః సుఖినో భవంతు — అందరూ సుఖంగా ఉండాలి.', 'dawn', 'శాంతి మంత్రం', 4300),
  c('seed-qt-1', 'quote', 'te', 'మంచి వార్త చిన్నదైనా సరే, పదిమందికి చేరితే పెద్ద మార్పు తెస్తుంది.', 'green', 'చాటింపు', 800),
  c('seed-pv-2', 'proverb', 'te', 'చెట్టు పేరు చెప్పి కాయలు అమ్ముకోవడం.', 'navy', 'తెలుగు సామెత', 700),
  c('seed-gn-1', 'good_night', 'te', 'ఈ రోజు చేసిన మంచి పనులే రేపటి ధైర్యం. శుభరాత్రి!', 'night', null, 3500),
  c('seed-gm-en', 'good_morning', 'en', 'Good morning! May your day be as bright as your village sunrise.', 'dawn', null, 600),
  c('seed-mo-en', 'motivation', 'en', 'Small steps every day beat a big leap someday.', 'navy', null, 400),
];
